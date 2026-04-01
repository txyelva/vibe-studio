"""
LLM Provider 适配器
统一封装 Anthropic SDK 和 OpenAI-compatible SDK，对外暴露相同接口
"""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

from ..config import ProviderConfig

# 流式输出事件类型
DELTA_TEXT = "delta_text"
TOOL_CALL = "tool_call"
DONE = "done"


class LLMProvider:
    """抽象基类"""

    def __init__(self, config: ProviderConfig, model_id: str) -> None:
        self.config = config
        self.model_id = model_id

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict],
        system: str = "",
    ) -> AsyncGenerator[dict, None]:
        raise NotImplementedError
        yield {}


class AnthropicProvider(LLMProvider):
    """Anthropic SDK 适配器"""

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict],
        system: str = "",
    ) -> AsyncGenerator[dict, None]:
        from anthropic import AsyncAnthropic

        api_key = self.config.resolve_api_key()
        # 支持自定义 base_url（Kimi Coding 等兼容 Anthropic 协议的第三方服务需要）
        client_kwargs: dict[str, Any] = {"api_key": api_key}
        if self.config.base_url and "anthropic.com" not in self.config.base_url:
            client_kwargs["base_url"] = self.config.base_url
        client = AsyncAnthropic(**client_kwargs)

        # 转换 tools 格式（OpenAI → Anthropic）
        ant_tools = [
            {
                "name": t["function"]["name"],
                "description": t["function"].get("description", ""),
                "input_schema": t["function"].get("parameters", {}),
            }
            for t in tools
        ]

        kwargs: dict[str, Any] = dict(
            model=self.model_id,
            max_tokens=8192,
            messages=messages,
            tools=ant_tools,
        )
        if system:
            kwargs["system"] = system

        accumulated_text = ""
        tool_calls: list[dict] = []

        async with client.messages.stream(**kwargs) as stream:
            async for event in stream:
                etype = event.type

                if etype == "content_block_start":
                    if event.content_block.type == "tool_use":
                        tool_calls.append({
                            "id": event.content_block.id,
                            "name": event.content_block.name,
                            "input_json": "",
                        })

                elif etype == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        accumulated_text += delta.text
                        yield {"type": DELTA_TEXT, "text": delta.text}
                    elif delta.type == "input_json_delta":
                        if tool_calls:
                            tool_calls[-1]["input_json"] += delta.partial_json

                elif etype == "message_stop":
                    break

        for tc in tool_calls:
            try:
                args = json.loads(tc["input_json"] or "{}")
            except json.JSONDecodeError:
                args = {}
            yield {
                "type": TOOL_CALL,
                "id": tc["id"],
                "name": tc["name"],
                "args": args,
            }

        yield {"type": DONE, "text": accumulated_text}


class OpenAIProvider(LLMProvider):
    """OpenAI-compatible SDK 适配器（适用于 DeepSeek/Kimi/Qwen/GLM/Ollama 等）"""

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict],
        system: str = "",
    ) -> AsyncGenerator[dict, None]:
        from openai import AsyncOpenAI

        api_key = self.config.resolve_api_key() or "not-needed"
        client = AsyncOpenAI(api_key=api_key, base_url=self.config.base_url)

        full_messages = messages
        if system:
            full_messages = [{"role": "system", "content": system}] + messages

        kwargs: dict[str, Any] = dict(
            model=self.model_id,
            messages=full_messages,
            stream=True,
        )
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        accumulated_text = ""
        pending_tool_calls: dict[int, dict] = {}

        stream = await client.chat.completions.create(**kwargs)
        async for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue

            delta = choice.delta

            if delta.content:
                accumulated_text += delta.content
                yield {"type": DELTA_TEXT, "text": delta.content}

            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index
                    if idx not in pending_tool_calls:
                        pending_tool_calls[idx] = {
                            "id": tc_delta.id or "",
                            "name": "",
                            "args_json": "",
                        }
                    if tc_delta.id:
                        pending_tool_calls[idx]["id"] = tc_delta.id
                    if tc_delta.function:
                        if tc_delta.function.name:
                            pending_tool_calls[idx]["name"] += tc_delta.function.name
                        if tc_delta.function.arguments:
                            pending_tool_calls[idx]["args_json"] += tc_delta.function.arguments

            if choice.finish_reason in ("tool_calls", "stop"):
                break

        for tc in pending_tool_calls.values():
            try:
                args = json.loads(tc["args_json"] or "{}")
            except json.JSONDecodeError:
                args = {}
            yield {
                "type": TOOL_CALL,
                "id": tc["id"],
                "name": tc["name"],
                "args": args,
            }

        yield {"type": DONE, "text": accumulated_text}


def create_provider(config: ProviderConfig, model_id: str) -> LLMProvider:
    if config.api_type == "anthropic":
        return AnthropicProvider(config, model_id)
    return OpenAIProvider(config, model_id)
