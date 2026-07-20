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


def _row_values(row: dict) -> list:
    """컬럼명 무시하고 값만 리스트로 추출 (요소 단위 비교용)"""
    return list(row.values())


def _row_key(row: list) -> tuple:
    """row 중복 제거용 키 (순서 무관, 문자열 정규화)"""
    return tuple(sorted(str(v) for v in row))


def _calculate_row_match(pred_row: list, gt_row: list) -> tuple[float, float, float]:
    """
    row 하나에 대해 element(값) 단위로 비교.
    반환값은 (match_pct, pred_only_pct, truth_only_pct) — 전부 gold row의 컬럼 수로 정규화.
    """
    total_gt_cols = len(gt_row)
    if total_gt_cols == 0:
        return 1.0, 0.0, 0.0

    gt_counter = Counter(gt_row)
    pred_counter = Counter(pred_row)
    matches = sum((gt_counter & pred_counter).values())

    pred_only = sum(pred_counter.values()) - matches
    truth_only = sum(gt_counter.values()) - matches

    return matches / total_gt_cols, pred_only / total_gt_cols, truth_only / total_gt_cols


def compute_soft_f1(ai_rows: list[dict] | None, gold_rows: list[dict] | None) -> float | None:
    """
    BIRD 공식 Soft F1: row 안의 개별 값(요소) 단위로 비교해서 부분 점수를 준다.
    row 전체가 정확히 일치하지 않아도(예: 컬럼 개수가 달라도), 겹치는 값이 있으면 그만큼 credit을 준다.
    둘 중 하나라도 없으면 None(미계산)을 반환한다.
    """
    if ai_rows is None or gold_rows is None:
        return None

    pred_rows = [_row_values(r) for r in ai_rows]
    gt_rows = [_row_values(r) for r in gold_rows]

    # row 중복 제거 (원본 값 타입은 유지)
    seen, pred_unique = set(), []
    for r in pred_rows:
        k = _row_key(r)
        if k not in seen:
            seen.add(k)
            pred_unique.append(r)

    seen, gt_unique = set(), []
    for r in gt_rows:
        k = _row_key(r)
        if k not in seen:
            seen.add(k)
            gt_unique.append(r)

    if not pred_unique and not gt_unique:
        return 1.0
    if not gt_unique:
        return 0.0

    tp = fp = fn = 0.0
    used_pred_idx: set[int] = set()

    # gold row마다 가장 잘 맞는 pred row를 그리디로 매칭
    for gt_row in gt_unique:
        best_score, best_idx = -1.0, -1
        for i, pred_row in enumerate(pred_unique):
            if i in used_pred_idx:
                continue
            match_pct, _, _ = _calculate_row_match(pred_row, gt_row)
            if match_pct > best_score:
                best_score, best_idx = match_pct, i

        if best_idx == -1:
            fn += 1.0
            continue

        used_pred_idx.add(best_idx)
        match_pct, pred_only_pct, truth_only_pct = _calculate_row_match(pred_unique[best_idx], gt_row)
        tp += match_pct
        fp += pred_only_pct
        fn += truth_only_pct

    # 매칭에 안 쓰인 pred row가 남으면 그만큼 fp로 반영
    fp += len(pred_unique) - len(used_pred_idx)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0

    if precision == 0.0 and recall == 0.0:
        return 0.0
    return 2 * precision * recall / (precision + recall)