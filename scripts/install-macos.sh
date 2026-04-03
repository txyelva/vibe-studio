#!/bin/bash
# 一键安装 Vibe Studio（macOS）
# 会创建虚拟环境、安装 Python 依赖、构建前端，并安装 launchd 常驻服务。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ 该一键安装脚本目前仅支持 macOS"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 未找到 python3，请先安装 Python 3.9+"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 未找到 npm，请先安装 Node.js 18+"
  exit 1
fi

cd "$APP_DIR"

echo "🎵 Vibe Studio 一键安装"
echo ""
echo "1/5 创建虚拟环境"
python3 -m venv .venv

echo "2/5 安装 Python 依赖"
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e .

echo "3/5 构建前端"
cd react
npm install
npm run build
cd "$APP_DIR"

echo "4/5 准备配置目录"
mkdir -p "$HOME/.vibe-studio"

echo "5/5 安装并启动 macOS 常驻服务"
"$SCRIPT_DIR/install-launchd.sh"

echo ""
echo "✅ 安装完成"
echo "🌐 打开 http://127.0.0.1:7788/"
echo "📄 日志位于 /tmp/vibe-studio-launchd.log"
