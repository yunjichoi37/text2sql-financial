# Text2SQL Financial Agent

자연어 질문을 SQL로 변환해 실행하고, 결과를 표/차트로 보여주는 에이전트. [BIRD Bench](https://bird-bench.github.io/)의 `financial` 데이터베이스를 대상으로 함.

## 기술 스택

- **LLM**: Vertex AI Gemini 2.5 Flash (GCP), `langchain-google-vertexai`
- **Agent**: LangChain `create_agent` + 커스텀 SQL 실행 tool
- **DB**: PostgreSQL (Supabase), `psycopg2`로 직접 연결
- **UI**: Streamlit (`app.py`), CLI (`run.py`)
- **차트**: Streamlit 내장 차트 + Plotly(pie)

## 동작 방식

1. **테이블 필터링** (`metadata_loader.get_relevant_tables`): 질문이 들어오면 LLM이 각 테이블의 요약/컬럼명만 보고 이번 질문에 필요한 테이블을 먼저 골라낸다. 테이블 수가 적을 때는 `USE_TABLE_FILTERING = False`로 끄고 전체 메타데이터를 그대로 사용할 수 있음.
2. **메타데이터 주입**: 선택된 테이블의 컬럼 설명, 값 형식, 추천 JOIN 조건(`metadata/relationships.json`, 직접 연결 없으면 최대 2홉 BFS로 경유 경로 탐색)을 프롬프트에 포함해 에이전트가 정확한 컬럼명/조인으로 쿼리를 짜도록 유도.
3. **SQL 실행** (`execute_sql_query` tool): 에이전트가 생성한 SQL을 Postgres에서 실행. 결과가 10행 이하면 텍스트로 그대로 반환, 초과하면 상위 5행만 미리보기로 주고 전체 결과는 CSV로 저장.
4. **차트 자동 판단** (`decide_chart`): 쿼리 결과 스키마를 LLM에 보여주고 bar/line/pie 중 표현 가능한 차트가 있는지 판단.
5. **SQL 직접 실행 셀**: 사이드바에서 에이전트 개입 없이 사용자가 SQL을 직접 입력해 바로 실행/확인 가능 (`run_raw_sql`).

## 메타데이터 생성

`financial/database_description/*.csv` (BIRD 제공 스키마 설명)와 `financial.sqlite`의 FK 제약을 각각 변환해 사용:

- `scripts/build_tables.py` → `metadata/tables/*.json` (테이블별 컬럼 설명/값 형식)
- `scripts/build_relationships.py` → `metadata/relationships.json` (JOIN 관계)

## 벤치마크 테스트셋

`financial/mini_dev_postgresql.json`(BIRD MiniDev, 전체 500문항)에서 `db_id == "financial"`인 32문항만 추려 `financial/bird_financial_testset.json`으로 정리해둠 (질문 + 정답 SQL +난이도). 향후 에이전트가 생성한 SQL과 정답 SQL의 실행 결과를 비교하는 평가 기능에 사용 예정.

## 실행

```bash
pip install -r requirements.txt
# .env에 DATABASE_URL, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION 설정

streamlit run app.py   # 웹 UI
python run.py          # CLI
```

## 로드맵

- Streamlit → React(Vite) + FastAPI로 전환 (현재 Streamlit 구조에서는 세션당 스크립트가 하나만 실행되어, 채팅 응답 대기 중 다른 인터랙션이 들어오면 응답이 취소되는 한계가 있음)
- BIRD Bench 정답 쿼리 기반 평가 대시보드 추가
