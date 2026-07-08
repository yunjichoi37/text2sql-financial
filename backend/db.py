# backend/db.py : cells 테이블용 psycopg2 연결 헬퍼
import psycopg2
import psycopg2.extras

from agent_core import DATABASE_URL


def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
