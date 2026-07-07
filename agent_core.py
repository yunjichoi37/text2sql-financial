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
from langchain_groq import ChatGroq
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

from metadata_loader import get_relevant_tables, load_table_metadata, load_relationships

import re
import json
import pandas as pd

warnings.filterwarnings("ignore")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MAX_ROWS_IN_CONTEXT = 10       # 이 이하면 텍스트로 반환
OUTPUT_DIR = "query_outputs"    # CSV 저장 폴더
last_query_results = {"data": None}  # tool과 run_sql_agent가 공유하는 전역 상태

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

Metadata Format:
- col_name(Type) | Label | VirtualColumn | Description
"""

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
    table_files = glob.glob("filtered_metadata/tables/*.json")
    return [Path(f).stem for f in table_files]

ALL_TABLES: list[str] = get_extracted_tables()


# LLM singleton
_llm: ChatGroq | None = None
def get_llm() -> ChatGroq:
    """LLM 객체를 싱글톤으로 반환한다."""
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
            # model="openai/gpt-oss-120b",
            temperature=0,
        )
    return _llm


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
        last_query_results["data"] = results
        if len(results) <= MAX_ROWS_IN_CONTEXT:
            return str(results) # 10행 이하면 llm에 전체 결과 전달

        preview = results[:5]
        return (
            f"쿼리 결과: 총 {len(results)}행 (데이터가 많아 상위 5행만 표시)\n"
            f"{preview}"
        )

    except Exception as e:
        last_query_results["data"] = None
        return f"SQL 실행 에러: {e}\n이 에러를 바탕으로 쿼리를 수정해서 다시 시도하세요."
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


def save_csv_if_needed() -> tuple[str | None, pd.DataFrame | None]:
    """last_query_results에 데이터가 있으면 CSV로 저장하고 경로 반환"""
    
    data = last_query_results.get("data")
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
    last_query_results["data"] = None  # 다음 질문을 위해 초기화

    return csv_path, df


def build_agent_executor(dynamic_prefix: str):
    llm   = get_llm()
    tools = [execute_sql_query]

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
    llm = get_llm()
    relevant_tables = get_relevant_tables(user_input, llm, ALL_TABLES)
    table_meta = load_table_metadata(relevant_tables)
    rel_meta = load_relationships(relevant_tables)

    print(f"[TOKEN] table_meta: {count_tokens(table_meta)}")
    print(f"[TOKEN] rel_meta:   {count_tokens(rel_meta)}")
    return relevant_tables, table_meta, rel_meta

def decide_chart(df: pd.DataFrame, user_question: str) -> dict:
    """df 스키마를 보고 LLM이 차트 가능 여부와 타입을 판단한다."""
    if df is None or len(df) <= 1:
        return {"possible": False}

    llm = get_llm()

    schema_info = {
        "columns": list(df.columns),
        "dtypes":  {col: str(dtype) for col, dtype in df.dtypes.items()},
        "sample":  df.head(2).to_dict(orient="records"),
    }

    prompt = f"""아래는 SQL 쿼리 결과 데이터의 스키마입니다.
{json.dumps(schema_info, ensure_ascii=False)}

사용자 질문: {user_question}

이 데이터를 차트로 표현할 수 있나요?
가능하면 아래 JSON 형식으로만 답하세요. 다른 말은 하지 마세요.
{{"possible": true, "type": "bar", "x": "컬럼명", "y": "컬럼명"}}

type은 bar, line, pie 중 하나입니다.
불가능하면: {{"possible": false}}"""

    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        match = re.search(r'\{.*\}', response.content, re.DOTALL)
        if not match:
            return {"possible": False}

        config = json.loads(match.group())

        # 컬럼 존재 검증
        if config.get("possible"):
            # 1. 빈 문자열 체크 먼저
            if not config.get("x") or not config.get("y"):
                return {"possible": False}
            # 2. 그 다음 컬럼 존재 검증
            if config.get("x") not in df.columns or config.get("y") not in df.columns:
                return {"possible": False}
            # 3. y축 숫자 타입 검증
            if not pd.api.types.is_numeric_dtype(df[config["y"]]):
                return {"possible": False}

        return config

    except Exception:
        return {"possible": False}

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
    print(table_meta)
    print(rel_meta)

    agent_executor = build_agent_executor(dynamic_prefix) # agent 생성

    invoke_config = {}

    try:
        response = agent_executor.invoke({"messages":[HumanMessage(content=user_input)]}, invoke_config or {})
        messages = response.get("messages", [])
        answer = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and not msg.tool_calls:
                answer = msg.content
                break

        intermediate_steps = _extract_intermediate_steps(messages)
        print(f"[STEPS] 총 tool 호출 횟수: {len(intermediate_steps)}")
        
        csv_path, df     = save_csv_if_needed()
        chart_config     = decide_chart(df, user_input) if df is not None else {"possible": False}
        print(f"[CHART] chart_config: {chart_config}")

        return {
            "answer":             answer,
            "csv_path":           csv_path,
            "df":                 df,
            "chart_config":       chart_config,
            "relevant_tables":    relevant_tables,
            "table_meta":         table_meta,
            "rel_meta":           rel_meta,
            "intermediate_steps": intermediate_steps,
        }

    except Exception as e:
        last_query_results["data"] = None   # 에러 시에도 버퍼 초기화
        return {
            "answer":             "",
            "csv_path":           None,
            "df":                 None,
            "chart_config":       {"possible": False},
            "relevant_tables":    relevant_tables,
            "table_meta":         table_meta,
            "rel_meta":           rel_meta,
            "intermediate_steps": [],
            "error":              str(e),
        }