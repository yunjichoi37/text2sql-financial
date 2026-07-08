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
