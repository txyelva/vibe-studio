#!/bin/bash
# Sync the public repo into the live runtime copy, then rebuild and restart.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_LIVE_DIR="$(cd "$PUBLIC_DIR/.." && pwd)/vibe-studio"
LIVE_DIR="${1:-$DEFAULT_LIVE_DIR}"

if [ ! -d "$LIVE_DIR" ]; then
  echo "❌ live 目录不存在: $LIVE_DIR"
  exit 1
fi

echo "🔄 同步代码到 live: $LIVE_DIR"

rsync -a "$PUBLIC_DIR/pyproject.toml" "$LIVE_DIR/pyproject.toml"
rsync -a "$PUBLIC_DIR/start.sh" "$LIVE_DIR/start.sh"
rsync -a --delete "$PUBLIC_DIR/vibe_studio/" "$LIVE_DIR/vibe_studio/"
rsync -a "$PUBLIC_DIR/react/package.json" "$LIVE_DIR/react/package.json"
rsync -a "$PUBLIC_DIR/react/index.html" "$LIVE_DIR/react/index.html"
rsync -a "$PUBLIC_DIR/react/tsconfig.json" "$LIVE_DIR/react/tsconfig.json"
rsync -a "$PUBLIC_DIR/react/tsconfig.app.json" "$LIVE_DIR/react/tsconfig.app.json"
rsync -a "$PUBLIC_DIR/react/tsconfig.node.json" "$LIVE_DIR/react/tsconfig.node.json"
rsync -a "$PUBLIC_DIR/react/vite.config.ts" "$LIVE_DIR/react/vite.config.ts"
rsync -a --delete "$PUBLIC_DIR/react/src/" "$LIVE_DIR/react/src/"

echo "📦 构建前端"
cd "$LIVE_DIR/react"
npm run build

echo "📁 同步前端产物"
rsync -a --delete "$LIVE_DIR/react/dist/" "$LIVE_DIR/vibe_studio/dist/"

echo "🚀 重启服务"
old_pids="$(lsof -ti :7788 || true)"
if [ -n "$old_pids" ]; then
  echo "$old_pids" | xargs kill || true
  sleep 2
fi

remaining_pids="$(lsof -ti :7788 || true)"
if [ -n "$remaining_pids" ]; then
  echo "$remaining_pids" | xargs kill -9 || true
  sleep 1
fi

cd "$LIVE_DIR"
source .venv/bin/activate
nohup python -m vibe_studio >/tmp/vibe.log 2>&1 &
sleep 4

if lsof -i :7788 >/dev/null 2>&1; then
  echo "✅ 服务已启动: http://127.0.0.1:7788/"
else
  echo "❌ 服务未启动，请检查 /tmp/vibe.log"
  exit 1
fi
