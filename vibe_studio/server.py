from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.router import api_router
from .api.ws import ws_router
from .database import init_database

DIST_DIR = Path(__file__).parent / "dist"


def create_app() -> FastAPI:
    init_database()
    app = FastAPI(title="Vibe Studio", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")
    app.include_router(ws_router)

    # 前端静态文件（打包后）
    if DIST_DIR.exists():
        app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str) -> FileResponse:
            # API 路由已在前面处理，其余全部返回 index.html
            index = DIST_DIR / "index.html"
            return FileResponse(index)
    else:
        # 开发模式：没有 dist 目录时给出提示
        @app.get("/")
        async def dev_notice() -> dict:
            return {
                "status": "dev",
                "message": "前端未构建，请进入 frontend/ 目录执行 pnpm install && pnpm build",
                "api_docs": "/docs",
            }

    return app
