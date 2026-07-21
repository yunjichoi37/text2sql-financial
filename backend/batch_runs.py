# backend/batch_runs.py : 테스트셋 통합 실행(batch run) 오케스트레이션 + 조회 라우터
import time
from collections import Counter

import psycopg2.extras
from fastapi import APIRouter, BackgroundTasks, HTTPException

from agent_core import get_current_config
from backend.cells import execute_cell
from backend.db import dict_cursor, get_conn
from backend.schemas import BatchRunCreate, BatchRunDetailOut, BatchRunOut
from backend.testset import list_testset_items_by_ids


def _build_scope_label(items: list[dict]) -> str:
    counts = Counter(item.get("difficulty") or "미분류" for item in items)
    breakdown = ", ".join(f"{difficulty} {count}" for difficulty, count in counts.items())
    return f"{len(items)}문항 ({breakdown})"

router = APIRouter(prefix="/api/batch-runs", tags=["batch_runs"])


def _json_param(value):
    return psycopg2.extras.Json(value) if value is not None else None


def _insert_batch_run(label: str | None, scope: str, total_count: int, config_snapshot: dict) -> dict:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            INSERT INTO batch_runs (label, scope, total_count, config_snapshot)
            VALUES (%(label)s, %(scope)s, %(total_count)s, %(config_snapshot)s)
            RETURNING *;
            """,
            {
                "label": label,
                "scope": scope,
                "total_count": total_count,
                "config_snapshot": _json_param(config_snapshot),
            },
        )
        row = cur.fetchone()
        cur.close()
        return dict(row)
    finally:
        conn.close()


def _insert_batch_run_item(*, batch_run_id, testset_question_id, question, evidence, difficulty,
                            gold_sql, ai_sql, ai_answer, ai_result, gold_result, match_verdict,
                            soft_f1, error, relevant_tables, intermediate_steps, duration_ms) -> None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            INSERT INTO batch_run_items (batch_run_id, testset_question_id, question, evidence,
                                          difficulty, gold_sql, ai_sql, ai_answer, ai_result,
                                          gold_result, match_verdict, soft_f1, error,
                                          relevant_tables, intermediate_steps, duration_ms)
            VALUES (%(batch_run_id)s, %(testset_question_id)s, %(question)s, %(evidence)s,
                    %(difficulty)s, %(gold_sql)s, %(ai_sql)s, %(ai_answer)s, %(ai_result)s,
                    %(gold_result)s, %(match_verdict)s, %(soft_f1)s, %(error)s,
                    %(relevant_tables)s, %(intermediate_steps)s, %(duration_ms)s)
            """,
            {
                "batch_run_id": batch_run_id,
                "testset_question_id": testset_question_id,
                "question": question,
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


def _increment_completed(batch_run_id: int) -> None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            "UPDATE batch_runs SET completed_count = completed_count + 1 WHERE id = %s",
            (batch_run_id,),
        )
        cur.close()
    finally:
        conn.close()


def _finalize_batch_run(batch_run_id: int, duration_ms: int) -> None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            UPDATE batch_runs
            SET status = 'completed', finished_at = now(), duration_ms = %(duration_ms)s,
                ex_correct = sub.ex_correct, soft_f1_avg = sub.soft_f1_avg
            FROM (
                SELECT COUNT(*) FILTER (WHERE match_verdict) AS ex_correct,
                       AVG(COALESCE(soft_f1, 0)) AS soft_f1_avg
                FROM batch_run_items
                WHERE batch_run_id = %(id)s
            ) AS sub
            WHERE id = %(id)s;
            """,
            {"id": batch_run_id, "duration_ms": duration_ms},
        )
        cur.close()
    finally:
        conn.close()


def _fail_batch_run(batch_run_id: int, error: str) -> None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            "UPDATE batch_runs SET status = 'failed', error = %s, finished_at = now() WHERE id = %s",
            (error, batch_run_id),
        )
        cur.close()
    finally:
        conn.close()


def _run_batch(batch_run_id: int, items: list[dict]) -> None:
    start = time.perf_counter()
    try:
        for item in items:
            try:
                exec_result = execute_cell("testset", item["question"], item["SQL"])
                _insert_batch_run_item(
                    batch_run_id=batch_run_id,
                    testset_question_id=item["question_id"],
                    question=item["question"],
                    evidence=item.get("evidence"),
                    difficulty=item.get("difficulty"),
                    gold_sql=item["SQL"],
                    **exec_result,
                )
            except Exception as e:
                _insert_batch_run_item(
                    batch_run_id=batch_run_id,
                    testset_question_id=item["question_id"],
                    question=item["question"],
                    evidence=item.get("evidence"),
                    difficulty=item.get("difficulty"),
                    gold_sql=item.get("SQL"),
                    ai_sql=None,
                    ai_answer=None,
                    ai_result=None,
                    gold_result=None,
                    match_verdict=None,
                    soft_f1=None,
                    error=f"실행 에러: {e}",
                    relevant_tables=None,
                    intermediate_steps=None,
                    duration_ms=None,
                )
            _increment_completed(batch_run_id)

        duration_ms = round((time.perf_counter() - start) * 1000)
        _finalize_batch_run(batch_run_id, duration_ms)
    except Exception as e:
        _fail_batch_run(batch_run_id, str(e))


@router.post("", response_model=BatchRunOut, status_code=201)
def create_batch_run(payload: BatchRunCreate, background_tasks: BackgroundTasks):
    items = list_testset_items_by_ids(payload.question_ids)
    if not items:
        raise HTTPException(400, "선택된 테스트셋 문항을 찾을 수 없습니다.")

    scope = _build_scope_label(items)
    config_snapshot = get_current_config()
    row = _insert_batch_run(payload.label, scope, len(items), config_snapshot)
    background_tasks.add_task(_run_batch, row["id"], items)
    return row


@router.get("", response_model=list[BatchRunOut])
def list_batch_runs_endpoint():
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute("SELECT * FROM batch_runs ORDER BY id DESC")
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/{batch_run_id}", response_model=BatchRunDetailOut)
def get_batch_run_endpoint(batch_run_id: int):
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute("SELECT * FROM batch_runs WHERE id = %s", (batch_run_id,))
        run = cur.fetchone()
        if run is None:
            cur.close()
            raise HTTPException(404, "배치 실행을 찾을 수 없습니다.")

        cur.execute(
            "SELECT * FROM batch_run_items WHERE batch_run_id = %s ORDER BY id ASC",
            (batch_run_id,),
        )
        items = cur.fetchall()
        cur.close()
        return {**dict(run), "items": [dict(i) for i in items]}
    finally:
        conn.close()
