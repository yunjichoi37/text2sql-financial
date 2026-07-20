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

MIGRATE_ADD_AGENT_INFO_COLUMNS_SQL = """
ALTER TABLE cells
    ADD COLUMN IF NOT EXISTS relevant_tables JSONB,
    ADD COLUMN IF NOT EXISTS intermediate_steps JSONB;
"""

MIGRATE_ADD_DURATION_MS_COLUMN_SQL = """
ALTER TABLE cells
    ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
"""

CREATE_TABLE_CELL_RUNS_SQL = """
CREATE TABLE IF NOT EXISTS cell_runs (
    id                    SERIAL PRIMARY KEY,
    cell_id               INTEGER REFERENCES cells(id) ON DELETE SET NULL,
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
    relevant_tables       JSONB,
    intermediate_steps    JSONB,
    duration_ms           INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_INDEX_CELL_RUNS_SQL = """
CREATE INDEX IF NOT EXISTS idx_cell_runs_cell_id ON cell_runs (cell_id);
CREATE INDEX IF NOT EXISTS idx_cell_runs_created_at ON cell_runs (created_at);
CREATE INDEX IF NOT EXISTS idx_cell_runs_mode ON cell_runs (mode);
"""

BACKFILL_CELL_RUNS_SQL = """
INSERT INTO cell_runs (cell_id, mode, question, testset_question_id, evidence, difficulty,
                        gold_sql, ai_sql, ai_answer, ai_result, gold_result, match_verdict,
                        error, relevant_tables, intermediate_steps, duration_ms, created_at)
SELECT c.id, c.mode, c.question, c.testset_question_id, c.evidence, c.difficulty,
       c.gold_sql, c.ai_sql, c.ai_answer, c.ai_result, c.gold_result, c.match_verdict,
       c.error, c.relevant_tables, c.intermediate_steps, c.duration_ms, c.updated_at
FROM cells c
WHERE NOT EXISTS (SELECT 1 FROM cell_runs cr WHERE cr.cell_id = c.id);
"""


def main() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)
        cur.execute(CREATE_INDEX_SQL)
        cur.execute(MIGRATE_ADD_AGENT_INFO_COLUMNS_SQL)
        cur.execute(MIGRATE_ADD_DURATION_MS_COLUMN_SQL)
        cur.execute(CREATE_TABLE_CELL_RUNS_SQL)
        cur.execute(CREATE_INDEX_CELL_RUNS_SQL)
        cur.execute(BACKFILL_CELL_RUNS_SQL)
        cur.close()
        print("cells / cell_runs 테이블 준비 완료")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
