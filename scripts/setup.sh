#!/bin/bash
# Vibe Studio 兼容设置脚本。
# macOS 下推荐改用 scripts/install-macos.sh。

set -e

echo "🎵 Vibe Studio 设置脚本"
echo ""

if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "💡 macOS 推荐使用一键安装脚本：./scripts/install-macos.sh"
    echo ""
fi

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要 Python 3.9+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Python 版本: $PYTHON_VERSION"

# 创建虚拟环境
echo ""
echo "📦 创建虚拟环境..."
python3 -m venv .venv
source .venv/bin/activate

# 安装依赖
echo ""
echo "📥 安装 Python 依赖..."
pip install -e .

# 创建必要目录
echo ""
echo "📁 创建配置目录..."
CONFIG_DIR="$HOME/.vibe-studio"
mkdir -p "$CONFIG_DIR"

# 询问是否创建示例配置
echo ""
read -p "是否创建示例配置文件? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ ! -f "$CONFIG_DIR/config.json" ]; then
        echo '{}' > "$CONFIG_DIR/config.json"
        echo "✅ 已创建空配置文件: $CONFIG_DIR/config.json"
    else
        echo "⚠️  配置文件已存在，跳过"
    fi
fi

# 前端构建（可选）
echo ""
read -p "是否构建前端? (需要 Node.js) (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v npm &> /dev/null; then
        echo "🔨 构建前端..."
        cd react && npm install && npm run build && cd ..
        echo "✅ 前端构建完成"
    else
        echo "⚠️  未找到 Node.js，跳过前端构建"
    fi
fi

echo ""
echo "✨ 设置完成!"
echo ""
echo "🚀 启动服务:"
echo "   source .venv/bin/activate"
echo "   vibe-studio"
echo ""
echo "📖 访问 http://localhost:7788"
