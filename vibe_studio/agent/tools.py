"""
Agent 工具集
每个工具：定义（OpenAI tool format） + 执行函数
"""
from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Any

# ──────────────────────────────────────────────
# 工具定义（OpenAI function calling 格式）
# ──────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "读取文件内容。返回文件的完整文本。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径（相对于工作区根目录）"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "写入或创建文件。会完整替换文件内容。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"},
                    "content": {"type": "string", "description": "要写入的完整文件内容"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "str_replace",
            "description": "精确替换文件中的一段文本。old_string 必须在文件中唯一存在。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"},
                    "old_string": {"type": "string", "description": "要被替换的原始文本"},
                    "new_string": {"type": "string", "description": "替换后的新文本"},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "列出目录中的文件和子目录。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "目录路径，默认为工作区根目录"},
                    "recursive": {"type": "boolean", "description": "是否递归列出，默认 false"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "在工作区内搜索文件内容（使用 grep）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "搜索的正则表达式或关键词"},
                    "path": {"type": "string", "description": "搜索目录，默认工作区根目录"},
                    "file_pattern": {"type": "string", "description": "文件名匹配模式，如 '*.py'"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "bash_exec",
            "description": "在工作区目录执行 shell 命令。返回 stdout、stderr 和退出码。",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "要执行的 shell 命令"},
                },
                "required": ["command"],
            },
        },
    },
]


# ──────────────────────────────────────────────
# 工具执行函数
# ──────────────────────────────────────────────

class ToolExecutor:
    def __init__(self, workspace: str) -> None:
        self.workspace = Path(workspace).resolve()

    def _safe_path(self, path: str) -> Path:
        """确保路径在工作区内（防止路径穿越）"""
        p = (self.workspace / path).resolve()
        if not str(p).startswith(str(self.workspace)):
            raise ValueError(f"路径越界: {path}")
        return p

    async def execute(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """执行工具，返回结果 dict"""
        handler = getattr(self, f"_tool_{tool_name}", None)
        if not handler:
            return {"error": f"未知工具: {tool_name}"}
        try:
            result = await handler(**args)
            return result
        except Exception as e:
            return {"error": str(e)}

    async def _tool_read_file(self, path: str) -> dict:
        p = self._safe_path(path)
        if not p.exists():
            return {"error": f"文件不存在: {path}"}
        if p.stat().st_size > 1024 * 1024:  # 1MB 限制
            return {"error": "文件过大（>1MB），请用 search_files 定位具体内容"}
        content = p.read_text(encoding="utf-8", errors="replace")
        return {"content": content, "path": str(p.relative_to(self.workspace))}

    async def _tool_write_file(self, path: str, content: str) -> dict:
        p = self._safe_path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        old_content = p.read_text(encoding="utf-8", errors="replace") if p.exists() else None
        p.write_text(content, encoding="utf-8")
        return {
            "success": True,
            "path": str(p.relative_to(self.workspace)),
            "old_content": old_content,
            "new_content": content,
        }

    async def _tool_str_replace(self, path: str, old_string: str, new_string: str) -> dict:
        p = self._safe_path(path)
        if not p.exists():
            return {"error": f"文件不存在: {path}"}
        content = p.read_text(encoding="utf-8", errors="replace")
        count = content.count(old_string)
        if count == 0:
            return {"error": "未找到要替换的文本，请检查 old_string 是否正确"}
        if count > 1:
            return {"error": f"找到 {count} 处匹配，old_string 必须唯一，请提供更多上下文"}
        new_content = content.replace(old_string, new_string, 1)
        p.write_text(new_content, encoding="utf-8")
        return {
            "success": True,
            "path": str(p.relative_to(self.workspace)),
            "old_content": content,
            "new_content": new_content,
        }

    async def _tool_list_files(self, path: str = ".", recursive: bool = False) -> dict:
        p = self._safe_path(path)
        if not p.exists():
            return {"error": f"目录不存在: {path}"}

        IGNORE = {".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".next"}

        def _list(base: Path, depth: int = 0) -> list[dict]:
            items = []
            try:
                entries = sorted(base.iterdir(), key=lambda x: (x.is_file(), x.name))
            except PermissionError:
                return items
            for entry in entries:
                if entry.name.startswith(".") or entry.name in IGNORE:
                    continue
                rel = str(entry.relative_to(self.workspace))
                item: dict[str, Any] = {
                    "name": entry.name,
                    "path": rel,
                    "type": "file" if entry.is_file() else "directory",
                }
                if entry.is_dir() and recursive and depth < 5:
                    item["children"] = _list(entry, depth + 1)
                items.append(item)
            return items

        return {"files": _list(p), "path": str(p.relative_to(self.workspace))}

    async def _tool_search_files(
        self, pattern: str, path: str = ".", file_pattern: str = ""
    ) -> dict:
        search_path = self._safe_path(path)
        cmd = ["grep", "-rn", "--include=" + (file_pattern or "*"), pattern, str(search_path)]
        try:
            result = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.workspace),
            )
            stdout, _ = await asyncio.wait_for(result.communicate(), timeout=10)
            lines = stdout.decode("utf-8", errors="replace").strip().splitlines()[:50]
            return {"matches": lines, "count": len(lines)}
        except asyncio.TimeoutError:
            return {"error": "搜索超时"}
        except Exception as e:
            return {"error": str(e)}

    async def _tool_bash_exec(self, command: str) -> dict:
        try:
            result = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.workspace),
            )
            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=30)
            return {
                "stdout": stdout.decode("utf-8", errors="replace")[:5000],
                "stderr": stderr.decode("utf-8", errors="replace")[:2000],
                "exit_code": result.returncode,
            }
        except asyncio.TimeoutError:
            return {"error": "命令执行超时（30s）"}
        except Exception as e:
            return {"error": str(e)}
