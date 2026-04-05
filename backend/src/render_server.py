"""
Backend server for PDF rendering and LM Studio proxy.
Run: uv run python backend/src/render_server.py
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pdf_routes import router as pdf_router
from lmstudio_routes import router as lmstudio_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router)
app.include_router(lmstudio_router)

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=5174)
