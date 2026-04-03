"""
Agent Loop
处理一次用户请求：LLM → 工具调用 → 结果回传 → 循环，直到 LLM 停止调用工具
通过 async generator 流式产出事件给 WebSocket 层
"""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any, Awaitable, Callable

from ..config import Config, ProviderConfig, load_config
from .providers import DELTA_TEXT, DONE, TOOL_CALL, create_provider
from .tools import TOOL_DEFINITIONS, ToolExecutor, ToolPermissionPolicy

SYSTEM_PROMPT = """你是 Vibe Studio，一个专业的 AI 编程助手。

## 工作方式
- 你在用户的项目工作区中运行，可以读写文件、执行命令
- 先用 list_files 或 read_file 了解项目结构，再进行修改
- 修改文件时优先使用 str_replace（精确替换），只在需要创建或完全重写时用 write_file
- 执行命令前告知用户你要做什么

## 输出风格
- 用中文回答
- 解释清楚你做了什么修改，以及为什么
- 如果发现 bug 或改进建议，主动说明
- 对于大型重构，先列出计划再执行
- 不要把“我准备检查”“我现在去测试”这类计划性措辞当作最终结论输出
- 只有在真实完成对应工具调用后，才能说“我已检查 / 我已修改 / 我已重启”
- 如果这次没有调用任何工具，不要声称完成了本地操作

## 限制
- 不要删除用户没有明确要求删除的文件
- 危险命令（rm -rf 等）执行前必须再次确认
"""

MAX_TURNS = 20  # 防止无限循环
MAX_TOOLLESS_RETRIES = 1


def request_requires_tool_use(message: str) -> bool:
    text = message.strip().lower()
    if not text or text.startswith("/"):
        return False

    keywords = [
        "看", "看看", "检查", "分析", "排查", "调试", "修复", "修改", "重构", "优化",
        "实现", "添加", "删除", "更新", "保存", "提交", "记录", "重启", "运行", "测试",
        "构建", "部署", "读取", "搜索", "查一下", "看下", "改", "写一个", "做一个",
        "fix", "debug", "check", "inspect", "analyze", "update", "modify", "edit",
        "refactor", "restart", "run", "test", "build", "save", "record", "implement",
    ]
    return any(keyword in text for keyword in keywords)


def sanitize_anthropic_history(messages: list[dict]) -> list[dict]:
    """Drop incomplete Anthropic tool_use turns that would trigger 2013 errors."""
    sanitized: list[dict] = []
    pending_tool_use_ids: set[str] = set()

    for message in messages:
        role = message.get("role")
        content = message.get("content")

        if pending_tool_use_ids:
            if role == "user" and isinstance(content, list):
                result_ids = {
                    block.get("tool_use_id")
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "tool_result"
                }
                if result_ids and result_ids.issubset(pending_tool_use_ids):
                    sanitized.append(message)
                    pending_tool_use_ids = set()
                    continue

            pending_tool_use_ids = set()
            continue

        sanitized.append(message)

        if role == "assistant" and isinstance(content, list):
            tool_use_ids = {
                block.get("id")
                for block in content
                if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("id")
            }
            if tool_use_ids:
                pending_tool_use_ids = tool_use_ids

    if pending_tool_use_ids and sanitized:
        last = sanitized[-1]
        if last.get("role") == "assistant" and isinstance(last.get("content"), list):
            tool_use_ids = {
                block.get("id")
                for block in last["content"]
                if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("id")
            }
            if tool_use_ids:
                sanitized.pop()

    return sanitized


async def run_agent(
    user_message: str,
    workspace: str,
    config: Config,
    conversation_history: list[dict],
    approval_resolver: Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]] | None = None,
) -> AsyncGenerator[dict, None]:
    """
    运行一次 Agent 对话循环。
    产出事件格式：
      {"type": "thinking", "text": "..."}         AI 正在思考/输出文本
      {"type": "tool_start", "name": "...", "args": {...}}  开始调用工具
      {"type": "tool_end", "name": "...", "result": {...}}  工具调用完成
      {"type": "file_changed", "path": "...", "old": "...", "new": "..."}  文件变化
      {"type": "error", "text": "..."}             错误
      {"type": "done"}                             全部完成
    """
    # 解析当前模型
    model_ref = config.primary_model
    if not model_ref:
        yield {"type": "error", "text": "未配置模型，请先在设置中配置模型"}
        return

    provider_id, model_id, provider_cfg = config.resolve_model(model_ref)
    if not provider_cfg:
        yield {"type": "error", "text": f"找不到 Provider 配置: {provider_id}，请检查模型设置"}
        return

    api_key = provider_cfg.resolve_api_key()
    if not api_key and provider_id != "ollama":
        yield {"type": "error", "text": f"Provider '{provider_id}' 的 API Key 未设置"}
        return

    provider = create_provider(provider_cfg, model_id)
    executor = ToolExecutor(
        workspace,
        permission_policy=ToolPermissionPolicy.from_config(config.tool_permissions),
    )

    # 使用本地消息副本，避免内部重试提示污染持久化历史
    messages = list(conversation_history)
    if provider_cfg.api_type == "anthropic":
        sanitized_history = sanitize_anthropic_history(messages)
        if len(sanitized_history) != len(messages):
            conversation_history[:] = sanitized_history
            messages = list(sanitized_history)
    messages.append({"role": "user", "content": user_message})
    original_user_content = user_message
    toolless_retries = 0
    has_executed_tool = False

    for turn in range(MAX_TURNS):
        tool_calls_this_turn: list[dict] = []
        full_text = ""

        # 流式调用 LLM
        async for event in provider.stream(messages, TOOL_DEFINITIONS, system=SYSTEM_PROMPT):
            if event["type"] == DELTA_TEXT:
                yield {"type": "thinking", "text": event["text"]}
                full_text += event["text"]

            elif event["type"] == TOOL_CALL:
                tool_calls_this_turn.append(event)

            elif event["type"] == DONE:
                full_text = event.get("text", full_text)

        # 没有工具调用 → 对话结束
        if not tool_calls_this_turn:
            if request_requires_tool_use(user_message) and not has_executed_tool and toolless_retries < MAX_TOOLLESS_RETRIES:
                toolless_retries += 1
                yield {
                    "type": "thinking",
                    "text": "\n[系统提醒：这类请求需要先调用工具获取真实证据，正在要求模型改为实际操作。]\n",
                }
                messages[-1] = {
                    "role": "user",
                    "content": (
                        f"{original_user_content}\n\n"
                        "系统执行要求：这是一个需要本地操作或项目证据的请求。"
                        "你必须先调用至少一个工具（如 list_files/read_file/search_files/bash_exec/"
                        "write_file/str_replace）再给结论。"
                        "没有工具证据时，不要声称已经检查、修改、重启、测试或保存。"
                    ),
                }
                continue

            # 把 assistant 回复加入历史
            messages.append({"role": "assistant", "content": full_text})
            conversation_history[:] = messages
            yield {"type": "assistant_message", "text": full_text}
            break

        # 把 assistant 这一轮（含工具调用意图）加入历史
        if provider_cfg.api_type == "anthropic":
            # Anthropic 格式
            content_blocks: list[dict] = []
            if full_text:
                content_blocks.append({"type": "text", "text": full_text})
            for tc in tool_calls_this_turn:
                content_blocks.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["args"],
                })
            messages.append({"role": "assistant", "content": content_blocks})
        else:
            # OpenAI 格式
            messages.append({
                "role": "assistant",
                "content": full_text or None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": json.dumps(tc["args"])},
                    }
                    for tc in tool_calls_this_turn
                ],
            })

        # 执行所有工具调用
        tool_results = []
        for tc in tool_calls_this_turn:
            yield {"type": "tool_start", "name": tc["name"], "args": tc["args"]}
            permission_mode = executor.permission_policy.mode_for(tc["name"])
            if permission_mode == "prompt":
                if approval_resolver is None:
                    result = {"error": f"工具 '{tc['name']}' 需要人工审批后才能执行", "permission_denied": True}
                else:
                    approval = await approval_resolver(tc["name"], tc["args"])
                    if approval.get("approved"):
                        result = await executor.execute(
                            tc["name"],
                            tc["args"],
                            enforce_permission_policy=False,
                        )
                    else:
                        reason = str(approval.get("reason") or "用户拒绝了工具执行")
                        result = {"error": reason, "permission_denied": True}
            else:
                result = await executor.execute(tc["name"], tc["args"])
            yield {"type": "tool_end", "name": tc["name"], "result": result}
            has_executed_tool = True

            # 文件变化事件（给前端高亮展示）
            if tc["name"] in ("write_file", "str_replace") and "error" not in result:
                yield {
                    "type": "file_changed",
                    "path": result.get("path", ""),
                    "old_content": result.get("old_content"),
                    "new_content": result.get("new_content"),
                }

            # 把工具结果加入历史
            result_text = json.dumps(result, ensure_ascii=False)
            if provider_cfg.api_type == "anthropic":
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": result_text,
                })
            else:
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result_text,
                })

        # 把工具结果加入消息历史
        if provider_cfg.api_type == "anthropic":
            messages.append({"role": "user", "content": tool_results})
        else:
            messages.extend(tool_results)

    else:
        yield {"type": "error", "text": f"超过最大轮次限制（{MAX_TURNS}），任务终止"}

    conversation_history[:] = messages
    yield {"type": "done"}
