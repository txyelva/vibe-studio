from __future__ import annotations

import hashlib
import secrets
import hmac
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from .config import CONFIG_DIR, load_config, save_config, Config

# JWT 配置
SECRET_KEY_FILE = CONFIG_DIR / ".jwt_secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer(auto_error=False)


def get_or_create_secret_key() -> str:
    """获取或创建 JWT 密钥"""
    if SECRET_KEY_FILE.exists():
        return SECRET_KEY_FILE.read_text().strip()
    
    # 生成新的随机密钥
    secret = secrets.token_urlsafe(32)
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    SECRET_KEY_FILE.write_text(secret)
    SECRET_KEY_FILE.chmod(0o600)  # 仅所有者可读写
    return secret


def _hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """使用 PBKDF2 哈希密码"""
    if salt is None:
        salt = secrets.token_hex(16)
    # PBKDF2 with SHA256, 100000 iterations
    pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('ascii'), 100000)
    return pwdhash.hex(), salt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    try:
        stored_hash, salt = hashed_password.split('$')
        computed_hash, _ = _hash_password(plain_password, salt)
        return hmac.compare_digest(stored_hash, computed_hash)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    pwdhash, salt = _hash_password(password)
    return f"{pwdhash}${salt}"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建 JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    secret_key = get_or_create_secret_key()
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """验证 JWT token"""
    try:
        secret_key = get_or_create_secret_key()
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return payload
    except JWTError:
        return None


def get_auth_config() -> dict:
    """获取认证配置"""
    config = load_config()
    return getattr(config, "auth", {}) or {}


def save_auth_config(auth_config: dict) -> None:
    """保存认证配置"""
    config = load_config()
    config.auth = auth_config
    save_config(config)


def is_auth_enabled() -> bool:
    """检查是否启用了认证"""
    auth = get_auth_config()
    return auth.get("enabled", False)


def is_setup_required() -> bool:
    """检查是否需要设置管理员账号"""
    auth = get_auth_config()
    return not auth.get("setup_complete", False)


def setup_admin(username: str, password: str) -> bool:
    """设置管理员账号"""
    if not is_setup_required():
        return False
    
    auth_config = {
        "enabled": True,
        "setup_complete": True,
        "users": {
            username: {
                "password_hash": get_password_hash(password),
                "is_admin": True,
                "created_at": datetime.utcnow().isoformat(),
            }
        }
    }
    save_auth_config(auth_config)
    return True


def verify_user(username: str, password: str) -> bool:
    """验证用户凭据"""
    auth = get_auth_config()
    users = auth.get("users", {})
    user = users.get(username)
    if not user:
        return False
    return verify_password(password, user.get("password_hash", ""))


def change_password(username: str, old_password: str, new_password: str) -> bool:
    """修改密码"""
    if not verify_user(username, old_password):
        return False
    
    auth = get_auth_config()
    auth["users"][username]["password_hash"] = get_password_hash(new_password)
    save_auth_config(auth)
    return True


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[str]:
    """获取当前登录用户（用于依赖注入）"""
    # 如果未启用认证，返回特殊用户
    if not is_auth_enabled():
        return "anonymous"
    
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload.get("sub")


async def require_auth(user: str = Depends(get_current_user)) -> str:
    """要求认证的路由依赖"""
    return user
