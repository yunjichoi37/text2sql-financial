import json
from collections import deque
from pathlib import Path
from langchain_core.messages import HumanMessage

METADATA_DIR = Path("metadata/tables")
RELATIONSHIPS_PATH = Path("metadata/relationships.json")
DOMAIN_GUIDE_PATH = Path("metadata/domain_guide.txt")

def get_relevant_tables(user_question: str, llm, all_tables: list) -> list:
    # 1단계: 각 테이블의 summary만 보고 필요한 테이블 선택
    # 메타 파일 없으면 테이블명만으로 fallback
    domain_guide = ""
    if DOMAIN_GUIDE_PATH.exists():
        domain_guide = DOMAIN_GUIDE_PATH.read_text(encoding="utf-8")

    table_summaries = []
    for table in all_tables:
        json_path = METADATA_DIR / f"{table}.json"
        if json_path.exists():
            with open(json_path, "r", encoding="utf-8-sig") as f:
                meta = json.load(f)
            summary = meta.get("summary") or "설명 없음"
        else:
            summary = "(메타데이터 없음)"
        table_summaries.append(f"- {table}: {summary}")

    prompt = f"""{domain_guide}

아래는 데이터베이스 테이블 목록과 각 테이블의 간단한 설명입니다.

{chr(10).join(table_summaries)}

사용자 질문: {user_question}

이 질문에 답하려면 어떤 테이블이 필요한가요?
테이블 이름만 쉼표로 구분해서 답하세요. 다른 말은 하지 마세요.
예시: product, customer"""

    response = llm.invoke([HumanMessage(content=prompt)])
    selected = [t.strip() for t in response.content.split(",")]
    return [t for t in selected if t in all_tables]


def _render_column(col: str, meta: dict) -> str:
    """
    columns[col] = {"type": ..., "desc": ..., "values": ...} 형식의 dict를
    "- col (type): desc" (+ values가 있으면 다음 줄에 "    values: ...") 로 렌더링한다.
    """
    col_type = meta.get("type", "")
    desc = meta.get("desc", "")

    line = f"- {col} ({col_type}): {desc}" if desc else f"- {col} ({col_type})"

    values = meta.get("values")
    if values:
        line += f"\n    values: {values}"

    return line


def load_table_metadata(relevant_tables: list) -> str:
    # 2단계: 선택된 테이블의 세부 메타 정보 로드
    
    if not relevant_tables:
        return ""

    lines = []

    for table in relevant_tables:
        json_path = METADATA_DIR / f"{table}.json"
        if not json_path.exists():
            lines.append(f"[Table: {table}]")
            lines.append("  (메타데이터 파일 없음)")
            lines.append("")
            continue

        with open(json_path, "r", encoding="utf-8-sig") as f:
            meta = json.load(f)

        summary = meta.get("summary", "")
        header  = f"[Table: {summary} ({table})]" if summary else f"[Table: {table}]"
        lines.append(header)

        for col, col_meta in meta.get("columns", {}).items():
            lines.append(_render_column(col, col_meta))

        # notes 는 값이 있을 때만 출력
        if meta.get("notes"):
            lines.append(f"Notes: {meta['notes']}")

        lines.append("")  # 테이블 간 빈 줄

    return "\n".join(lines).rstrip()


def _build_graph(all_rels: list) -> dict:
    """관계 리스트로 양방향 인접 그래프 구성"""
    graph = {}
    for r in all_rels:
        frm, to = r["from_table"], r["to_table"]
        graph.setdefault(frm, []).append((to, r))
        graph.setdefault(to, []).append((frm, r))
    return graph

def _find_join_path_bfs(start_tables: list, all_rels: list, max_hops: int = 2) -> list:
    """
    선택된 테이블들 사이의 연결 경로를 BFS로 탐색.
    max_hops: 경유 가능한 최대 홉 수 (2 = 중간 테이블 1개 경유)
 
    직접 연결(AND 교집합)이 없을 때만 호출하는 보완용 함수.
    """

    graph = _build_graph(all_rels)
    target_set = set(start_tables)
    visited_rel_keys = set()
    result_rels = []

    for start in start_tables:
        # (현재 노드, 현재까지 홉 수)
        queue = deque([(start, 0)])
        visited_nodes = {start}

        while queue:
            node, hops = queue.popleft()

            if hops >= max_hops:
                continue

            for neighbor, rel in graph.get(node, []):
                rel_key = (
                    rel["from_table"],
                    rel["from_col"],
                    rel["to_table"],
                    rel["to_col"],
                )

                # 이웃이 선택된 테이블 중 하나일 때만 관계 수집
                if neighbor in target_set and rel_key not in visited_rel_keys:
                    visited_rel_keys.add(rel_key)
                    result_rels.append(rel)

                if neighbor not in visited_nodes:
                    visited_nodes.add(neighbor)
                    queue.append((neighbor, hops + 1))
 
    return result_rels

def load_relationships(relevant_tables: list) -> str:
    # 3단계: 선택된 테이블 간 관계 로드
    # 우선순위 1: 직접 연결(AND 교집합) → 없으면 BFS(max_hops=2) 보완

    if not RELATIONSHIPS_PATH.exists() or not relevant_tables:
        return ""

    with open(RELATIONSHIPS_PATH, "r", encoding="utf-8-sig") as f:
        all_rels = json.load(f)

    relevant_set = set(relevant_tables)

    # 1순위: from, to 둘 다 선택된 테이블인 관계만 (직접 연결)
    filtered = [
        r for r in all_rels
        if r.get("from_table") in relevant_set
        and r.get("to_table") in relevant_set
        and r.get("from_table") != r.get("to_table") # self join 제외
    ]

    # 직접 연결 없으면 BFS로 중간 경유 경로 탐색 (최대 2홉)
    if not filtered:
        print("[관계 탐색] 직접 연결 없음 → BFS 보완 (max_hops=2)")
        filtered = _find_join_path_bfs(relevant_tables, all_rels, max_hops=2)

    if not filtered:
        return ""

    lines = ["[Joins]"]
    for r in filtered:
        lines.append(
            f"{r['from_table']} LEFT JOIN {r['to_table']} "
            f"ON {r['from_table']}.{r['from_col']} = {r['to_table']}.{r['to_col']}"
        )

    return "\n".join(lines)