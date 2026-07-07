# run.py - CLI 진입점 전용
import os
from dotenv import load_dotenv
load_dotenv()

from agent_core import run_query


def check_env() -> None:
    required = ["DATABASE_URL", "GROQ_API_KEY"]
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        raise EnvironmentError(f"환경변수 누락: {missing}")



def main() -> None:
    check_env()
    print("SQL Agent (터미널 모드)")
    print("종료하려면 'exit' 또는 'quit' 입력\n")
 
    while True:
        user_input = input("질문: ").strip()
        if user_input.lower() in ("exit", "quit"):
            print("채팅 종료")
            break
        if not user_input:
            continue
 
        result = run_query(user_input)
 
        print(f"\n[선택된 테이블] {result['relevant_tables']}")
 
        if not result["relevant_tables"]:
            print("관련 테이블을 찾지 못했습니다.")
            print("-" * 60)
            continue
 
        if "error" in result:
            print(f"\n시스템 에러: {result['error']}\n")
        else:
            print(f"\n답변:\n{result['answer']}\n")
            if result["csv_path"]:
                print(f"[CSV 저장 완료] {result['csv_path']}")
 
        print("-" * 60)
 
 
if __name__ == "__main__":
    main()