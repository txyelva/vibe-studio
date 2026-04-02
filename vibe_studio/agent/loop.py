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

## 限制
- 不要删除用户没有明确要求删除的文件
- 危险命令（rm -rf 等）执行前必须再次确认
"""

MAX_TURNS = 20  # 防止无限循环


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

    # 构建对话历史（直接修改传入的列表，方便调用者持久化）
    messages = conversation_history
    messages.append({"role": "user", "content": user_message})

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
            # 把 assistant 回复加入历史
            messages.append({"role": "assistant", "content": full_text})
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

    yield {"type": "done"}
