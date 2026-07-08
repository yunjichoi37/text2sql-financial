# backend/comparison.py : AI 결과와 정답 결과를 순서/컬럼명 무관하게 비교
from collections import Counter

ROUND_NDIGITS = 6


def _normalize_value(value):
    if isinstance(value, float):
        return round(value, ROUND_NDIGITS)
    if isinstance(value, str):
        return value.strip()
    return value


def _normalize_row(row: dict) -> tuple:
    normalized = sorted(
        (_normalize_value(v) for v in row.values()),
        key=lambda v: (v is None, str(type(v)), str(v)),
    )
    return tuple(normalized)


def compare_results(ai_rows: list[dict] | None, gold_rows: list[dict] | None) -> bool | None:
    """
    AI가 만든 SQL의 결과와 정답 SQL의 결과를 비교한다.
    행 순서, 행 내부 컬럼 순서, 컬럼명은 무관하게 값 집합만 비교(멀티셋 비교).
    둘 중 하나라도 없으면(에이전트 에러 등) None(미계산)을 반환한다.
    """
    if ai_rows is None or gold_rows is None:
        return None

    ai_counter = Counter(_normalize_row(row) for row in ai_rows)
    gold_counter = Counter(_normalize_row(row) for row in gold_rows)

    return ai_counter == gold_counter
