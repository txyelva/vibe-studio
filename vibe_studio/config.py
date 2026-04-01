from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

CONFIG_DIR = Path.home() / ".vibe-studio"
CONFIG_FILE = CONFIG_DIR / "config.json"

# 内置 Provider 预设
BUILTIN_PROVIDERS: dict[str, dict] = {
    "anthropic": {
        "name": "Anthropic (Claude)",
        "base_url": "https://api.anthropic.com",
        "api_type": "anthropic",
        "env_key": "ANTHROPIC_API_KEY",
        "models": [
            {"id": "claude-opus-4-5", "name": "Claude Opus 4.5"},
            {"id": "claude-sonnet-4-5", "name": "Claude Sonnet 4.5"},
            {"id": "claude-haiku-4-5", "name": "Claude Haiku 4.5"},
        ],
    },
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "api_type": "openai",
        "env_key": "OPENAI_API_KEY",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
            {"id": "o3", "name": "o3"},
        ],
    },
    "deepseek": {
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com/v1",
        "api_type": "openai",
        "env_key": "DEEPSEEK_API_KEY",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek Chat (V3)"},
            {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner (R1)"},
        ],
    },
    "moonshot": {
        "name": "Kimi 通用（Moonshot）",
        "base_url": "https://api.moonshot.ai/v1",
        "api_type": "openai",
        "env_key": "MOONSHOT_API_KEY",
        "models": [
            {"id": "kimi-k2-turbo", "name": "Kimi K2 Turbo（推荐）"},
            {"id": "kimi-k2-thinking", "name": "Kimi K2 Thinking（深度推理）"},
            {"id": "moonshot-v1-128k", "name": "Moonshot 128K"},
            {"id": "moonshot-v1-32k", "name": "Moonshot 32K"},
        ],
    },
    "kimi_coding": {
        "name": "Kimi Coding（编程专用）",
        # 注意：不加 /v1，Anthropic SDK 会自动追加 /v1/messages
        "base_url": "https://api.kimi.com/coding/",
        "api_type": "anthropic",
        "env_key": "MOONSHOT_API_KEY",
        "models": [
            {"id": "kimi-code", "name": "Kimi Code（推荐）"},
        ],
    },
    "qwen": {
        "name": "通义千问 (Qwen)",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_type": "openai",
        "env_key": "DASHSCOPE_API_KEY",
        "models": [
            {"id": "qwen3-max", "name": "Qwen3 Max"},
            {"id": "qwen3-plus", "name": "Qwen3 Plus"},
            {"id": "qwen3-turbo", "name": "Qwen3 Turbo"},
        ],
    },
    "zhipu": {
        "name": "智谱 AI (GLM)",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "api_type": "openai",
        "env_key": "ZHIPU_API_KEY",
        "models": [
            {"id": "glm-4-plus", "name": "GLM-4 Plus"},
            {"id": "glm-4-air", "name": "GLM-4 Air"},
        ],
    },
    "ollama": {
        "name": "Ollama (本地)",
        "base_url": "http://localhost:11434/v1",
        "api_type": "openai",
        "env_key": "",
        "models": [],
    },
}


@dataclass
class ProviderConfig:
    name: str
    base_url: str
    api_type: str  # "openai" | "anthropic"
    api_key: str = ""  # 支持 ${ENV_VAR} 语法
    models: list[dict] = field(default_factory=list)

    def resolve_api_key(self) -> str:
        """解析环境变量引用，如 ${ANTHROPIC_API_KEY}"""
        key = self.api_key
        if not key:
            return ""
        match = re.match(r"^\$\{([^}]+)\}$", key)
        if match:
            return os.environ.get(match.group(1), "")
        return key


@dataclass
class Config:
    setup_complete: bool = False
    primary_model: str = ""
    fallback_models: list[str] = field(default_factory=list)
    workspace: str = str(Path.cwd())
    providers: dict[str, dict] = field(default_factory=dict)
    projects: list[dict] = field(default_factory=list)
    auth: dict = field(default_factory=dict)  # 认证配置

    def get_provider_config(self, provider_id: str) -> Optional[ProviderConfig]:
        data = self.providers.get(provider_id)
        if not data:
            return None
        # 只取 ProviderConfig 认识的字段，过滤掉多余的字段如 auth_type
        valid_fields = {f for f in ProviderConfig.__dataclass_fields__}  # type: ignore[attr-defined]
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return ProviderConfig(**filtered)

    def resolve_model(self, model_ref: str) -> tuple[str, str, Optional[ProviderConfig]]:
        """解析 'provider/model-id' 格式，返回 (provider_id, model_id, config)"""
        parts = model_ref.split("/", 1)
        if len(parts) != 2:
            return model_ref, model_ref, None
        provider_id, model_id = parts
        cfg = self.get_provider_config(provider_id)
        return provider_id, model_id, cfg


def load_config() -> Config:
    if not CONFIG_FILE.exists():
        return Config()
    try:
        with open(CONFIG_FILE) as f:
            data = json.load(f)
        # 只取 Config 认识的字段，忽略多余字段，防止 TypeError
        valid_fields = {f for f in Config.__dataclass_fields__}  # type: ignore[attr-defined]
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return Config(**filtered)
    except Exception as e:
        import logging
        logging.warning(f"load_config failed, using defaults: {e}")
        return Config()


def save_config(config: Config) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(asdict(config), f, indent=2, ensure_ascii=False)
