#!/bin/bash
# 真正的一条命令安装入口（macOS）
# 用法：
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/txyelva/vibe-studio/main/scripts/bootstrap-macos.sh)"

set -euo pipefail

REPO_URL="https://github.com/txyelva/vibe-studio.git"
INSTALL_DIR="${VIBE_STUDIO_DIR:-$HOME/vibe-studio}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ 该安装脚本目前仅支持 macOS"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "❌ 未找到 git，请先安装 Xcode Command Line Tools：xcode-select --install"
  exit 1
fi

echo "🎵 Vibe Studio macOS 一条命令安装"
echo "📁 安装目录: $INSTALL_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "🔄 检测到已有仓库，正在更新..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "📥 正在克隆仓库..."
  rm -rf "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

echo "🚀 开始安装..."
cd "$INSTALL_DIR"
bash ./scripts/install-macos.sh
