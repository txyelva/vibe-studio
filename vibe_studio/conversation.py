from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from .config import CONFIG_DIR

CONVERSATIONS_DIR = CONFIG_DIR / "conversations"


@dataclass
class ConversationMessage:
    role: str
    content: str | list[dict]
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Conversation:
    id: str
    title: str
    created_at: str
    updated_at: str
    project_id: str | None = None  # 关联的项目ID
    messages: list[dict] = field(default_factory=list)
    model: str | None = None  # 该对话使用的模型 (provider/model_id)，为 None 时使用主模型

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "project_id": self.project_id,
            "messages": self.messages,
            "model": self.model,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Conversation":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            title=data.get("title", "新对话"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            project_id=data.get("project_id"),
            messages=data.get("messages", []),
            model=data.get("model"),
        )


def _conversation_path(conv_id: str) -> Path:
    return CONVERSATIONS_DIR / f"{conv_id}.json"


def list_conversations(project_id: str | None = None) -> list[Conversation]:
    """列出所有对话，按更新时间倒序。如果指定 project_id，只返回该项目的对话"""
    if not CONVERSATIONS_DIR.exists():
        return []
    conversations = []
    for f in CONVERSATIONS_DIR.glob("*.json"):
        try:
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
            conv = Conversation.from_dict(data)
            # 如果没指定 project_id，返回所有；否则只返回匹配的
            if project_id is None or conv.project_id == project_id:
                conversations.append(conv)
        except Exception:
            continue
    conversations.sort(key=lambda c: c.updated_at, reverse=True)
    return conversations


def get_conversation(conv_id: str) -> Optional[Conversation]:
    path = _conversation_path(conv_id)
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Conversation.from_dict(data)
    except Exception:
        return None


def create_conversation(title: str = "新对话", project_id: str | None = None, model: str | None = None) -> Conversation:
    now = datetime.now().isoformat()
    conv = Conversation(
        id=str(uuid.uuid4()),
        title=title,
        created_at=now,
        updated_at=now,
        project_id=project_id,
        messages=[],
        model=model,
    )
    save_conversation(conv)
    return conv


def save_conversation(conv: Conversation) -> None:
    CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = _conversation_path(conv.id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(conv.to_dict(), f, ensure_ascii=False, indent=2)


def delete_conversation(conv_id: str) -> bool:
    path = _conversation_path(conv_id)
    if path.exists():
        path.unlink()
        return True
    return False


def update_conversation_title(conv_id: str, title: str) -> Optional[Conversation]:
    conv = get_conversation(conv_id)
    if not conv:
        return None
    conv.title = title
    conv.updated_at = datetime.now().isoformat()
    save_conversation(conv)
    return conv


def append_messages(conv_id: str, messages: list[dict]) -> Optional[Conversation]:
    """追加消息到对话末尾"""
    conv = get_conversation(conv_id)
    if not conv:
        return None
    conv.messages.extend(messages)
    conv.updated_at = datetime.now().isoformat()
    save_conversation(conv)
    return conv


def generate_conversation_title(messages: list[dict], max_length: int = 30) -> str:
    """根据消息内容生成对话标题"""
    if not messages:
        return "新对话"
    
    # 找到第一条用户消息
    first_user_msg = None
    for m in messages:
        if isinstance(m, dict) and m.get("role") == "user":
            content = m.get("content", "")
            if isinstance(content, str) and content.strip():
                first_user_msg = content.strip()
                break
    
    if not first_user_msg:
        return "新对话"
    
    # 取前 max_length 个字符，去掉换行
    title = first_user_msg.replace("\n", " ").replace("\r", "")
    if len(title) > max_length:
        title = title[:max_length] + "..."
    
    return title if title else "新对话"
