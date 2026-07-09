# agent_core.py
"""
백엔드 핵심 로직:
- DB 연결 및 SQL 실행 (execute_sql_query tool)
- CSV 저장
- LLM / Agent 생성 및 실행
- 메타데이터 로딩 위임 (metadata_loader)
- 모듈 레벨 싱글톤으로 LLM 객체 1회 생성 → 성능 유지
"""

import os
import csv
import glob
import warnings
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_google_vertexai import ChatVertexAI
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from metadata_loader import get_relevant_tables, load_table_metadata, load_relationships

import pandas as pd

warnings.filterwarnings("ignore")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GCP_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GCP_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

MAX_ROWS_IN_CONTEXT = 10       # 이 이하면 텍스트로 반환
OUTPUT_DIR = "query_outputs"    # CSV 저장 폴더

USE_TABLE_FILTERING = True   # 테이블 수 적을 때(현재 8개)는 LLM 호출 없이 전체 테이블 사용. 나중에 늘어나면 True로 전환.

# IMPORTANT: When filtering a TEXT column against a literal value, you MUST use a case-insensitive comparison (ILIKE, or LOWER(col) = LOWER('value')) instead of '='. Never use '=' for TEXT literal filters — the exact casing stored in the database may differ from the casing in the question.
AGENT_PREFIX = """You are a SQL expert connected to a PostgreSQL database.

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

Metadata Format:
- Each table starts with [Table: table_name]
- Each column is listed as "col_name (type): description"
- If a column has an indented "values:" line below it, that line lists the possible values or format notes for that column verbatim — read it carefully before filtering/comparing on that column.
- [Joins] section (if present) lists the recommended JOIN conditions between the selected tables.
"""

QUERY_REMINDER = "\n\nReminder: use ILIKE (never '=') for any TEXT column literal comparison."

# ------------- 로그 관련 설정  -------------
import sys

os.makedirs("logs", exist_ok=True)
log_filename = datetime.now().strftime("logs/%Y%m%d_%H%M%S.log")

class DualLogger:
    """터미널 출력과 파일 저장을 동시에 수행하는 로거 클래스"""
    def __init__(self, filename):
        self.terminal = sys.stdout
        self.log = open(filename, "a", encoding="utf-8")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)
        self.log.flush()  # 버퍼에 머물지 않고 즉시 파일에 쓰도록 설정

    def flush(self):
        self.terminal.flush()
        self.log.flush()

# 표준 출력과 에러 출력을 DualLogger로 리다이렉션
sys.stdout = DualLogger(log_filename)
sys.stderr = sys.stdout
# -----------------------------------------


def get_extracted_tables() -> list[str]:
    table_files = glob.glob("metadata/tables/*.json")
    return [Path(f).stem for f in table_files]

ALL_TABLES: list[str] = get_extracted_tables()


# LLM singleton
_llm: ChatVertexAI | None = None
def get_llm() -> ChatVertexAI:
    """LLM 객체를 싱글톤으로 반환한다."""
    global _llm
    if _llm is None:
        _llm = ChatVertexAI(
            model_name="gemini-2.5-flash",
            project=GCP_PROJECT,
            location=GCP_LOCATION,
            temperature=0,
        )
    return _llm


def make_execute_sql_query_tool(results_holder: dict):
    """
    execute_sql_query 툴을 만들어 반환한다. results_holder는 이 호출(run_query 한 번) 전용으로
    새로 만들어진 dict여야 한다 — LangGraph는 tool을 호출한 스레드와 다른 스레드에서 실행할 수 있어서
    (threading.local 등 스레드 단위 저장으로는 값이 전달되지 않음이 확인됨), 매 run_query 호출마다
    독립된 dict 객체를 클로저로 캡처해 공유 전역 상태 없이 결과를 전달한다.
    """

    @tool
    def execute_sql_query(sql_query: str) -> str:
        """
        PostgreSQL(Supabase) 데이터베이스에 SQL 쿼리를 실행하고 결과를 반환한다.
        결과가 100행 이하면 텍스트로 반환하고, 100행 초과면 CSV 파일로 저장 후 경로와 미리보기를 반환한다.
        (CSV는 답변 완성 후 자동 저장)
        """
        conn = None
        cursor = None
        try:
            conn = psycopg2.connect(DATABASE_URL)
            conn.autocommit = True
            cursor = conn.cursor() # cursor 객체 생성
            cursor.execute(sql_query) # cursor가 DB에서 쿼리를 실행시킨다. 실행 후 cursor는 결과 집합의 첫 번째 행을 가리키게 된다.

            if cursor.description is None:
                return "실행 완료 (반환된 데이터 없음)"

            columns = [col[0] for col in cursor.description] # cursor의 metadata인 description에서 컬럼 이름을 추출한다.
            rows = cursor.fetchall() # fetch + all: 남은 데이터를 모두 가져온다.
            results = [dict(zip(columns, row)) for row in rows]

            from decimal import Decimal
            results = [
                {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}
                for row in results
            ]

            # 4. 행 수에 따라 분기
            results_holder["data"] = results
            if len(results) <= MAX_ROWS_IN_CONTEXT:
                return str(results) # 10행 이하면 llm에 전체 결과 전달

            preview = results[:5]
            return (
                f"쿼리 결과: 총 {len(results)}행 (데이터가 많아 상위 5행만 표시)\n"
                f"{preview}"
            )

        except Exception as e:
            results_holder["data"] = None
            return f"SQL 실행 에러: {e}\n이 에러를 바탕으로 쿼리를 수정해서 다시 시도하세요."
        finally:
            if cursor is not None:
                cursor.close()
            if conn is not None:
                conn.close()

    return execute_sql_query


def run_raw_sql(sql_query: str) -> pd.DataFrame:
    """사용자가 직접 입력한 SQL을 실행하고 결과를 DataFrame으로 반환(AI 개입 없음)"""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        conn.autocommit = True
        return pd.read_sql_query(sql_query, conn)
    finally:
        conn.close()


def save_csv_if_needed(results_holder: dict) -> tuple[str | None, pd.DataFrame | None]:
    """results_holder에 데이터가 있으면 CSV로 저장하고 경로 반환"""

    data = results_holder.get("data")
    if not data:
        return None, None

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = os.path.join(OUTPUT_DIR, f"result_{timestamp}.csv")

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    df = pd.DataFrame(data)
    results_holder["data"] = None  # 다음 질문을 위해 초기화

    return csv_path, df


def build_agent_executor(dynamic_prefix: str, results_holder: dict):
    llm   = get_llm()
    tools = [make_execute_sql_query_tool(results_holder)]

    return create_agent(model=llm, tools=tools, system_prompt=dynamic_prefix)


def _extract_intermediate_steps(messages: list) -> list:
    steps = []
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                steps.append({"tool": tc["name"], "input": tc["args"]})
        elif isinstance(msg, ToolMessage):
            if steps:
                steps[-1]["output"] = msg.content
    return steps


import tiktoken
enc = tiktoken.get_encoding("cl100k_base")
def count_tokens(text: str) -> int:
    return len(enc.encode(text))

def load_metadata_for_query(user_input: str) -> tuple[list[str], str, str]:
    """
    사용자 질문에서 관련 테이블을 찾고 메타데이터를 로드한다.
    Returns: (relevant_tables, table_meta, rel_meta)
    """
    if USE_TABLE_FILTERING:
        llm = get_llm()
        relevant_tables = get_relevant_tables(user_input, llm, ALL_TABLES)
    else:
        relevant_tables = ALL_TABLES

    table_meta = load_table_metadata(relevant_tables)
    rel_meta = load_relationships(relevant_tables)

    print(f"[TOKEN] table_meta: {count_tokens(table_meta)}")
    print(f"[TOKEN] rel_meta:   {count_tokens(rel_meta)}")
    return relevant_tables, table_meta, rel_meta

def run_query(user_input: str) -> dict:
    """
    사용자 질문 하나를 처리하고 결과 dict를 반환한다.
    """
    relevant_tables, table_meta, rel_meta = load_metadata_for_query(user_input)

    dynamic_prefix = AGENT_PREFIX
    if table_meta:
        dynamic_prefix += f"\n\n{table_meta}"
    if rel_meta:
        dynamic_prefix += f"\n\n{rel_meta}"
    dynamic_prefix += QUERY_REMINDER
    print(table_meta)
    print(rel_meta)

    results_holder = {"data": None}  # 이 run_query 호출 전용 결과 컨테이너
    agent_executor = build_agent_executor(dynamic_prefix, results_holder) # agent 생성

    invoke_config = {}

    try:
        response = agent_executor.invoke({"messages":[HumanMessage(content=user_input)]}, invoke_config or {})
        messages = response.get("messages", [])
        answer = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and not msg.tool_calls:
                answer = msg.text
                break

        intermediate_steps = _extract_intermediate_steps(messages)
        print(f"[STEPS] 총 tool 호출 횟수: {len(intermediate_steps)}")

        csv_path, df     = save_csv_if_needed(results_holder)

        return {
            "answer":             answer,
            "csv_path":           csv_path,
            "df":                 df,
            "relevant_tables":    relevant_tables,
            "table_meta":         table_meta,
            "rel_meta":           rel_meta,
            "intermediate_steps": intermediate_steps,
        }

    except Exception as e:
        results_holder["data"] = None   # 에러 시에도 버퍼 초기화
        return {
            "answer":             "",
            "csv_path":           None,
            "df":                 None,
            "relevant_tables":    relevant_tables,
            "table_meta":         table_meta,
            "rel_meta":           rel_meta,
            "intermediate_steps": [],
            "error":              str(e),
        }