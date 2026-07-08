# backend/init_db.py : cells 테이블 생성 (1회 실행, 재실행해도 안전)
import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS cells (
    id                    SERIAL PRIMARY KEY,
    mode                  TEXT NOT NULL CHECK (mode IN ('freeform', 'testset')),
    question              TEXT NOT NULL,
    testset_question_id   INTEGER,
    evidence              TEXT,
    difficulty            TEXT,
    gold_sql              TEXT,
    ai_sql                TEXT,
    ai_answer             TEXT,
    ai_result             JSONB,
    gold_result           JSONB,
    match_verdict         BOOLEAN,
    error                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_cells_mode ON cells (mode);
"""


def main() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)
        cur.execute(CREATE_INDEX_SQL)
        cur.close()
        print("cells 테이블 준비 완료")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
