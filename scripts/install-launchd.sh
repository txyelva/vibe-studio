#!/bin/bash
# 安装 macOS launchd 常驻服务，让 Vibe Studio 在 7788 端口稳定运行。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON_BIN="$APP_DIR/.venv/bin/python"
PLIST_PATH="$HOME/Library/LaunchAgents/com.vibestudio.app.plist"
LABEL="com.vibestudio.app"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ launchd 安装脚本仅支持 macOS"
  exit 1
fi

if [ ! -x "$PYTHON_BIN" ]; then
  echo "❌ 未找到虚拟环境 Python: $PYTHON_BIN"
  echo "请先在项目根目录执行:"
  echo "  python3 -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install -e ."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>-m</string>
    <string>vibe_studio</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/vibe-studio-launchd.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/vibe-studio-launchd.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PYTHONUNBUFFERED</key>
    <string>1</string>
  </dict>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load -w "$PLIST_PATH"
sleep 3

if lsof -i :7788 | grep LISTEN >/dev/null 2>&1; then
  echo "✅ launchd 服务已启动: http://127.0.0.1:7788/"
  echo "📄 日志: /tmp/vibe-studio-launchd.log"
else
  echo "❌ 服务未成功启动，请检查 /tmp/vibe-studio-launchd.log"
  exit 1
fi
