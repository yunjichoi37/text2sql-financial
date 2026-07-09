# backend/tables.py : DB 테이블 메타데이터 조회 + row 페이지네이션
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from agent_core import ALL_TABLES, run_raw_sql
from backend.schemas import TableInfo, TableRowsResponse
from backend.utils import to_jsonable_records

router = APIRouter(prefix="/api/tables", tags=["tables"])

METADATA_DIR = Path("metadata/tables")


def _load_table_info(name: str) -> TableInfo:
    with open(METADATA_DIR / f"{name}.json", encoding="utf-8") as f:
        data = json.load(f)
    return TableInfo(
        name=name,
        summary=data.get("summary") or None,
        columns=data.get("columns", {}),
        notes=data.get("notes") or None,
    )


@router.get("", response_model=list[TableInfo])
def list_tables():
    return [_load_table_info(name) for name in sorted(ALL_TABLES)]


@router.get("/{table_name}/rows", response_model=TableRowsResponse)
def get_table_rows(table_name: str, page: int = 1, page_size: int = 50):
    if table_name not in ALL_TABLES:
        raise HTTPException(404, "존재하지 않는 테이블입니다.")
    if page < 1:
        raise HTTPException(400, "page는 1 이상이어야 합니다.")
    if not (1 <= page_size <= 200):
        raise HTTPException(400, "page_size는 1~200 사이여야 합니다.")

    # table_name은 위에서 ALL_TABLES(파일시스템 기반 화이트리스트) 검증을 통과한 값만
    # SQL에 들어가므로 인젝션 위험 없음. page/page_size는 FastAPI가 int로 강제 변환함.
    total = int(run_raw_sql(f"SELECT COUNT(*) AS count FROM {table_name}").iloc[0]["count"])
    offset = (page - 1) * page_size
    df = run_raw_sql(f"SELECT * FROM {table_name} LIMIT {page_size} OFFSET {offset}")

    return TableRowsResponse(
        rows=to_jsonable_records(df),
        total=total,
        page=page,
        page_size=page_size,
    )
