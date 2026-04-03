#!/bin/bash
# 卸载 macOS launchd 常驻服务。

set -euo pipefail

PLIST_PATH="$HOME/Library/LaunchAgents/com.ttpg.vibe-studio.plist"
LABEL="com.ttpg.vibe-studio"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ 该脚本仅支持 macOS"
  exit 1
fi

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"

echo "✅ 已卸载 $LABEL"
