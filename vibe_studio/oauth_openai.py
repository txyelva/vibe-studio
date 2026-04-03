from __future__ import annotations

import base64
import hashlib
import html
import json
import secrets
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Optional
from urllib.parse import urlencode, urlparse, parse_qs

import httpx

from .config import load_config, save_config

OPENAI_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
OPENAI_CODEX_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize"
OPENAI_CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token"
OPENAI_CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback"
OPENAI_CODEX_SCOPE = "openid profile email offline_access"
OPENAI_CODEX_JWT_CLAIM_PATH = "https://api.openai.com/auth"
OPENAI_CODEX_PROVIDER_IDS = {"openai", "openai-codex"}


@dataclass
class OAuthSession:
    session_id: str
    provider_id: str
    state: str
    verifier: str
    created_at: float
    status: str = "pending"
    error: str = ""
    account_email: str = ""
    account_plan: str = ""


class OpenAICodexOAuthManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: dict[str, OAuthSession] = {}
        self._server: ThreadingHTTPServer | None = None
        self._server_thread: threading.Thread | None = None

    def start_login(self, provider_id: str) -> dict[str, str]:
        self._ensure_server()
        verifier, challenge = self._generate_pkce()
        state = secrets.token_hex(16)
        session_id = secrets.token_urlsafe(18)
        session = OAuthSession(
            session_id=session_id,
            provider_id=provider_id,
            state=state,
            verifier=verifier,
            created_at=time.time(),
        )
        with self._lock:
            self._sessions[state] = session
        auth_url = self._build_auth_url(state, challenge)
        return {"session_id": session_id, "auth_url": auth_url}

    def get_status(self, session_id: str) -> dict[str, Any]:
        with self._lock:
            session = next((s for s in self._sessions.values() if s.session_id == session_id), None)
        if not session:
            return {"status": "not_found"}
        return {
            "status": session.status,
            "error": session.error,
            "account_email": session.account_email,
            "account_plan": session.account_plan,
        }

    def disconnect(self, provider_id: str) -> None:
        cfg = load_config()
        provider = cfg.providers.get(provider_id)
        if not provider:
            return
        provider["oauth"] = {}
        save_config(cfg)

    def ensure_fresh_access_token(self, provider_id: str) -> str:
        cfg = load_config()
        provider = cfg.providers.get(provider_id)
        if not provider:
            raise ValueError(f"Provider not found: {provider_id}")
        oauth = provider.get("oauth") or {}
        access_token = str(oauth.get("access_token") or "")
        refresh_token = str(oauth.get("refresh_token") or "")
        expires_at = int(oauth.get("expires_at") or 0)

        if access_token and expires_at > int(time.time() * 1000) + 30_000:
            return access_token
        if not refresh_token:
            raise ValueError("OAuth 未连接，请先登录 OpenAI")

        refreshed = self._refresh_access_token(refresh_token)
        provider["oauth"] = refreshed
        save_config(cfg)
        return refreshed["access_token"]

    def _ensure_server(self) -> None:
        if self._server:
            return

        manager = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                parsed = urlparse(self.path)
                if parsed.path != "/auth/callback":
                    self.send_response(404)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(b"<h2>Not found</h2>")
                    return

                query = parse_qs(parsed.query)
                state = (query.get("state") or [""])[0]
                code = (query.get("code") or [""])[0]
                error = (query.get("error") or [""])[0]

                if error:
                    manager._mark_error(state, f"OAuth error: {error}")
                    self._send_html(400, "OpenAI login failed", f"OAuth error: {html.escape(error)}")
                    return

                if not state or not code:
                    self._send_html(400, "OpenAI login failed", "Missing OAuth state or code.")
                    return

                try:
                    manager._complete_login(state, code)
                    self._send_html(200, "OpenAI login complete", "You can close this window and return to Vibe Studio.")
                except Exception as exc:  # noqa: BLE001
                    manager._mark_error(state, str(exc))
                    self._send_html(500, "OpenAI login failed", str(exc))

            def log_message(self, format: str, *args: object) -> None:  # noqa: A003
                return

            def _send_html(self, status: int, title: str, body: str) -> None:
                page = (
                    "<!doctype html><html><head><meta charset='utf-8' />"
                    f"<title>{html.escape(title)}</title></head>"
                    "<body style='font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 32px;'>"
                    f"<h2>{html.escape(title)}</h2><p>{html.escape(body)}</p></body></html>"
                )
                encoded = page.encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

        self._server = ThreadingHTTPServer(("127.0.0.1", 1455), Handler)
        self._server_thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._server_thread.start()

    def _build_auth_url(self, state: str, challenge: str) -> str:
        params = {
            "response_type": "code",
            "client_id": OPENAI_CODEX_CLIENT_ID,
            "redirect_uri": OPENAI_CODEX_REDIRECT_URI,
            "scope": OPENAI_CODEX_SCOPE,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": state,
            "id_token_add_organizations": "true",
            "codex_cli_simplified_flow": "true",
            "originator": "pi",
        }
        return f"{OPENAI_CODEX_AUTHORIZE_URL}?{urlencode(params)}"

    def _generate_pkce(self) -> tuple[str, str]:
        verifier = secrets.token_urlsafe(48)
        digest = hashlib.sha256(verifier.encode("utf-8")).digest()
        challenge = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
        return verifier, challenge

    def _complete_login(self, state: str, code: str) -> None:
        with self._lock:
            session = self._sessions.get(state)
        if not session:
            raise ValueError("OAuth session not found or already expired")

        oauth_data = self._exchange_code_for_tokens(code, session.verifier)
        cfg = load_config()
        provider = cfg.providers.get(session.provider_id)
        if not provider:
            raise ValueError(f"Provider not found: {session.provider_id}")

        provider["oauth"] = oauth_data
        provider["auth_type"] = "oauth"
        provider["api_type"] = provider.get("api_type") or "openai_codex"
        save_config(cfg)

        payload = self._decode_jwt(oauth_data["access_token"])
        profile = payload.get("https://api.openai.com/profile", {}) if isinstance(payload, dict) else {}
        auth = payload.get(OPENAI_CODEX_JWT_CLAIM_PATH, {}) if isinstance(payload, dict) else {}
        session.account_email = str(profile.get("email") or "")
        session.account_plan = str(auth.get("chatgpt_plan_type") or "")
        session.status = "completed"

    def _mark_error(self, state: str, message: str) -> None:
        with self._lock:
            session = self._sessions.get(state)
            if not session:
                return
            session.status = "error"
            session.error = message

    def _exchange_code_for_tokens(self, code: str, verifier: str) -> dict[str, Any]:
        data = {
            "grant_type": "authorization_code",
            "client_id": OPENAI_CODEX_CLIENT_ID,
            "code": code,
            "code_verifier": verifier,
            "redirect_uri": OPENAI_CODEX_REDIRECT_URI,
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                OPENAI_CODEX_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data=data,
            )
        response.raise_for_status()
        payload = response.json()
        return self._normalize_tokens(payload)

    def _refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": OPENAI_CODEX_CLIENT_ID,
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                OPENAI_CODEX_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data=data,
            )
        response.raise_for_status()
        payload = response.json()
        return self._normalize_tokens(payload)

    def _normalize_tokens(self, payload: dict[str, Any]) -> dict[str, Any]:
        access_token = str(payload.get("access_token") or "")
        refresh_token = str(payload.get("refresh_token") or "")
        expires_in = int(payload.get("expires_in") or 0)
        if not access_token or not refresh_token or expires_in <= 0:
            raise ValueError("OAuth token response missing required fields")
        jwt_payload = self._decode_jwt(access_token)
        auth_claim = jwt_payload.get(OPENAI_CODEX_JWT_CLAIM_PATH, {}) if isinstance(jwt_payload, dict) else {}
        account_id = str(auth_claim.get("chatgpt_account_id") or "")
        if not account_id:
            raise ValueError("Failed to extract ChatGPT account ID from OAuth token")
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": int(time.time() * 1000) + expires_in * 1000,
            "account_id": account_id,
        }

    def _decode_jwt(self, token: str) -> dict[str, Any]:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        return json.loads(decoded.decode("utf-8"))


openai_codex_oauth_manager = OpenAICodexOAuthManager()

