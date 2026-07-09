# backend/schemas.py : /api/cells 요청/응답 모델
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator


class CellCreate(BaseModel):
    mode: Literal["freeform", "testset"]
    question: str | None = None
    testset_question_id: int | None = None

    @model_validator(mode="after")
    def validate_mode_fields(self):
        if self.mode == "freeform":
            if not self.question or not self.question.strip():
                raise ValueError("freeform 모드는 question이 필요합니다.")
            if self.testset_question_id is not None:
                raise ValueError("freeform 모드에는 testset_question_id를 보낼 수 없습니다.")
        else:
            if self.testset_question_id is None:
                raise ValueError("testset 모드는 testset_question_id가 필요합니다.")
        return self


class CellUpdate(BaseModel):
    question: str | None = None


class CellOut(BaseModel):
    id: int
    mode: str
    question: str
    testset_question_id: int | None = None
    evidence: str | None = None
    difficulty: str | None = None
    gold_sql: str | None = None
    ai_sql: str | None = None
    ai_answer: str | None = None
    ai_result: list[dict] | None = None
    gold_result: list[dict] | None = None
    match_verdict: bool | None = None
    error: str | None = None
    relevant_tables: list[str] | None = None
    intermediate_steps: list[dict] | None = None
    created_at: datetime
    updated_at: datetime


class TableColumnInfo(BaseModel):
    type: str | None = None
    desc: str | None = None
    values: str | None = None


class TableInfo(BaseModel):
    name: str
    summary: str | None = None
    columns: dict[str, TableColumnInfo]
    notes: str | None = None


class TableRowsResponse(BaseModel):
    rows: list[dict]
    total: int
    page: int
    page_size: int
