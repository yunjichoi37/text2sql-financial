# backend/cell_runs.py : cell_runs(append-only 실행 기록) 조회 라우터
from fastapi import APIRouter

from backend.db import dict_cursor, get_conn
from backend.schemas import CellRunOut

router = APIRouter(prefix="/api/cell-runs", tags=["cell_runs"])


def _list_cell_runs() -> list[dict]:
    conn = get_conn()
    try:
        cur = dict_cursor(conn)
        cur.execute("SELECT * FROM cell_runs ORDER BY id ASC")
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("", response_model=list[CellRunOut])
def list_cell_runs_endpoint():
    return _list_cell_runs()
