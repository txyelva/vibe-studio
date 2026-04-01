"""WebSocket Agent 通信层"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..agent.loop import run_agent
from ..config import load_config
from ..conversation import (
    get_conversation,
    save_conversation,
    create_conversation,
    generate_conversation_title,
    update_conversation_title,
)

ws_router = APIRouter()


async def get_status_info(conv_id: str | None, config) -> dict:
    """获取当前会话的状态信息，用于 /status 命令"""
    from ..conversation import get_conversation
    
    # 获取当前使用的模型
    model_str = config.primary_model or "未设置"
    conv_model = None
    
    if conv_id:
        conv = get_conversation(conv_id)
        if conv and conv.model:
            conv_model = conv.model
            model_str = conv_model
    
    # 解析模型信息
    provider_id = "未知"
    model_id = "未知"
    if model_str and "/" in model_str:
        provider_id, model_id = model_str.split("/", 1)
    
    # 获取 provider 配置信息
    provider_info = {}
    if provider_id in config.providers:
        p = config.providers[provider_id]
        provider_info = {
            "name": p.get("name", provider_id),
            "api_type": p.get("api_type", "unknown"),
        }
    
    return {
        "type": "status",
        "model": {
            "full": model_str,
            "provider": provider_id,
            "model_id": model_id,
            "provider_info": provider_info,
            "is_custom": conv_model is not None,  # 是否是对话自定义模型
        },
        "primary_model": config.primary_model,
        "workspace": config.workspace or "未设置",
    }


@ws_router.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket) -> None:
    await websocket.accept()

    # 当前连接的对话 ID 和历史
    current_conv_id: str | None = None
    conversation_history: list[dict] = []

    async def send(data: dict) -> None:
        await websocket.send_text(json.dumps(data, ensure_ascii=False))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await send({"type": "error", "text": "消息格式错误，需要 JSON"})
                continue

            msg_type = msg.get("type", "chat")

            if msg_type == "chat":
                user_message = msg.get("message", "").strip()
                if not user_message:
                    continue

                cfg = load_config()

                # 如果前端指定了 workspace，临时覆盖
                if msg.get("workspace"):
                    cfg.workspace = msg["workspace"]

                # 处理对话 ID
                conv_id = msg.get("conversation_id")
                conv = None
                if conv_id and conv_id != current_conv_id:
                    conv = get_conversation(conv_id)
                    if conv:
                        current_conv_id = conv_id
                        conversation_history = list(conv.messages)
                    else:
                        current_conv_id = conv_id
                        conversation_history = []
                elif not conv_id and not current_conv_id:
                    # 自动创建新对话，传入 project_id 和 model
                    project_id = msg.get("project_id")
                    model = msg.get("model")  # 可选的模型指定
                    new_conv = create_conversation("新对话", project_id, model)
                    conv = new_conv
                    current_conv_id = new_conv.id
                    conversation_history = []
                    await send({"type": "conversation_created", "conversation_id": current_conv_id, "model": model})
                
                # 如果加载了现有对话但没有获取到 conv 对象，重新获取
                if current_conv_id and not conv:
                    conv = get_conversation(current_conv_id)

                # 处理 /status 命令
                if user_message == "/status":
                    status = await get_status_info(current_conv_id, cfg)
                    await send(status)
                    continue
                
                # 处理 /model 命令 (切换模型)
                if user_message.startswith("/model "):
                    new_model = user_message[7:].strip()
                    if conv:
                        conv.model = new_model
                        save_conversation(conv)
                        await send({"type": "model_changed", "model": new_model})
                    else:
                        await send({"type": "error", "text": "没有活动的对话，无法切换模型"})
                    continue

                await send({"type": "start", "message": user_message})

                # 确定使用哪个模型
                # 优先级: 对话指定的 model > config.primary_model
                model_to_use = cfg.primary_model
                if conv and conv.model:
                    model_to_use = conv.model
                
                # 创建临时 config 对象，使用选定的模型
                config_for_run = cfg
                if model_to_use and model_to_use != cfg.primary_model:
                    # 复制 config 并覆盖 primary_model
                    from dataclasses import replace
                    config_for_run = replace(cfg, primary_model=model_to_use)

                async for event in run_agent(
                    user_message=user_message,
                    workspace=cfg.workspace,
                    config=config_for_run,
                    conversation_history=conversation_history,
                ):
                    await send(event)

                if current_conv_id:
                    conv = get_conversation(current_conv_id)
                    if conv:
                        conv.messages = list(conversation_history)
                        conv.updated_at = datetime.now().isoformat()
                        if conv.title == "新对话" and len(conversation_history) >= 2:
                            new_title = generate_conversation_title(list(conversation_history))
                            if new_title and new_title != "新对话":
                                conv.title = new_title
                        save_conversation(conv)

            elif msg_type == "load_conversation":
                conv_id = msg.get("conversation_id")
                if conv_id:
                    conv = get_conversation(conv_id)
                    if conv:
                        current_conv_id = conv_id
                        conversation_history = list(conv.messages)
                        await send({
                            "type": "conversation_loaded",
                            "conversation_id": conv_id,
                            "messages": conv.messages,
                            "model": conv.model,  # 返回对话使用的模型
                        })
                    else:
                        await send({"type": "error", "text": "对话不存在"})
            
            elif msg_type == "set_model":
                # 显式设置当前对话的模型
                conv_id = msg.get("conversation_id") or current_conv_id
                model = msg.get("model")
                if conv_id and model:
                    conv = get_conversation(conv_id)
                    if conv:
                        conv.model = model
                        save_conversation(conv)
                        if conv_id == current_conv_id:
                            await send({"type": "model_set", "model": model})
                    else:
                        await send({"type": "error", "text": "对话不存在"})
                else:
                    await send({"type": "error", "text": "缺少对话ID或模型"})

            elif msg_type == "clear":
                conversation_history.clear()
                current_conv_id = None
                await send({"type": "cleared"})

            elif msg_type == "ping":
                await send({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await send({"type": "error", "text": f"服务器错误: {e}"})
        except Exception:
            pass
