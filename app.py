# app.py : Streamlit UI 전용
import pandas as pd
import streamlit as st

from agent_core import run_query, run_raw_sql


st.set_page_config(page_title="SQL Agent", layout="wide")
st.title("SQL Agent")

with st.sidebar:
    st.subheader("SQL 직접 실행")
    raw_sql = st.text_area("SQL 입력", height=150)
    if st.button("실행", key="run_raw_sql"):
        try:
            df = run_raw_sql(raw_sql)
            st.dataframe(df)
        except Exception as e:
            st.error(f"SQL 실행 에러: {e}")

# 세션 상태 초기화 (채팅 기록 저장용)
if "messages" not in st.session_state:
    st.session_state["messages"] = [{"role": "assistant", "content": "안녕하세요! 데이터베이스에 대해 무엇이든 물어보세요."}]


def render_message(msg: dict) -> None:
    with st.chat_message(msg["role"]):
        # 1. 메타데이터 토글
        if msg.get("relevant_tables"):
            with st.expander(f"선택된 테이블 ({', '.join(msg['relevant_tables'])})", expanded=False):
                if msg.get("table_meta"):
                    st.markdown(msg["table_meta"])
                if msg.get("rel_meta"):
                    st.markdown("---")
                    st.markdown(msg["rel_meta"])


        # 2. Agent 사고 흐름 토글
        if msg.get("intermediate_steps"):
            with st.expander("Agent 사고 흐름", expanded=False):
                for step in msg["intermediate_steps"]:
                    st.markdown(f"**Tool:** `{step.get('tool', '')}`")
                    st.markdown(f"**Input:** `{step.get('input', {}).get('sql_query', step.get('input', ''))}`")
                    st.markdown(f"**결과:** {step.get('output', '')}")
                    st.markdown("---")

        # 3. 메시지 본문
        st.write(msg["content"])

        # 4. CSV 데이터프레임 복원
        if msg.get("csv_path"):
            df = pd.read_csv(msg["csv_path"])
            st.dataframe(df)

        # 5. 차트 복원
        if msg.get("csv_path") and msg.get("chart_config", {}).get("possible"):
            df          = pd.read_csv(msg["csv_path"])
            chart_config = msg["chart_config"]
            x, y        = chart_config["x"], chart_config["y"]
            chart_type  = chart_config["type"]

            st.markdown("**📊 Chart**")
            if chart_type == "bar":
                st.bar_chart(df.set_index(x)[y])
            elif chart_type == "line":
                st.line_chart(df.set_index(x)[y])
            elif chart_type == "pie":
                import plotly.express as px
                fig = px.pie(df, names=x, values=y)
                st.plotly_chart(fig)


for msg in st.session_state["messages"]:
    render_message(msg)


if user_input := st.chat_input("질문을 입력하세요..."):

    # 사용자 메시지 저장 & 표시
    st.session_state["messages"].append({"role": "user", "content": user_input})
    with st.chat_message("user"):
        st.write(user_input)

    with st.chat_message("assistant"):
        with st.spinner("데이터 조회 중입니다..."):
            result = run_query(user_input)

        if "error" in result:
            st.error(f"시스템 에러 발생: {result['error']}")
            # 에러여도 메타데이터 토글은 보여준다
            if result["relevant_tables"]:
                with st.expander(
                    f"선택된 테이블 ({', '.join(result['relevant_tables'])})", expanded=False
                ):
                    if result["table_meta"]:
                        st.markdown(result["table_meta"])
                    if result["rel_meta"]:
                        st.markdown("---")
                        st.markdown(result["rel_meta"])
        else:
            # 메타데이터 토글
            if result["relevant_tables"]:
                with st.expander(
                    f"선택된 테이블 ({', '.join(result['relevant_tables'])})", expanded=False
                ):
                    if result["table_meta"]:
                        st.markdown(result["table_meta"])
                    if result["rel_meta"]:
                        st.markdown("---")
                        st.markdown(result["rel_meta"])
            else:
                st.info("관련 테이블을 찾지 못했습니다.")

            # Agent 사고 흐름 토글 (실시간 콜백 이후 요약본)
            if result["intermediate_steps"]:
                with st.expander("Agent 사고 흐름", expanded=False):
                    for step in result["intermediate_steps"]:
                        st.markdown(f"**Tool:** `{step.get('tool', '')}`")
                        st.markdown(f"**Input:** `{step.get('input', {}).get('sql_query', step.get('input', ''))}`")
                        st.markdown(f"**결과:** {step.get('output', '')}")
                        st.markdown("---")

            # 답변
            st.write(result["answer"].replace("\n", "  \n"))

            # CSV
            if result["csv_path"]:
                st.success(f"결과가 CSV로 저장되었습니다: `{result['csv_path']}`")
                df = result["df"]
                st.dataframe(df)

            # 차트 렌더링 (CSV 블록 바로 아래)
            chart_config = result.get("chart_config", {})
            df = result.get("df")
            if chart_config.get("possible"):
                x, y      = chart_config["x"], chart_config["y"]
                chart_type = chart_config["type"]

                st.markdown("**📊 Chart**")
                if chart_type == "bar":
                    st.bar_chart(df.set_index(x)[y])
                elif chart_type == "line":
                    st.line_chart(df.set_index(x)[y])
                elif chart_type == "pie":
                    import plotly.express as px
                    fig = px.pie(df, names=x, values=y)
                    st.plotly_chart(fig)

        # 세션에 저장 (에러 포함)
        st.session_state["messages"].append({
            "role":               "assistant",
            "content":            result.get("answer", result.get("error", "")),
            "csv_path":           result.get("csv_path"),
            "relevant_tables":    result.get("relevant_tables", []),
            "table_meta":         result.get("table_meta", ""),
            "rel_meta":           result.get("rel_meta", ""),
            "intermediate_steps": result.get("intermediate_steps", []),
            "chart_config":       result.get("chart_config", {"possible": False}),
        })