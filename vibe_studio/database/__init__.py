"""
Minimal database bootstrap used by the runtime.

The public repo still stores app config as JSON, but we keep the same
startup database initialization path as the live app so local runs don't
drift and SQLite is configured compatibly with SQLAlchemy 2.x.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

DEFAULT_DB_PATH = Path.home() / ".vibe-studio" / "vibe_studio.db"
DATABASE_URL = os.environ.get(
    "VIBE_STUDIO_DATABASE_URL",
    f"sqlite:///{DEFAULT_DB_PATH}",
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_database() -> None:
    """Create the runtime database and apply SQLite pragmas safely."""
    if DATABASE_URL.startswith("sqlite"):
        db_path = Path(DATABASE_URL.replace("sqlite:///", ""))
        db_path.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)

    if DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            conn.execute(text("PRAGMA foreign_keys = ON"))
            conn.execute(text("PRAGMA journal_mode = WAL"))


@contextmanager
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_session() -> Session:
    return SessionLocal()


__all__ = [
    "engine",
    "SessionLocal",
    "get_db",
    "get_db_session",
    "init_database",
    "Base",
]
