from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from ..auth import (
    is_auth_enabled,
    is_setup_required,
    setup_admin,
    verify_user,
    create_access_token,
    get_current_user,
    change_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class SetupRequest(BaseModel):
    username: str
    password: str


class AuthStatusResponse(BaseModel):
    enabled: bool
    setup_required: bool


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status() -> dict:
    """获取认证状态"""
    return {
        "enabled": is_auth_enabled(),
        "setup_required": is_setup_required(),
    }


@router.post("/setup")
async def setup_auth(req: SetupRequest) -> dict:
    """初始化设置管理员账号"""
    if not is_setup_required():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auth already setup",
        )
    
    if len(req.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters",
        )
    
    success = setup_admin(req.username, req.password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup failed",
        )
    
    # 创建 token
    token = create_access_token({"sub": req.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": req.username,
    }


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest) -> dict:
    """用户登录"""
    # 如果未启用认证，返回匿名 token
    if not is_auth_enabled():
        token = create_access_token({"sub": "anonymous"})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": "anonymous",
        }
    
    if not verify_user(req.username, req.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = create_access_token({"sub": req.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": req.username,
    }


@router.get("/me")
async def get_me(user: str = Depends(get_current_user)) -> dict:
    """获取当前用户信息"""
    return {"username": user}


@router.post("/change-password")
async def update_password(
    req: ChangePasswordRequest,
    user: str = Depends(get_current_user),
) -> dict:
    """修改密码"""
    if user == "anonymous" or not is_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auth not enabled",
        )
    
    if not change_password(user, req.old_password, req.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid old password",
        )
    
    return {"success": True}
