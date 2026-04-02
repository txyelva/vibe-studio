#!/bin/bash
# Vibe Studio 一键安装脚本

set -e

REPO_URL="https://github.com/txyelva/vibe-studio"
INSTALL_DIR="$HOME/.local/share/vibe-studio"
VENV_DIR="$INSTALL_DIR/.venv"

echo "🎵 Vibe Studio 安装脚本"
echo "========================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要 Python 3.9+，请先安装 Python"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
echo "✅ Python 版本: $PYTHON_VERSION"

# 创建安装目录
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 下载最新 release（如果有）或使用 git
if command -v git &> /dev/null; then
    echo "📥 克隆仓库..."
    if [ -d ".git" ]; then
        git pull
    else
        git clone --depth 1 "$REPO_URL.git" .
    fi
else
    echo "📥 下载源码..."
    curl -L "$REPO_URL/archive/refs/heads/main.tar.gz" | tar xz --strip-components=1
fi

# 创建虚拟环境
echo "📦 创建虚拟环境..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

# 安装依赖
echo "📥 安装依赖..."
pip install --upgrade pip
pip install -e .

# 创建启动脚本
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/vibe-studio" << 'EOF'
#!/bin/bash
source "$HOME/.local/share/vibe-studio/.venv/bin/activate"
exec vibe-studio "$@"
EOF
chmod +x "$HOME/.local/bin/vibe-studio"

# 添加到 PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
fi

echo ""
echo "✅ 安装完成！"
echo ""
echo "🚀 启动方式："
echo "   1. 直接运行: vibe-studio"
echo "   2. 访问: http://localhost:7788"
echo ""
echo "📁 配置目录: ~/.vibe-studio/"
echo ""

# 提示添加到当前 shell
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "⚠️  请运行以下命令使 PATH 生效："
    echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
