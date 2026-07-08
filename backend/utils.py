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
