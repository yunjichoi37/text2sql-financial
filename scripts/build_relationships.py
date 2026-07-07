# scripts/build_relationships.py
# financial.sqlite의 FK 제약을 읽어 metadata/relationships.json으로 저장한다.

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "financial" / "financial.sqlite"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "metadata" / "relationships.json"

def build_relationships() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]

    relationships = []
    for table in tables:
        cur.execute(f'PRAGMA foreign_key_list("{table}")')
        for _, _, to_table, from_col, to_col, *_ in cur.fetchall():
            relationships.append({
                "from_table": table,
                "from_col": from_col,
                "to_table": to_table,
                "to_col": to_col,
            })

    conn.close()
    return relationships

def main() -> None:
    relationships = build_relationships()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(relationships, f, ensure_ascii=False, indent=2)
    print(f"{len(relationships)}개 관계를 {OUTPUT_PATH}에 저장했습니다.")


if __name__ == "__main__":
    main()