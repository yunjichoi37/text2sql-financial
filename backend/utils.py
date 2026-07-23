# backend/utils.py : DataFrame -> JSON 안전한 list[dict] 변환
from decimal import Decimal

import numpy as np
import pandas as pd


def _json_safe(value):
    if isinstance(value, np.generic):
        value = value.item()
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def to_jsonable_records(df: pd.DataFrame | None) -> list[dict] | None:
    """pandas DataFrame을 JSONB 컬럼에 그대로 넣을 수 있는 list[dict]로 변환한다."""
    if df is None:
        return None
    records = df.to_dict(orient="records")
    return [{k: _json_safe(v) for k, v in row.items()} for row in records]


def extract_last_sql(intermediate_steps: list[dict]) -> str | None:
    """intermediate_steps에서 가장 마지막에 실행된 SQL 쿼리를 추출한다."""
    for step in reversed(intermediate_steps):
        if step.get("tool") == "execute_sql_query":
            sql = step.get("input", {}).get("sql_query")
            if sql:
                return sql
    return None
