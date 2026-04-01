"""REST API 路由：模型管理、文件操作、配置"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..config import BUILTIN_PROVIDERS, ProviderConfig, load_config, save_config
from ..conversation import (
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    update_conversation_title,
    append_messages,
)
from .auth import router as auth_router
from .models import router as models_router

api_router = APIRouter()

# 包含认证路由
api_router.include_router(auth_router)
api_router.include_router(models_router)


# ──────────────────────────────────────────────
# 配置 & 模型
# ──────────────────────────────────────────────

class SetupRequest(BaseModel):
    provider_id: str
    model_id: str
    api_key: str
    workspace: str = ""


class ProviderRequest(BaseModel):
    provider_id: str
    name: str
    base_url: str
    api_type: str  # "openai" | "anthropic"
    api_key: str
    models: list[dict] = []


@api_router.get("/config")
async def get_config() -> dict:
    cfg = load_config()
    return {
        "setup_complete": cfg.setup_complete,
        "primary_model": cfg.primary_model,
        "fallback_models": cfg.fallback_models,
        "workspace": cfg.workspace,
        "providers": cfg.providers,
    }


@api_router.post("/setup")
async def complete_setup(req: SetupRequest) -> dict:
    """首次配置向导完成"""
    cfg = load_config()

    # 查找内置 provider 预设
    builtin = BUILTIN_PROVIDERS.get(req.provider_id)
    if not builtin:
        return {"success": False, "error": f"未知 provider_id: {req.provider_id}"}

    cfg.providers[req.provider_id] = {
        "name": builtin["name"],
        "base_url": builtin["base_url"],
        "api_type": builtin["api_type"],
        "api_key": req.api_key,
        "models": builtin["models"],
    }

    cfg.primary_model = f"{req.provider_id}/{req.model_id}"
    if req.workspace:
        cfg.workspace = str(Path(req.workspace).resolve())
    cfg.setup_complete = True
    save_config(cfg)
    return {"success": True, "primary_model": cfg.primary_model}


@api_router.get("/providers/builtin")
async def get_builtin_providers() -> dict:
    return {"providers": BUILTIN_PROVIDERS}


@api_router.post("/providers")
async def add_provider(req: ProviderRequest) -> dict:
    """添加自定义 provider"""
    cfg = load_config()
    cfg.providers[req.provider_id] = {
        "name": req.name,
        "base_url": req.base_url,
        "api_type": req.api_type,
        "api_key": req.api_key,
        "models": req.models,
    }
    save_config(cfg)
    return {"success": True}


@api_router.delete("/providers/{provider_id}")
async def remove_provider(provider_id: str) -> dict:
    """删除自定义 provider"""
    cfg = load_config()
    if provider_id in cfg.providers:
        del cfg.providers[provider_id]
        save_config(cfg)
    return {"success": True}


@api_router.post("/config/model")
async def set_primary_model(body: dict) -> dict:
    """设置主模型"""
    cfg = load_config()
    cfg.primary_model = body.get("model", cfg.primary_model)
    cfg.fallback_models = body.get("fallbacks", cfg.fallback_models)
    save_config(cfg)
    return {"success": True, "primary_model": cfg.primary_model}


# ──────────────────────────────────────────────
# 文件操作
# ──────────────────────────────────────────────

class FileNode(BaseModel):
    name: str
    path: str
    type: str  # "file" | "dir"
    children: list["FileNode"] = []


def _build_tree(path: Path, workspace: Path, depth: int = 0, max_depth: int = 5) -> list[dict]:
    """递归构建目录树，限制深度和隐藏文件"""
    if depth > max_depth:
        return []
    items: list[dict] = []
    try:
        for entry in sorted(path.iterdir(), key=lambda e: (e.is_file(), e.name.lower())):
            if entry.name.startswith("."):
                continue
            rel = entry.relative_to(workspace)
            node: dict = {"name": entry.name, "path": str(rel), "type": "dir" if entry.is_dir() else "file"}
            if entry.is_dir():
                children = _build_tree(entry, workspace, depth + 1, max_depth)
                if children:
                    node["children"] = children
            items.append(node)
    except PermissionError:
        pass
    return items


@api_router.get("/files")
async def list_files(path: str = ".") -> dict:
    cfg = load_config()
    workspace = Path(cfg.workspace).resolve()
    target = (workspace / path).resolve()
    if not str(target).startswith(str(workspace)):
        raise HTTPException(403, "路径越界")
    if not target.exists():
        raise HTTPException(404, f"路径不存在: {path}")

    if target.is_file():
        return {"type": "file", "path": path, "tree": []}

    tree = _build_tree(target, workspace)
    return {"type": "dir", "path": path, "tree": tree, "workspace": str(workspace)}


@api_router.get("/files/read")
async def read_file(path: str) -> dict:
    cfg = load_config()
    workspace = Path(cfg.workspace).resolve()
    target = (workspace / path).resolve()

    if not str(target).startswith(str(workspace)):
        raise HTTPException(403, "路径越界")
    if not target.exists():
        raise HTTPException(404, f"文件不存在: {path}")

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        return {"content": content, "path": path}
    except Exception as e:
        raise HTTPException(500, str(e))


@api_router.post("/config/workspace")
async def set_workspace(body: dict) -> dict:
    workspace = body.get("workspace", "")
    if not workspace or not Path(workspace).exists():
        raise HTTPException(400, "目录不存在")
    cfg = load_config()
    cfg.workspace = str(Path(workspace).resolve())
    save_config(cfg)
    return {"success": True, "workspace": cfg.workspace}


# ──────────────────────────────────────────────
# 对话历史
# ──────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    title: str = "新对话"
    project_id: str | None = None
    model: str | None = None  # 可选，指定模型 (provider/model_id)，不指定则使用主模型


class UpdateTitleRequest(BaseModel):
    title: str


@api_router.get("/conversations")
async def get_conversations(project_id: str | None = None) -> dict:
    """获取对话列表，支持按 project_id 筛选"""
    conversations = list_conversations(project_id)
    return {
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
                "project_id": c.project_id,
                "message_count": len(c.messages),
                "model": c.model,
            }
            for c in conversations
        ]
    }


@api_router.post("/conversations")
async def post_create_conversation(req: CreateConversationRequest) -> dict:
    conv = create_conversation(req.title, req.project_id, req.model)
    return {"success": True, "conversation": conv.to_dict()}


@api_router.get("/conversations/{conv_id}")
async def get_conversation_detail(conv_id: str) -> dict:
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "对话不存在")
    return {"conversation": conv.to_dict()}


@api_router.delete("/conversations/{conv_id}")
async def del_conversation(conv_id: str) -> dict:
    ok = delete_conversation(conv_id)
    return {"success": ok}


@api_router.patch("/conversations/{conv_id}/title")
async def patch_conversation_title(conv_id: str, req: UpdateTitleRequest) -> dict:
    conv = update_conversation_title(conv_id, req.title)
    if not conv:
        raise HTTPException(404, "对话不存在")
    return {"success": True, "conversation": conv.to_dict()}


@api_router.post("/conversations/{conv_id}/messages")
async def post_append_messages(conv_id: str, body: dict) -> dict:
    messages = body.get("messages", [])
    conv = append_messages(conv_id, messages)
    if not conv:
        raise HTTPException(404, "对话不存在")
    return {"success": True, "conversation": conv.to_dict()}


# ──────────────────────────────────────────────
# 项目管理
# ──────────────────────────────────────────────

import uuid
from datetime import datetime, timezone


class CreateProjectRequest(BaseModel):
    name: str
    path: str
    model: str


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    path: str | None = None
    model: str | None = None


@api_router.get("/projects")
async def get_projects() -> dict:
    cfg = load_config()
    return {"projects": cfg.projects}


@api_router.post("/projects")
async def create_new_project(req: CreateProjectRequest) -> dict:
    """创建新项目"""
    cfg = load_config()
    project = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "path": str(Path(req.path).resolve()),
        "model": req.model,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    cfg.projects.append(project)
    # 自动切换到新项目
    cfg.workspace = project["path"]
    cfg.primary_model = project["model"]
    save_config(cfg)
    return {"success": True, "project": project}


@api_router.get("/projects/{project_id}")
async def get_project_detail(project_id: str) -> dict:
    cfg = load_config()
    for p in cfg.projects:
        if p["id"] == project_id:
            return {"project": p}
    raise HTTPException(404, "项目不存在")


@api_router.patch("/projects/{project_id}")
async def update_project(project_id: str, req: UpdateProjectRequest) -> dict:
    cfg = load_config()
    for p in cfg.projects:
        if p["id"] == project_id:
            if req.name is not None:
                p["name"] = req.name
            if req.path is not None:
                p["path"] = str(Path(req.path).resolve())
            if req.model is not None:
                p["model"] = req.model
            save_config(cfg)
            return {"success": True, "project": p}
    raise HTTPException(404, "项目不存在")


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str) -> dict:
    cfg = load_config()
    original_len = len(cfg.projects)
    cfg.projects = [p for p in cfg.projects if p["id"] != project_id]
    if len(cfg.projects) == original_len:
        raise HTTPException(404, "项目不存在")
    # 如果删的是当前 workspace 对应的项目，切换到第一个剩余项目
    if cfg.projects:
        cfg.workspace = cfg.projects[0]["path"]
        cfg.primary_model = cfg.projects[0]["model"]
    save_config(cfg)
    return {"success": True}


@api_router.post("/projects/{project_id}/switch")
async def switch_project(project_id: str) -> dict:
    cfg = load_config()
    for p in cfg.projects:
        if p["id"] == project_id:
            cfg.workspace = p["path"]
            cfg.primary_model = p["model"]
            save_config(cfg)
            return {"success": True, "project": p}
    raise HTTPException(404, "项目不存在")


# ──────────────────────────────────────────────
# 工具发现 (AI CLI 工具)
# ──────────────────────────────────────────────

def check_command_exists(cmd: str) -> bool:
    """检查命令是否存在"""
    try:
        result = subprocess.run(
            ["which", cmd],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False


def get_home_path() -> Path:
    """获取用户 home 目录"""
    return Path.home()


@api_router.get("/discover-tools")
async def discover_local_tools() -> dict:
    """发现本地已安装的 AI CLI 工具"""
    home = get_home_path()
    tools = []
    
    # 定义要检测的工具
    tool_definitions = [
        {
            "id": "openclaw",
            "name": "OpenClaw",
            "description": "开源的 AI 编程助手",
            "icon": "🦞",
            "config_dirs": [".openclaw"],
            "commands": ["openclaw"],
            "workspace_paths": [".openclaw/workspace"],
        },
        {
            "id": "codex",
            "name": "OpenAI Codex",
            "description": "OpenAI 的 AI 编程助手",
            "icon": "🤖",
            "config_dirs": [".codex", ".config/codex"],
            "commands": ["codex"],
            "workspace_paths": [],
        },
        {
            "id": "claude",
            "name": "Claude Code",
            "description": "Anthropic 的 Claude 编程助手",
            "icon": "🧠",
            "config_dirs": [".claude", ".claude-code"],
            "commands": ["claude"],
            "workspace_paths": [],
        },
        {
            "id": "kimi",
            "name": "Kimi CLI",
            "description": "Moonshot 的 Kimi 命令行工具",
            "icon": "🌙",
            "config_dirs": [".kimi", ".config/kimi"],
            "commands": ["kimi"],
            "workspace_paths": [],
        },
        {
            "id": "vibe-studio",
            "name": "Vibe Studio",
            "description": "当前正在使用的 Vibe Studio",
            "icon": "🎵",
            "config_dirs": [".vibe-studio"],
            "commands": [],
            "workspace_paths": [".vibe-studio"],
            "always_present": True,
        },
        {
            "id": "cursor",
            "name": "Cursor",
            "description": "AI 驱动的代码编辑器",
            "icon": "✨",
            "config_dirs": [".cursor"],
            "commands": [],
            "workspace_paths": [],
        },
        {
            "id": "windsurf",
            "name": "Windsurf",
            "description": "Codeium 的 AI IDE",
            "icon": "🏄",
            "config_dirs": [".windsurf"],
            "commands": [],
            "workspace_paths": [],
        },
        {
            "id": "aider",
            "name": "Aider",
            "description": "AI 辅助编程工具",
            "icon": "🤝",
            "config_dirs": [".aider"],
            "commands": ["aider"],
            "workspace_paths": [],
        },
    ]
    
    for tool in tool_definitions:
        is_installed = False
        install_path = None
        
        # 检查是否是当前项目（Vibe Studio）
        if tool.get("always_present"):
            is_installed = True
            install_path = str(home / ".vibe-studio")
        else:
            # 检查配置目录
            for config_dir in tool.get("config_dirs", []):
                full_path = home / config_dir
                if full_path.exists():
                    is_installed = True
                    install_path = str(full_path)
                    break
            
            # 检查命令是否存在
            if not is_installed:
                for cmd in tool.get("commands", []):
                    if check_command_exists(cmd):
                        is_installed = True
                        # 尝试找到实际路径
                        try:
                            result = subprocess.run(
                                ["which", cmd],
                                capture_output=True,
                                text=True,
                                timeout=5
                            )
                            if result.returncode == 0:
                                install_path = result.stdout.strip()
                        except:
                            pass
                        break
        
        tools.append({
            "id": tool["id"],
            "name": tool["name"],
            "description": tool["description"],
            "icon": tool["icon"],
            "is_installed": is_installed,
            "install_path": install_path,
        })
    
    return {"tools": tools}


@api_router.post("/import-from-tool")
async def import_from_tool(body: dict) -> dict:
    """从其他 AI 工具导入项目"""
    tool_id = body.get("tool_id")
    cfg = load_config()
    home = get_home_path()
    
    if tool_id == "openclaw":
        # 从 OpenClaw 导入
        openclaw_workspace = home / ".openclaw" / "workspace"
        if openclaw_workspace.exists():
            # 查找 OpenClaw 的项目
            projects = []
            for item in openclaw_workspace.iterdir():
                if item.is_dir() and not item.name.startswith("."):
                    projects.append({
                        "name": item.name,
                        "path": str(item),
                    })
            return {"success": True, "projects": projects}
    
    elif tool_id == "vibe-studio":
        # 当前项目
        if cfg.workspace and cfg.workspace != str(Path.cwd()):
            return {"success": True, "projects": [{"name": "当前项目", "path": cfg.workspace}]}
    
    return {"success": True, "projects": []}
