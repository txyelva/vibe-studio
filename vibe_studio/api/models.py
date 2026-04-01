"""模型管理 API：完整的模型 CRUD 和用量查询"""
from __future__ import annotations

from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..config import load_config, save_config, Config, BUILTIN_PROVIDERS

router = APIRouter(prefix="/models", tags=["models"])

# Provider 预设配置
PROVIDER_PRESETS = {
    "openai": {
        "name": "OpenAI",
        "api_type": "openai",
        "base_url": "https://api.openai.com/v1",
        "auth_types": ["api_key", "oauth"],
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
            {"id": "o3-mini", "name": "o3-mini"},
            {"id": "o1", "name": "o1"},
        ],
        "docs_url": "https://platform.openai.com/api-keys",
    },
    "anthropic": {
        "name": "Anthropic (Claude)",
        "api_type": "anthropic",
        "base_url": "https://api.anthropic.com",
        "auth_types": ["api_key", "oauth"],
        "models": [
            {"id": "claude-opus-4", "name": "Claude Opus 4"},
            {"id": "claude-sonnet-4", "name": "Claude Sonnet 4"},
            {"id": "claude-haiku-4", "name": "Claude Haiku 4"},
        ],
        "docs_url": "https://console.anthropic.com/settings/keys",
    },
    "gemini": {
        "name": "Google Gemini",
        "api_type": "openai",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "auth_types": ["api_key"],
        "models": [
            {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro"},
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
        ],
        "docs_url": "https://aistudio.google.com/app/apikey",
    },
    "moonshot": {
        "name": "Moonshot (Kimi)",
        "api_type": "openai",
        "base_url": "https://api.moonshot.cn/v1",
        "auth_types": ["api_key"],
        "models": [
            {"id": "kimi-k2-turbo", "name": "Kimi K2 Turbo"},
            {"id": "kimi-k2-thinking", "name": "Kimi K2 Thinking"},
        ],
        "docs_url": "https://platform.moonshot.cn/console/api-keys",
    },
    "kimi_coding": {
        "name": "Kimi Coding",
        "api_type": "anthropic",
        "base_url": "https://api.kimi.com/coding/",
        "auth_types": ["api_key"],
        "models": [
            {"id": "kimi-code", "name": "Kimi Code"},
        ],
        "docs_url": "https://platform.moonshot.cn/console/api-keys",
    },
    "zhipu": {
        "name": "智谱 AI (GLM)",
        "api_type": "openai",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "auth_types": ["api_key"],
        "models": [
            {"id": "glm-4-plus", "name": "GLM-4 Plus"},
            {"id": "glm-4-air", "name": "GLM-4 Air"},
            {"id": "glm-4-flash", "name": "GLM-4 Flash"},
        ],
        "docs_url": "https://open.bigmodel.cn/usercenter/apikeys",
    },
    "volcengine": {
        "name": "火山引擎 (豆包)",
        "api_type": "openai",
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "auth_types": ["api_key"],
        "models": [
            {"id": "doubao-pro", "name": "Doubao Pro"},
            {"id": "doubao-lite", "name": "Doubao Lite"},
            {"id": "deepseek-r1", "name": "DeepSeek R1"},
            {"id": "deepseek-v3", "name": "DeepSeek V3"},
        ],
        "docs_url": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    },
    "minimax": {
        "name": "MiniMax (Token Plan - Anthropic)",
        "api_type": "anthropic",
        "base_url": "https://api.minimaxi.com/anthropic",
        "auth_types": ["api_key"],
        "models": [
            # M2.7 系列 (最新旗舰)
            {"id": "MiniMax-M2.7", "name": "MiniMax-M2.7"},
            {"id": "MiniMax-M2.7-highspeed", "name": "MiniMax-M2.7-highspeed"},
            # M2.5 系列
            {"id": "MiniMax-M2.5", "name": "MiniMax-M2.5"},
            {"id": "MiniMax-M2.5-highspeed", "name": "MiniMax-M2.5-highspeed"},
            # M2.1 系列
            {"id": "MiniMax-M2.1", "name": "MiniMax-M2.1"},
            # M2 系列
            {"id": "MiniMax-M2", "name": "MiniMax-M2"},
            {"id": "MiniMax-M2-highspeed", "name": "MiniMax-M2-highspeed"},
            # 01 系列 (开源长文本)
            {"id": "MiniMax-Text-01", "name": "MiniMax-Text-01 (4M上下文)"},
            {"id": "MiniMax-VL-01", "name": "MiniMax-VL-01 (多模态)"},
            # 推理模型
            {"id": "MiniMax-M1", "name": "MiniMax-M1 (推理模型)"},
        ],
        "docs_url": "https://platform.minimaxi.com/document/Fast%20and%20cost-effective%20model?key=66b31378638e19a8761ea87d",
    },
    "deepseek": {
        "name": "DeepSeek",
        "api_type": "openai",
        "base_url": "https://api.deepseek.com/v1",
        "auth_types": ["api_key"],
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek Chat (V3)"},
            {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner (R1)"},
        ],
        "docs_url": "https://platform.deepseek.com/api_keys",
    },
    "qwen": {
        "name": "通义千问 (Qwen)",
        "api_type": "openai",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "auth_types": ["api_key"],
        "models": [
            {"id": "qwen-max", "name": "Qwen Max"},
            {"id": "qwen-plus", "name": "Qwen Plus"},
            {"id": "qwen-turbo", "name": "Qwen Turbo"},
        ],
        "docs_url": "https://dashscope.console.aliyun.com/apiKey",
    },
}


# ============== Pydantic Models ==============

class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    provider_name: str
    api_type: str
    is_primary: bool = False


class ProviderPreset(BaseModel):
    id: str
    name: str
    api_type: str
    base_url: str
    auth_types: list[str]
    models: list[dict]
    docs_url: str


class CreateModelRequest(BaseModel):
    provider_id: str
    name: Optional[str] = None  # 自定义名称，默认使用预设
    api_key: str
    auth_type: str = "api_key"  # "api_key" 或 "oauth"
    base_url: Optional[str] = None  # 自定义 base_url
    selected_models: list[str] = Field(default_factory=list)  # 选择的模型ID列表


class UpdateModelRequest(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    models: Optional[list[dict]] = None


class ModelUsage(BaseModel):
    model: str
    provider: str
    model_id: str
    total_requests: int = 0
    total_tokens: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    has_limit: bool = False
    limit_type: str = ""
    limit_value: Optional[int] = None
    limit_unit: str = ""
    used_value: int = 0
    remaining_value: Optional[int] = None
    subscription_status: str = ""
    subscription_plan: str = ""
    subscription_expires: Optional[str] = None
    input_price: Optional[float] = None
    output_price: Optional[float] = None


# ============== API Endpoints ==============

@router.get("/providers/presets")
async def get_provider_presets() -> dict:
    """获取所有支持的 Provider 预设"""
    return {
        "providers": [
            {**config, "id": pid}
            for pid, config in PROVIDER_PRESETS.items()
        ]
    }


@router.get("")
async def get_models() -> dict:
    """获取所有已配置的模型 Provider"""
    cfg = load_config()
    providers = []
    
    for provider_id, data in cfg.providers.items():
        provider_info = {
            "id": provider_id,
            "name": data.get("name", provider_id),
            "api_type": data.get("api_type", "openai"),
            "base_url": data.get("base_url", ""),
            "auth_type": data.get("auth_type", "api_key"),
            "models": data.get("models", []),
            "is_primary": provider_id in cfg.primary_model if cfg.primary_model else False,
        }
        providers.append(provider_info)
    
    return {"providers": providers}


@router.post("")
async def create_model(req: CreateModelRequest) -> dict:
    """添加新的模型 Provider"""
    cfg = load_config()
    
    preset = PROVIDER_PRESETS.get(req.provider_id)
    if not preset:
        raise HTTPException(400, f"Unknown provider: {req.provider_id}")
    
    # 生成 provider 在配置中的 ID
    # 如果同名已存在，添加数字后缀
    base_id = req.provider_id
    provider_config_id = base_id
    counter = 1
    while provider_config_id in cfg.providers:
        provider_config_id = f"{base_id}-{counter}"
        counter += 1
    
    # 构建模型列表
    selected_models = []
    for model_id in req.selected_models:
        model_info = next((m for m in preset["models"] if m["id"] == model_id), None)
        if model_info:
            selected_models.append(model_info)
    
    if not selected_models:
        # 默认选择第一个模型
        selected_models = preset["models"][:1]
    
    # 构建 provider 配置
    provider_config = {
        "name": req.name or preset["name"],
        "api_type": preset["api_type"],
        "base_url": req.base_url or preset["base_url"],
        "api_key": req.api_key,
        "auth_type": req.auth_type,
        "models": selected_models,
    }
    
    cfg.providers[provider_config_id] = provider_config
    
    # 如果是第一个模型，自动设为主模型
    if not cfg.primary_model and selected_models:
        cfg.primary_model = f"{provider_config_id}/{selected_models[0]['id']}"
    
    save_config(cfg)
    
    return {
        "success": True,
        "provider_id": provider_config_id,
        "provider": provider_config,
    }


@router.get("/{provider_id}")
async def get_model_provider(provider_id: str) -> dict:
    """获取单个 Provider 详情"""
    cfg = load_config()
    provider = cfg.providers.get(provider_id)
    if not provider:
        raise HTTPException(404, f"Provider not found: {provider_id}")
    
    return {
        "provider": {
            **provider,
            "id": provider_id,
            "is_primary": provider_id in cfg.primary_model if cfg.primary_model else False,
        }
    }


@router.patch("/{provider_id}")
async def update_model_provider(provider_id: str, req: UpdateModelRequest) -> dict:
    """更新 Provider 配置"""
    cfg = load_config()
    provider = cfg.providers.get(provider_id)
    if not provider:
        raise HTTPException(404, f"Provider not found: {provider_id}")
    
    if req.name is not None:
        provider["name"] = req.name
    if req.api_key is not None:
        provider["api_key"] = req.api_key
    if req.base_url is not None:
        provider["base_url"] = req.base_url
    if req.models is not None:
        provider["models"] = req.models
    
    save_config(cfg)
    
    return {"success": True, "provider": provider}


@router.delete("/{provider_id}")
async def delete_model_provider(provider_id: str) -> dict:
    """删除 Provider"""
    cfg = load_config()
    if provider_id not in cfg.providers:
        raise HTTPException(404, f"Provider not found: {provider_id}")
    
    del cfg.providers[provider_id]
    
    # 如果删除的是主模型对应的 provider，重置主模型
    if cfg.primary_model and cfg.primary_model.startswith(f"{provider_id}/"):
        # 选择第一个可用的模型
        for pid, pdata in cfg.providers.items():
            if pdata.get("models"):
                cfg.primary_model = f"{pid}/{pdata['models'][0]['id']}"
                break
        else:
            cfg.primary_model = ""
    
    save_config(cfg)
    
    return {"success": True}


@router.post("/{provider_id}/test")
async def test_model_provider(provider_id: str) -> dict:
    """测试 Provider 连接"""
    cfg = load_config()
    provider = cfg.providers.get(provider_id)
    if not provider:
        raise HTTPException(404, f"Provider not found: {provider_id}")
    
    api_key = provider.get("api_key", "")
    base_url = provider.get("base_url", "")
    api_type = provider.get("api_type", "openai")
    models = provider.get("models", [])
    
    try:
        if api_type == "anthropic":
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key, base_url=base_url if base_url else None)
            # 尝试用第一个模型发起一个实际的 messages 调用
            if models:
                test_model_id = models[0]["id"]
                try:
                    response = client.messages.create(
                        model=test_model_id,
                        max_tokens=1,
                        messages=[{"role": "user", "content": "Hi"}],
                    )
                    return {"success": True, "message": f"Connection OK, model '{test_model_id}' responded"}
                except Exception as e:
                    error_msg = str(e)
                    if "401" in error_msg or "authentication" in error_msg.lower():
                        return {"success": False, "error": "Authentication failed: Invalid API key"}
                    elif "404" in error_msg:
                        return {"success": False, "error": f"Model not found: {test_model_id}"}
                    else:
                        return {"success": False, "error": f"API Error: {error_msg}"}
            else:
                return {"success": True, "message": "Anthropic API key format valid"}
        else:
            from openai import OpenAI
            client = OpenAI(api_key=api_key, base_url=base_url)
            
            # 尝试列出模型，如果失败则尝试用第一个模型发起一个最小请求
            try:
                models_list = client.models.list()
                model_count = len(list(models_list))
                return {"success": True, "message": f"Connection OK, {model_count} models available"}
            except Exception as list_error:
                # 某些 Provider（如 MiniMax）不支持 models.list()
                # 尝试用第一个模型发起一个 chat completion 请求
                if models:
                    test_model_id = models[0]["id"]
                    try:
                        response = client.chat.completions.create(
                            model=test_model_id,
                            messages=[{"role": "user", "content": "Hi"}],
                            max_tokens=1,
                            stream=False,
                        )
                        return {"success": True, "message": f"Connection OK, model '{test_model_id}' responded"}
                    except Exception as chat_error:
                        error_msg = str(chat_error)
                        # 如果是认证错误，显示更友好的信息
                        if "401" in error_msg or "authentication" in error_msg.lower():
                            return {"success": False, "error": "Authentication failed: Invalid API key"}
                        elif "404" in error_msg:
                            return {"success": False, "error": f"Model not found: {test_model_id}"}
                        else:
                            return {"success": False, "error": f"API Error: {error_msg}"}
                else:
                    return {"success": False, "error": f"Cannot list models: {str(list_error)}"}
    except Exception as e:
        error_msg = str(e)
        # 处理常见错误
        if "401" in error_msg or "authentication" in error_msg.lower():
            return {"success": False, "error": "Authentication failed: Invalid API key"}
        elif "connection" in error_msg.lower():
            return {"success": False, "error": f"Connection failed: {error_msg}"}
        else:
            return {"success": False, "error": error_msg}


@router.post("/set-primary")
async def set_primary_model(model_ref: str = Query(...)) -> dict:
    """设置主模型"""
    cfg = load_config()
    
    # 验证 model_ref 是否有效
    parts = model_ref.split("/", 1)
    if len(parts) != 2:
        raise HTTPException(400, "Invalid model reference format")
    
    provider_id, model_id = parts
    provider = cfg.providers.get(provider_id)
    if not provider:
        raise HTTPException(404, f"Provider not found: {provider_id}")
    
    model_exists = any(m["id"] == model_id for m in provider.get("models", []))
    if not model_exists:
        raise HTTPException(404, f"Model not found: {model_id}")
    
    cfg.primary_model = model_ref
    save_config(cfg)
    
    return {"success": True, "primary_model": model_ref}


@router.get("/usage")
async def get_model_usage(model_ref: str = Query(...)) -> dict:
    """获取模型用量信息（模拟数据）"""
    cfg = load_config()
    
    parts = model_ref.split("/", 1)
    if len(parts) != 2:
        raise HTTPException(400, "Invalid model reference format")
    
    provider_id, model_id = parts
    
    # 模拟用量数据
    mock_usage_data = {
        "kimi_coding/kimi-code": {
            "total_requests": 1523,
            "total_tokens": 2847563,
            "input_tokens": 1245321,
            "output_tokens": 1602242,
            "has_limit": True,
            "limit_type": "subscription",
            "limit_value": 10000000,
            "limit_unit": "tokens",
            "used_value": 2847563,
            "remaining_value": 7152437,
            "subscription_status": "active",
            "subscription_plan": "pro",
            "subscription_expires": "2026-12-31",
            "input_price": 0.012,
            "output_price": 0.012,
        },
        "moonshot/kimi-k2-turbo": {
            "total_requests": 892,
            "total_tokens": 1567823,
            "input_tokens": 687234,
            "output_tokens": 880589,
            "has_limit": True,
            "limit_type": "subscription",
            "limit_value": 5000000,
            "limit_unit": "tokens",
            "used_value": 1567823,
            "remaining_value": 3432177,
            "subscription_status": "active",
            "subscription_plan": "free",
            "input_price": 0.005,
            "output_price": 0.005,
        },
        "openai/gpt-4o": {
            "total_requests": 3421,
            "total_tokens": 5234567,
            "input_tokens": 2345678,
            "output_tokens": 2888889,
            "has_limit": True,
            "limit_type": "subscription",
            "limit_value": 50000,  # $50
            "limit_unit": "usd",
            "used_value": 23.45,
            "remaining_value": 26.55,
            "subscription_status": "active",
            "subscription_plan": "tier_2",
            "subscription_expires": None,
            "input_price": 0.005,
            "output_price": 0.015,
        },
    }
    
    default_usage = {
        "total_requests": 0,
        "total_tokens": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "has_limit": False,
        "limit_type": "none",
        "limit_value": None,
        "limit_unit": "",
        "used_value": 0,
        "remaining_value": None,
        "subscription_status": "none",
        "subscription_plan": "",
        "subscription_expires": None,
        "input_price": None,
        "output_price": None,
    }
    
    usage_data = mock_usage_data.get(model_ref, default_usage)
    
    return {
        "model": model_ref,
        "provider": provider_id,
        "model_id": model_id,
        **usage_data
    }
