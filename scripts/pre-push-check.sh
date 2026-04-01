#!/bin/bash
# 预上传检查脚本 - 确保没有敏感信息泄露

set -e

echo "🔍 检查敏感信息..."

# 检查常见的敏感信息模式
PATTERNS=(
    "sk-[a-zA-Z0-9]{20,}"           # API Keys (OpenAI, Anthropic 等)
    "[a-zA-Z0-9]{32,}-[a-zA-Z0-9]{10,}" # 其他 API key 格式
    "password.*=.*[^\s]"            # 明文密码
    "secret.*=.*[^\s]"              # 明文密钥
    "BEGIN.*PRIVATE KEY"            # 私钥
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
    # 排除函数定义、变量名、注释等误报
    results=$(grep -r -E "$pattern" vibe_studio --include="*.py" --include="*.json" 2>/dev/null | \
        grep -v "__pycache__" | \
        grep -v "token_urlsafe\|token_hex\|secrets\." | \
        grep -v "def.*password\|def.*secret" | \
        grep -v "password_hash\|password: str\|secret_key" | \
        grep -v "#\|\"\"\"\|'" | \
        grep -v "get_password_hash\|verify_password" | \
        grep -v "SECRET_KEY_FILE\|get_or_create_secret" || true)
    
    if [ -n "$results" ]; then
        echo "❌ 发现潜在敏感信息匹配: $pattern"
        echo "$results"
        FOUND=1
    fi
done

if [ $FOUND -eq 1 ]; then
    echo ""
    echo "⚠️  发现潜在敏感信息，请检查并清理后再上传！"
    exit 1
fi

# 检查文件大小
MAX_SIZE=10485760  # 10MB
for file in $(find . -type f -not -path "./.git/*" -not -path "./.venv/*" -not -path "./node_modules/*"); do
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    if [ $size -gt $MAX_SIZE ]; then
        echo "⚠️  文件过大: $file ($(($size/1024/1024))MB)"
    fi
done

echo "✅ 检查通过！"
echo ""
echo "📋 上传前请确认："
echo "  1. .gitignore 已正确配置"
echo "  2. 没有提交 .env 文件"
echo "  3. 没有提交 node_modules 或 .venv"
echo "  4. 测试脚本: ./scripts/setup.sh"
