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

MIGRATE_ADD_SOFT_F1_COLUMN_SQL = """
ALTER TABLE cells
    ADD COLUMN IF NOT EXISTS soft_f1 DOUBLE PRECISION;
"""

MIGRATE_ADD_CELL_RUNS_SOFT_F1_COLUMN_SQL = """
ALTER TABLE cell_runs
    ADD COLUMN IF NOT EXISTS soft_f1 DOUBLE PRECISION;
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
                        error, relevant_tables, intermediate_steps, duration_ms, soft_f1, created_at)
SELECT c.id, c.mode, c.question, c.testset_question_id, c.evidence, c.difficulty,
       c.gold_sql, c.ai_sql, c.ai_answer, c.ai_result, c.gold_result, c.match_verdict,
       c.error, c.relevant_tables, c.intermediate_steps, c.duration_ms, c.soft_f1, c.updated_at
FROM cells c
WHERE NOT EXISTS (SELECT 1 FROM cell_runs cr WHERE cr.cell_id = c.id);
"""

CREATE_TABLE_BATCH_RUNS_SQL = """
CREATE TABLE IF NOT EXISTS batch_runs (
    id              SERIAL PRIMARY KEY,
    label           TEXT,
    scope           TEXT NOT NULL DEFAULT 'all',
    status          TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','failed')),
    total_count     INTEGER NOT NULL,
    completed_count INTEGER NOT NULL DEFAULT 0,
    ex_correct      INTEGER,
    soft_f1_avg     DOUBLE PRECISION,
    config_snapshot JSONB,
    duration_ms     INTEGER,
    error           TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);
"""

CREATE_TABLE_BATCH_RUN_ITEMS_SQL = """
CREATE TABLE IF NOT EXISTS batch_run_items (
    id                    SERIAL PRIMARY KEY,
    batch_run_id          INTEGER NOT NULL REFERENCES batch_runs(id) ON DELETE CASCADE,
    testset_question_id   INTEGER NOT NULL,
    question              TEXT NOT NULL,
    evidence              TEXT,
    difficulty            TEXT,
    gold_sql              TEXT,
    ai_sql                TEXT,
    ai_answer             TEXT,
    ai_result             JSONB,
    gold_result           JSONB,
    match_verdict         BOOLEAN,
    soft_f1               DOUBLE PRECISION,
    error                 TEXT,
    relevant_tables       JSONB,
    intermediate_steps    JSONB,
    duration_ms           INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

CREATE_INDEX_BATCH_RUNS_SQL = """
CREATE INDEX IF NOT EXISTS idx_batch_run_items_batch_run_id ON batch_run_items (batch_run_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_started_at ON batch_runs (started_at);
"""

CREATE_TABLE_AGENT_SETTINGS_SQL = """
CREATE TABLE IF NOT EXISTS agent_settings (
    id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    temperature          DOUBLE PRECISION NOT NULL DEFAULT 0,
    use_table_filtering  BOOLEAN NOT NULL DEFAULT false,
    use_evidence         BOOLEAN NOT NULL DEFAULT true,
    agent_prefix         TEXT NOT NULL DEFAULT '',
    query_reminder       TEXT NOT NULL DEFAULT '',
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

SEED_AGENT_SETTINGS_SQL = """
INSERT INTO agent_settings (id, temperature, use_table_filtering, use_evidence, agent_prefix, query_reminder)
VALUES (1, %s, %s, %s, %s, %s)
ON CONFLICT (id) DO NOTHING;
"""

# agent_core.py의 기존 AGENT_PREFIX/QUERY_REMINDER 값을 최초 1회 시드용으로 복사한 것.
# 이후로는 이 값이 아니라 agent_settings 테이블(웹 UI로 편집)이 진짜 값의 출처가 된다.
_SEED_AGENT_PREFIX = """You are a SQL expert connected to a PostgreSQL database.

Rules:
1. Always use standard PostgreSQL syntax.
2. Use the 'execute_sql_query' tool to fetch data.
3. Always verify column names with the provided metadata below before writing a query.
4. Only use the available tables and columns. Never assume or invent names.
5. Do NOT use markdown code blocks inside the tool input, pass the raw string.
6. Report query results as facts. Do NOT add disclaimers or caveats.
7. If the result shows only a preview, inform the user that the full data will be saved as a CSV file automatically.
8. Always alias aggregate functions. (e.g. COUNT(*) AS count, SUM(amount) AS total)
9. When filtering a TEXT column against a literal value, use a case-insensitive comparison (ILIKE, or LOWER(col) = LOWER('value')) instead of '=', since the exact casing stored in the database may differ from the casing in the question.
10. If the question refers to a concept that has no exactly matching column, but a related column exists per its metadata description (e.g. an aggregate/summary field), use that column as a best-effort proxy instead of refusing to answer.
11. If the question is accompanied by an 'Evidence' hint, treat it as authoritative domain guidance for interpreting the question — even if it seems to conflict with your own reading of the schema. Follow it exactly.
12. For "highest X and lowest Y"-style questions, rank with ORDER BY col1, col2 LIMIT 1 rather than combining independent WHERE col = MIN(...) conditions with AND, which often returns 0 rows.

Metadata Format:
- Each table starts with [Table: table_name]
- Each column is listed as "col_name (type): description"
- If a column has an indented "values:" line below it, that line lists the possible values or format notes for that column verbatim — read it carefully before filtering/comparing on that column.
- [Joins] section (if present) lists the recommended JOIN conditions between the selected tables.
"""

_SEED_QUERY_REMINDER = "\n\nReminder: use ILIKE (never '=') for any TEXT column literal comparison."


def main() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(CREATE_TABLE_SQL)
        cur.execute(CREATE_INDEX_SQL)
        cur.execute(MIGRATE_ADD_AGENT_INFO_COLUMNS_SQL)
        cur.execute(MIGRATE_ADD_DURATION_MS_COLUMN_SQL)
        cur.execute(MIGRATE_ADD_SOFT_F1_COLUMN_SQL)
        cur.execute(CREATE_TABLE_CELL_RUNS_SQL)
        cur.execute(CREATE_INDEX_CELL_RUNS_SQL)
        cur.execute(MIGRATE_ADD_CELL_RUNS_SOFT_F1_COLUMN_SQL)
        cur.execute(BACKFILL_CELL_RUNS_SQL)
        cur.execute(CREATE_TABLE_BATCH_RUNS_SQL)
        cur.execute(CREATE_TABLE_BATCH_RUN_ITEMS_SQL)
        cur.execute(CREATE_INDEX_BATCH_RUNS_SQL)
        cur.execute(CREATE_TABLE_AGENT_SETTINGS_SQL)
        cur.execute(
            SEED_AGENT_SETTINGS_SQL,
            (0, False, True, _SEED_AGENT_PREFIX, _SEED_QUERY_REMINDER),
        )
        cur.close()
        print("cells / cell_runs / batch_runs / batch_run_items / agent_settings 테이블 준비 완료")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
