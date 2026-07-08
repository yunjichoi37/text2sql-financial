# tests/test_comparison.py
from backend.comparison import compare_results


def test_identical_rows_different_order():
    ai = [{"a": 1}, {"a": 2}]
    gold = [{"a": 2}, {"a": 1}]
    assert compare_results(ai, gold) is True


def test_different_column_order_within_row():
    ai = [{"a": 1, "b": 2}]
    gold = [{"b": 2, "a": 1}]
    assert compare_results(ai, gold) is True


def test_different_column_names_same_values():
    ai = [{"count": 5}]
    gold = [{"total_count": 5}]
    assert compare_results(ai, gold) is True


def test_float_rounding_noise():
    ai = [{"avg": 3.14159265}]
    gold = [{"avg": 3.14159264}]
    assert compare_results(ai, gold) is True


def test_duplicate_row_count_mismatch():
    ai = [{"a": 1}, {"a": 1}]
    gold = [{"a": 1}]
    assert compare_results(ai, gold) is False


def test_value_mismatch():
    ai = [{"a": 1}]
    gold = [{"a": 2}]
    assert compare_results(ai, gold) is False


def test_none_when_ai_rows_missing():
    assert compare_results(None, [{"a": 1}]) is None


def test_none_when_gold_rows_missing():
    assert compare_results([{"a": 1}], None) is None


def test_empty_results_match():
    assert compare_results([], []) is True
