# backend/main.py : FastAPI 앱 진입점
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend import cells, testset

app = FastAPI(title="Text2SQL Financial Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(testset.router)
app.include_router(cells.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
