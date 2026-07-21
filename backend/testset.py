# backend/testset.py : BIRD financial 테스트셋 로드/캐시 + 목록 조회 라우터
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

TESTSET_PATH = Path(__file__).resolve().parent.parent / "financial" / "bird_financial_testset.json"

router = APIRouter(prefix="/api/testset", tags=["testset"])

_testset_cache: list[dict] | None = None


def load_testset() -> list[dict]:
    global _testset_cache
    if _testset_cache is None:
        with open(TESTSET_PATH, "r", encoding="utf-8") as f:
            _testset_cache = json.load(f)
    return _testset_cache


def get_testset_question(question_id: int) -> dict | None:
    for item in load_testset():
        if item["question_id"] == question_id:
            return item
    return None


def list_testset_items_by_ids(question_ids: list[int]) -> list[dict]:
    """배치 실행용: 지정된 question_id들의 항목(gold SQL 포함)을 반환한다."""
    id_set = set(question_ids)
    return [item for item in load_testset() if item["question_id"] in id_set]


@router.get("")
def list_testset() -> list[dict]:
    return [
        {
            "question_id": item["question_id"],
            "question": item["question"],
            "difficulty": item.get("difficulty"),
        }
        for item in load_testset()
    ]
