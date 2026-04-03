"""
LLM Provider 适配器
统一封装 Anthropic SDK 和 OpenAI-compatible SDK，对外暴露相同接口
"""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

from ..config import ProviderConfig
from ..oauth_openai import OPENAI_CODEX_JWT_CLAIM_PATH, openai_codex_oauth_manager

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


class OpenAICodexProvider(LLMProvider):
    """ChatGPT OAuth / Codex Responses API 适配器"""

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict],
        system: str = "",
    ) -> AsyncGenerator[dict, None]:
        import base64

        import httpx

        provider_id = self.config.provider_id or "openai"
        token = openai_codex_oauth_manager.ensure_fresh_access_token(provider_id)
        account_id = str(self.config.oauth.get("account_id") or "")
        if not account_id:
            try:
                payload = self._decode_jwt(token)
                account_id = str(payload.get(OPENAI_CODEX_JWT_CLAIM_PATH, {}).get("chatgpt_account_id") or "")
            except Exception:  # noqa: BLE001
                account_id = ""
        if not account_id:
            raise RuntimeError("OpenAI OAuth 缺少 account_id，请重新登录")

        body = {
            "model": self.model_id,
            "store": False,
            "stream": True,
            "instructions": system or None,
            "input": self._convert_messages(messages),
            "text": {"verbosity": "medium"},
            "tool_choice": "auto",
            "parallel_tool_calls": True,
            "include": ["reasoning.encrypted_content"],
        }
        if tools:
            body["tools"] = [
                {
                    "type": "function",
                    "name": t["function"]["name"],
                    "description": t["function"].get("description", ""),
                    "parameters": t["function"].get("parameters", {}),
                }
                for t in tools
            ]

        headers = {
            "Authorization": f"Bearer {token}",
            "chatgpt-account-id": account_id,
            "originator": "pi",
            "OpenAI-Beta": "responses=experimental",
            "accept": "text/event-stream",
            "content-type": "application/json",
            "User-Agent": "Vibe Studio OAuth",
        }
        url = f"{self.config.base_url.rstrip('/')}/codex/responses"
        accumulated_text = ""
        pending_tool_calls: dict[str, dict[str, Any]] = {}
        item_to_call_id: dict[str, str] = {}

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=body) as response:
                if response.status_code >= 400:
                    error_text = (await response.aread()).decode("utf-8", errors="replace")
                    raise RuntimeError(f"Codex API {response.status_code}: {error_text or response.reason_phrase}")
                async for event in self._parse_sse(response):
                    event_type = event.get("type")
                    if event_type == "response.output_text.delta":
                        delta = str(event.get("delta") or "")
                        accumulated_text += delta
                        yield {"type": DELTA_TEXT, "text": delta}
                    elif event_type == "response.output_item.added":
                        item = event.get("item") or {}
                        if item.get("type") == "function_call":
                            call_id = str(item.get("call_id") or "")
                            item_id = str(item.get("id") or "")
                            if item_id and call_id:
                                item_to_call_id[item_id] = call_id
                            pending_tool_calls[call_id] = {
                                "id": self._compose_tool_call_id(call_id, item_id),
                                "name": str(item.get("name") or ""),
                                "args_json": str(item.get("arguments") or ""),
                            }
                    elif event_type == "response.function_call_arguments.delta":
                        item_id = str(event.get("item_id") or "")
                        call_id = item_to_call_id.get(item_id) or str(event.get("call_id") or "")
                        # Fallback: update the most recent pending tool call.
                        if not call_id and pending_tool_calls:
                            call_id = list(pending_tool_calls.keys())[-1]
                        if call_id:
                            pending = pending_tool_calls.setdefault(call_id, {"id": call_id, "name": "", "args_json": ""})
                            pending["args_json"] += str(event.get("delta") or "")
                    elif event_type == "response.function_call_arguments.done":
                        item_id = str(event.get("item_id") or "")
                        call_id = item_to_call_id.get(item_id) or str(event.get("call_id") or "")
                        if not call_id and pending_tool_calls:
                            call_id = list(pending_tool_calls.keys())[-1]
                        if call_id:
                            pending = pending_tool_calls.setdefault(call_id, {"id": call_id, "name": "", "args_json": ""})
                            pending["args_json"] = str(event.get("arguments") or pending["args_json"])
                    elif event_type in {"response.done", "response.completed", "response.incomplete"}:
                        break
                    elif event_type == "response.output_item.done":
                        item = event.get("item") or {}
                        if item.get("type") == "function_call":
                            call_id = str(item.get("call_id") or "")
                            item_id = str(item.get("id") or "")
                            if item_id and call_id:
                                item_to_call_id[item_id] = call_id
                            pending = pending_tool_calls.setdefault(
                                call_id,
                                {"id": self._compose_tool_call_id(call_id, item_id), "name": "", "args_json": ""},
                            )
                            pending["id"] = self._compose_tool_call_id(call_id, item_id)
                            pending["name"] = str(item.get("name") or pending["name"])
                            pending["args_json"] = str(item.get("arguments") or pending["args_json"])

        for tc in pending_tool_calls.values():
            if not tc.get("name"):
                continue
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

    def _convert_messages(self, messages: list[dict]) -> list[dict]:
        converted: list[dict] = []
        for message in messages:
            role = message.get("role")
            if role == "user":
                content = message.get("content")
                if isinstance(content, list):
                    tool_outputs = []
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "tool_result":
                            call_id, _ = self._split_tool_call_id(str(block.get("tool_use_id") or ""))
                            tool_outputs.append({
                                "type": "function_call_output",
                                "call_id": call_id,
                                "output": block.get("content", ""),
                            })
                    converted.extend(tool_outputs)
                else:
                    converted.append({
                        "role": "user",
                        "content": [{"type": "input_text", "text": str(content or "")}],
                    })
            elif role == "tool":
                call_id, _ = self._split_tool_call_id(str(message.get("tool_call_id") or ""))
                if call_id:
                    converted.append({
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": message.get("content", ""),
                    })
            elif role == "assistant":
                tool_calls = message.get("tool_calls") or []
                if tool_calls:
                    for tool_call in tool_calls:
                        function = tool_call.get("function") or {}
                        call_id, item_id = self._split_tool_call_id(str(tool_call.get("id") or ""))
                        converted.append({
                            "type": "function_call",
                            "call_id": call_id,
                            "id": item_id,
                            "name": function.get("name"),
                            "arguments": function.get("arguments", "{}"),
                        })
                content = message.get("content")
                if isinstance(content, str) and content:
                    converted.append({
                        "role": "assistant",
                        "content": [{"type": "output_text", "text": content}],
                    })
        return converted

    async def _parse_sse(self, response: Any) -> AsyncGenerator[dict[str, Any], None]:
        buffer = ""
        async for chunk in response.aiter_text():
            buffer += chunk
            while "\n\n" in buffer:
                raw, buffer = buffer.split("\n\n", 1)
                data_lines = [
                    line[5:].strip()
                    for line in raw.splitlines()
                    if line.startswith("data:")
                ]
                if not data_lines:
                    continue
                data = "\n".join(data_lines).strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    yield json.loads(data)
                except json.JSONDecodeError:
                    continue

    def _decode_jwt(self, token: str) -> dict[str, Any]:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        return json.loads(decoded.decode("utf-8"))

    def _compose_tool_call_id(self, call_id: str, item_id: str) -> str:
        if call_id and item_id:
            return f"{call_id}|{item_id}"
        return call_id or item_id

    def _split_tool_call_id(self, composite_id: str) -> tuple[str, str | None]:
        if "|" in composite_id:
            call_id, item_id = composite_id.split("|", 1)
            return call_id, item_id
        return composite_id, None


def create_provider(config: ProviderConfig, model_id: str) -> LLMProvider:
    if config.api_type == "anthropic":
        return AnthropicProvider(config, model_id)
    if config.api_type == "openai_codex":
        return OpenAICodexProvider(config, model_id)
    return OpenAIProvider(config, model_id)
