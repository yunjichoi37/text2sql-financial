# backend/cells.py : cells 테이블 CRUD + 실행/비교 오케스트레이션
import time
from typing import Literal

import psycopg2.extras
from fastapi import APIRouter, HTTPException

from agent_core import run_query, run_raw_sql
from backend.comparison import compare_results, compute_soft_f1
from backend.db import dict_cursor, get_conn
from backend.schemas import CellCreate, CellOut, CellUpdate
from backend.testset import get_testset_question
from backend.utils import to_jsonable_records

router = APIRouter(prefix="/api/cells", tags=["cells"])


def _extract_last_sql(intermediate_steps: list[dict]) -> str | None:
    for step in reversed(intermediate_steps):
        if step.get("tool") == "execute_sql_query":
            sql = step.get("input", {}).get("sql_query")
            if sql:
                return sql
    return None


def execute_cell(mode: str, question: str, gold_sql: str | None) -> dict:
    """agent_core.run_query 실행 + (testset이면) 정답 SQL 실행/비교까지 수행하고
    cells 테이블에 반영할 필드 dict를 반환한다."""
    start = time.perf_counter()
    result = run_query(question)
    duration_ms = round((time.perf_counter() - start) * 1000)
    relevant_tables = result.get("relevant_tables")
    intermediate_steps = result.get("intermediate_steps")

    if result.get("error"):
        return {
            "ai_sql": None,
            "ai_answer": None,
            "ai_result": None,
            "gold_result": None,
            "match_verdict": None,
            "soft_f1": None,
            "error": result["error"],
            "relevant_tables": relevant_tables,
            "intermediate_steps": intermediate_steps,
            "duration_ms": duration_ms,
        }

    ai_sql = _extract_last_sql(intermediate_steps or [])
    ai_result = to_jsonable_records(result.get("df"))
    ai_answer = result.get("answer")

    gold_result = None
    match_verdict = None
    soft_f1 = None
    error = None
    if mode == "testset" and gold_sql:
        try:
            gold_df = run_raw_sql(gold_sql)
            gold_result = to_jsonable_records(gold_df)
            match_verdict = compare_results(ai_result, gold_result)
            # EX가 참이면 멀티셋이 완전히 같으므로 Soft F1도 항상 1.0 — 재계산할 필요 없음.
            soft_f1 = 1.0 if match_verdict else compute_soft_f1(ai_result, gold_result)
        except Exception as e:
            error = f"정답 SQL 실행 에러: {e}"

    return {
        "ai_sql": ai_sql,
        "ai_answer": ai_answer,
        "ai_result": ai_result,
        "gold_result": gold_result,
        "match_verdict": match_verdict,
        "soft_f1": soft_f1,
        "error": error,
        "relevant_tables": relevant_tables,
        "intermediate_steps": intermediate_steps,
        "duration_ms": duration_ms,
    }


def _json_param(value):
    return psycopg2.extras.Json(value) if value is not None else None


def _insert_cell(*, mode, question, testset_question_id, evidence, difficulty, gold_sql,
                  ai_sql, ai_answer, ai_result, gold_result, match_verdict, soft_f1, error,
                  relevant_tables, intermediate_steps, duration_ms) -> dict:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            INSERT INTO cells (mode, question, testset_question_id, evidence, difficulty,
                                gold_sql, ai_sql, ai_answer, ai_result, gold_result,
                                match_verdict, soft_f1, error, relevant_tables, intermediate_steps,
                                duration_ms)
            VALUES (%(mode)s, %(question)s, %(testset_question_id)s, %(evidence)s, %(difficulty)s,
                    %(gold_sql)s, %(ai_sql)s, %(ai_answer)s, %(ai_result)s, %(gold_result)s,
                    %(match_verdict)s, %(soft_f1)s, %(error)s, %(relevant_tables)s, %(intermediate_steps)s,
                    %(duration_ms)s)
            RETURNING *;
            """,
            {
                "mode": mode,
                "question": question,
                "testset_question_id": testset_question_id,
                "evidence": evidence,
                "difficulty": difficulty,
                "gold_sql": gold_sql,
                "ai_sql": ai_sql,
                "ai_answer": ai_answer,
                "ai_result": _json_param(ai_result),
                "gold_result": _json_param(gold_result),
                "match_verdict": match_verdict,
                "soft_f1": soft_f1,
                "error": error,
                "relevant_tables": _json_param(relevant_tables),
                "intermediate_steps": _json_param(intermediate_steps),
                "duration_ms": duration_ms,
            },
        )
        row = cur.fetchone()
        cur.close()
        return dict(row)
    finally:
        conn.close()


def _insert_cell_run(*, cell_id, mode, question, testset_question_id, evidence, difficulty,
                      gold_sql, ai_sql, ai_answer, ai_result, gold_result, match_verdict, soft_f1,
                      error, relevant_tables, intermediate_steps, duration_ms) -> None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            INSERT INTO cell_runs (cell_id, mode, question, testset_question_id, evidence,
                                    difficulty, gold_sql, ai_sql, ai_answer, ai_result,
                                    gold_result, match_verdict, soft_f1, error, relevant_tables,
                                    intermediate_steps, duration_ms)
            VALUES (%(cell_id)s, %(mode)s, %(question)s, %(testset_question_id)s, %(evidence)s,
                    %(difficulty)s, %(gold_sql)s, %(ai_sql)s, %(ai_answer)s, %(ai_result)s,
                    %(gold_result)s, %(match_verdict)s, %(soft_f1)s, %(error)s, %(relevant_tables)s,
                    %(intermediate_steps)s, %(duration_ms)s)
            """,
            {
                "cell_id": cell_id,
                "mode": mode,
                "question": question,
                "testset_question_id": testset_question_id,
                "evidence": evidence,
                "difficulty": difficulty,
                "gold_sql": gold_sql,
                "ai_sql": ai_sql,
                "ai_answer": ai_answer,
                "ai_result": _json_param(ai_result),
                "gold_result": _json_param(gold_result),
                "match_verdict": match_verdict,
                "soft_f1": soft_f1,
                "error": error,
                "relevant_tables": _json_param(relevant_tables),
                "intermediate_steps": _json_param(intermediate_steps),
                "duration_ms": duration_ms,
            },
        )
        cur.close()
    finally:
        conn.close()


def _list_cells(mode: str | None) -> list[dict]:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        if mode:
            cur.execute("SELECT * FROM cells WHERE mode = %s ORDER BY id ASC", (mode,))
        else:
            cur.execute("SELECT * FROM cells ORDER BY id ASC")
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _get_cell(cell_id: int) -> dict | None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute("SELECT * FROM cells WHERE id = %s", (cell_id,))
        row = cur.fetchone()
        cur.close()
        return dict(row) if row else None
    finally:
        conn.close()


def _update_cell(cell_id: int, *, question, ai_sql, ai_answer, ai_result, gold_result,
                  match_verdict, soft_f1, error, relevant_tables, intermediate_steps,
                  duration_ms) -> dict:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            UPDATE cells
            SET question = %(question)s, ai_sql = %(ai_sql)s, ai_answer = %(ai_answer)s,
                ai_result = %(ai_result)s, gold_result = %(gold_result)s,
                match_verdict = %(match_verdict)s, soft_f1 = %(soft_f1)s, error = %(error)s,
                relevant_tables = %(relevant_tables)s, intermediate_steps = %(intermediate_steps)s,
                duration_ms = %(duration_ms)s,
                updated_at = now()
            WHERE id = %(id)s
            RETURNING *;
            """,
            {
                "id": cell_id,
                "question": question,
                "ai_sql": ai_sql,
                "ai_answer": ai_answer,
                "ai_result": _json_param(ai_result),
                "gold_result": _json_param(gold_result),
                "match_verdict": match_verdict,
                "soft_f1": soft_f1,
                "error": error,
                "relevant_tables": _json_param(relevant_tables),
                "intermediate_steps": _json_param(intermediate_steps),
                "duration_ms": duration_ms,
            },
        )
        row = cur.fetchone()
        cur.close()
        return dict(row)
    finally:
        conn.close()


def _delete_cell(cell_id: int) -> bool:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute("DELETE FROM cells WHERE id = %s", (cell_id,))
        deleted = cur.rowcount > 0
        cur.close()
        return deleted
    finally:
        conn.close()


@router.post("", response_model=CellOut, status_code=201)
def create_cell(payload: CellCreate):
    if payload.mode == "testset":
        item = get_testset_question(payload.testset_question_id)
        if item is None:
            raise HTTPException(404, "테스트셋 질문을 찾을 수 없습니다.")
        question = item["question"]
        evidence = item.get("evidence")
        difficulty = item.get("difficulty")
        gold_sql = item["SQL"]
    else:
        question = payload.question
        evidence = difficulty = gold_sql = None

    exec_result = execute_cell(payload.mode, question, gold_sql)

    row = _insert_cell(
        mode=payload.mode,
        question=question,
        testset_question_id=payload.testset_question_id,
        evidence=evidence,
        difficulty=difficulty,
        gold_sql=gold_sql,
        **exec_result,
    )
    _insert_cell_run(
        cell_id=row["id"],
        mode=payload.mode,
        question=question,
        testset_question_id=payload.testset_question_id,
        evidence=evidence,
        difficulty=difficulty,
        gold_sql=gold_sql,
        **exec_result,
    )
    return row


@router.get("", response_model=list[CellOut])
def list_cells_endpoint(mode: Literal["freeform", "testset"] | None = None):
    return _list_cells(mode)


@router.put("/{cell_id}", response_model=CellOut)
def update_cell(cell_id: int, payload: CellUpdate):
    existing = _get_cell(cell_id)
    if existing is None:
        raise HTTPException(404, "셀을 찾을 수 없습니다.")

    if payload.question is not None:
        if existing["mode"] != "freeform":
            raise HTTPException(400, "테스트셋 셀의 질문은 수정할 수 없습니다.")
        question = payload.question
    else:
        question = existing["question"]

    exec_result = execute_cell(existing["mode"], question, existing["gold_sql"])
    row = _update_cell(cell_id, question=question, **exec_result)
    _insert_cell_run(
        cell_id=cell_id,
        mode=existing["mode"],
        question=question,
        testset_question_id=existing["testset_question_id"],
        evidence=existing["evidence"],
        difficulty=existing["difficulty"],
        gold_sql=existing["gold_sql"],
        **exec_result,
    )
    return row


@router.delete("/{cell_id}", status_code=204)
def delete_cell_endpoint(cell_id: int):
    if not _delete_cell(cell_id):
        raise HTTPException(404, "셀을 찾을 수 없습니다.")
