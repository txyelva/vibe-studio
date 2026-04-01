#!/bin/bash
# Vibe Studio 快速启动脚本
# 用法: ./start.sh [项目目录]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv"

# 切换到指定的工作目录（如果提供了参数）
if [ -n "$1" ]; then
  cd "$1"
  echo "📁 工作目录: $1"
fi

# 激活虚拟环境
if [ -f "$VENV/bin/vibe-studio" ]; then
  exec "$VENV/bin/vibe-studio"
else
  echo "❌ 请先运行安装:"
  echo "   cd $SCRIPT_DIR"
  echo "   /opt/homebrew/bin/python3.13 -m venv .venv"
  echo "   .venv/bin/pip install -e ."
  exit 1
fi
