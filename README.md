# Text2SQL Financial Agent

자연어 질문을 SQL로 변환해 실행하고, 결과를 표/차트로 보여주는 에이전트. [BIRD Bench](https://bird-bench.github.io/)의 `financial` 데이터베이스를 대상으로 함.

## 기술 스택

- **LLM**: Vertex AI Gemini 2.5 Flash (GCP), `langchain-google-vertexai`
- **Agent**: LangChain `create_agent` + 커스텀 SQL 실행 tool
- **DB**: PostgreSQL (Supabase), `psycopg2`로 직접 연결
- **UI**: Streamlit (`app.py`, 레거시), CLI (`run.py`), FastAPI + React(Vite) 노트북 스타일 UI (`backend/`, `frontend/`)
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

`financial/mini_dev_postgresql.json`(BIRD MiniDev, 전체 500문항)에서 `db_id == "financial"`인 32문항만 추려 `financial/bird_financial_testset.json`으로 정리해둠 (질문 + 정답 SQL + 난이도). 에이전트가 생성한 SQL과 정답 SQL의 실행 결과는 `backend/comparison.py`에서 두 지표로 비교한다:

- **EX (Execution Accuracy)** — `compare_results()`. 행 순서/컬럼명 무관하게 값 집합(멀티셋)이 완전히 일치하는지만 보는 all-or-nothing 지표. BIRD의 메인 지표.
- **Soft F1** — `compute_soft_f1()`. EX가 all-or-nothing이라 컬럼 일부만 틀려도 0점 처리되는 걸 보완하기 위한 보조 지표로, row/element 단위로 부분 점수를 준다. BIRD Mini-Dev 공식 `evaluation_f1.py`를 그대로 포팅하지 않고 두 지점을 의도적으로 바꿨다: (1) row 매칭을 공식의 positional(인덱스 순서) 방식 대신 gt row마다 가장 잘 맞는 pred row를 찾는 best-match 방식으로 — `ORDER BY` 없는 쿼리에서 값은 같은데 반환 순서만 달라 부당하게 감점되는 걸 방지, (2) row 내부 값 비교를 공식의 naive membership 체크 대신 `Counter` 교집합으로 — row 안에 중복 값이 있을 때 이중 카운트되는 공식 구현의 quirk를 회피. 따라서 이 프로젝트의 Soft F1 점수는 BIRD 공식 리더보드 수치와 bit-for-bit 일치하지 않는다. R-VES(효율성 지표)는 실행시간 노이즈가 크고 이 프로젝트의 목적(정답 여부 검증)과 맞지 않아 도입하지 않았다.

## 실행

```bash
pip install -r requirements.txt
# .env에 DATABASE_URL, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION 설정

streamlit run app.py   # 웹 UI (레거시, 채팅 형식)
python run.py          # CLI
```

### 노트북(셀) 스타일 UI — FastAPI + React

Streamlit의 "채팅 응답 대기 중 다른 인터랙션이 들어오면 응답이 끊기는" 구조적 한계를 없애고, Colab/Jupyter 노트북처럼 셀 단위로 자유 질문과 BIRD 테스트셋 질문을 실행/비교할 수 있는 새 UI. `backend/`(FastAPI)와 `frontend/`(React+Vite)로 구성되며 기존 `agent_core.py`/`metadata_loader.py`를 그대로 재사용한다.

```bash
# 최초 1회: cells 테이블 생성 (기존 Supabase Postgres 재사용)
source venv/bin/activate
python backend/init_db.py
```

백엔드와 프론트엔드는 각자 서버가 계속 떠 있어야 하는 프로세스라 **터미널 탭/창을 2개** 띄워서 각각 그대로(포그라운드로) 실행하는 걸 추천. (같은 터미널에서 `&`로 띄우고 `Ctrl+Z`를 누르면 백그라운드가 아니라 "일시정지" 상태가 되어 서버가 응답하지 않으니 주의 — 끄려면 그 창에서 `fg`로 다시 살리거나, 아예 새 창에서 그냥 실행할 것.)

```bash
# 터미널 1: 백엔드 (repo 루트에서 실행 — agent_core/metadata_loader의 상대경로 때문에 -m 필수)
source venv/bin/activate
python -m uvicorn backend.main:app --reload --port 8000
```

```bash
# 터미널 2: 프론트엔드
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"   # node가 PATH에 없으면 먼저 이거
cd frontend
npm install   # 최초 1회
npm run dev   # http://localhost:5173
```

종료는 각 터미널에서 `Ctrl+C`. (혹시 프로세스가 안 죽으면: `pkill -f "uvicorn backend.main:app"`, `pkill -f vite`)

각 셀은 자유 질문 또는 테스트셋에서 고른 질문을 실행하면 AI가 생성한 SQL과 결과를 보여주고, 테스트셋 모드는 정답 SQL/결과와 EX 일치 여부(✅/❌)를 함께 보여준다. EX가 불일치(❌)일 때는 Soft F1 점수(%)도 배지 옆에 표시해 부분적으로 얼마나 맞았는지 보여준다. 셀은 Postgres `cells` 테이블에 영속화되어 새로고침해도 남아있고, 수정 후 재실행/삭제가 가능하다. 테스트셋으로 실행한 셀만 모아보는 히스토리 탭도 있다. 차트 표시와 32문항 통합 실행은 다음 단계로 미뤄둠.

단위 테스트(`backend/comparison.py`의 EX/Soft F1 비교 로직): `pytest tests/`

## 로드맵

- BIRD Bench 정답 쿼리 기반 32문항 통합 실행 + 요약표
- 노트북 UI에 차트 표시 추가
- Streamlit 레거시 앱 정리(새 UI가 자리잡으면)
