# scripts/build_tables.py
# financial/database_description/*.csv -> metadata/tables/*.json 변환

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "financial" / "database_description"
OUTPUT_DIR = ROOT / "metadata" / "tables"

def convert_table(csv_path: Path) -> dict:
    columns = {}
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            col_name = row["original_column_name"].strip()

            name = (row.get("column_name") or "").strip()
            description = (row.get("column_description") or "").strip()
            if name and description:
                desc = name if name.lower() == description.lower() else f"{name}, {description}"
            else:
                desc = description or name

            data_format = (row.get("data_format") or "").strip()
            value_desc = (row.get("value_description") or "").strip()

            entry = {"type": data_format, "desc": desc}
            if value_desc:
                entry["values"] = value_desc

            columns[col_name] = entry

    return {"summary": "", "columns": columns, "notes": ""}

def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for csv_path in sorted(CSV_DIR.glob("*.csv")):
        table = convert_table(csv_path)
        out_path = OUTPUT_DIR / f"{csv_path.stem}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(table, f, ensure_ascii=False, indent=2)
        print(f"{csv_path.name} -> {out_path}")

if __name__ == "__main__":
    main()