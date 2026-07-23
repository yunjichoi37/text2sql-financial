# backend/agent_settings.py : 에이전트 설정(singleton row) 조회/수정 + 미리보기
import time

from fastapi import APIRouter, HTTPException

from agent_core import run_query
from backend.db import dict_cursor, get_conn
from backend.schemas import (
    AgentSettingsOut,
    AgentSettingsPreviewOut,
    AgentSettingsPreviewRequest,
    AgentSettingsUpdate,
)
from backend.utils import extract_last_sql, to_jsonable_records

router = APIRouter(prefix="/api/agent-settings", tags=["agent_settings"])


def _get_settings() -> dict | None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute("SELECT * FROM agent_settings WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        return dict(row) if row else None
    finally:
        conn.close()


def _update_settings(payload: AgentSettingsUpdate) -> dict | None:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute(
            """
            UPDATE agent_settings
            SET temperature = COALESCE(%(temperature)s, temperature),
                use_table_filtering = COALESCE(%(use_table_filtering)s, use_table_filtering),
                use_evidence = COALESCE(%(use_evidence)s, use_evidence),
                agent_prefix = COALESCE(%(agent_prefix)s, agent_prefix),
                query_reminder = COALESCE(%(query_reminder)s, query_reminder),
                updated_at = now()
            WHERE id = 1
            RETURNING *;
            """,
            payload.model_dump(),
        )
        row = cur.fetchone()
        cur.close()
        return dict(row) if row else None
    finally:
        conn.close()


@router.get("", response_model=AgentSettingsOut)
def get_agent_settings():
    row = _get_settings()
    if row is None:
        raise HTTPException(404, "에이전트 설정을 찾을 수 없습니다.")
    return row


@router.put("", response_model=AgentSettingsOut)
def update_agent_settings(payload: AgentSettingsUpdate):
    row = _update_settings(payload)
    if row is None:
        raise HTTPException(404, "에이전트 설정을 찾을 수 없습니다.")
    return row


@router.post("/preview", response_model=AgentSettingsPreviewOut)
def preview_agent_settings(payload: AgentSettingsPreviewRequest):
    """저장 전 설정값으로 질문 하나를 실제 실행해본다. cells/cell_runs에는 기록되지 않는다."""
    current = _get_settings()
    if current is None:
        raise HTTPException(404, "에이전트 설정을 찾을 수 없습니다.")

    overrides = payload.model_dump(exclude={"question", "evidence"}, exclude_none=True)
    settings = {**current, **overrides}

    start = time.perf_counter()
    try:
        result = run_query(payload.question, payload.evidence, settings=settings)
    except Exception as e:
        return {
            "ai_sql": None,
            "ai_answer": None,
            "ai_result": None,
            "relevant_tables": None,
            "intermediate_steps": None,
            "error": str(e),
            "duration_ms": round((time.perf_counter() - start) * 1000),
        }
    duration_ms = round((time.perf_counter() - start) * 1000)

    if result.get("error"):
        return {
            "ai_sql": None,
            "ai_answer": None,
            "ai_result": None,
            "relevant_tables": result.get("relevant_tables"),
            "intermediate_steps": result.get("intermediate_steps"),
            "error": result["error"],
            "duration_ms": duration_ms,
        }

    intermediate_steps = result.get("intermediate_steps")
    return {
        "ai_sql": extract_last_sql(intermediate_steps or []),
        "ai_answer": result.get("answer"),
        "ai_result": to_jsonable_records(result.get("df")),
        "relevant_tables": result.get("relevant_tables"),
        "intermediate_steps": intermediate_steps,
        "error": None,
        "duration_ms": duration_ms,
    }
