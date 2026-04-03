#!/bin/bash
# Archive known drift files from the live runtime copy instead of deleting them.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_LIVE_DIR="$(cd "$PUBLIC_DIR/.." && pwd)/vibe-studio"
LIVE_DIR="${1:-$DEFAULT_LIVE_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_DIR="$LIVE_DIR/_archive/live-drift-$STAMP"

if [ ! -d "$LIVE_DIR" ]; then
  echo "❌ live 目录不存在: $LIVE_DIR"
  exit 1
fi

mkdir -p "$ARCHIVE_DIR"

move_if_exists() {
  local rel="$1"
  local src="$LIVE_DIR/$rel"
  local dst="$ARCHIVE_DIR/$rel"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    mv "$src" "$dst"
    echo "📦 已归档: $rel"
  fi
}

move_if_exists "vibe_studio/database"
move_if_exists "vibe_studio/db_config.py"
move_if_exists "frontend"
move_if_exists "markdown_example.md"
move_if_exists "react-设计文件.zip"
move_if_exists "设计文件.pxhm"
move_if_exists ".DS_Store"
move_if_exists "vibe_studio/.DS_Store"
move_if_exists "react/src/.DS_Store"

echo "✅ 归档完成: $ARCHIVE_DIR"
