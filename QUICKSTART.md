# Vibe Studio - 快速开始

## 🚀 三种安装方式（选一种）

### 方式 1: 一行命令安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/txyelva/vibe-studio/main/install.sh | bash
```

然后运行：
```bash
vibe-studio
```

---

### 方式 2: Docker（最简单，无需 Python）

```bash
# 克隆仓库
git clone https://github.com/txyelva/vibe-studio.git
cd vibe-studio

# 一键启动
docker-compose up -d
```

访问 http://localhost:7788

---

### 方式 3: 手动安装

```bash
# 1. 克隆仓库
git clone https://github.com/txyelva/vibe-studio.git
cd vibe-studio

# 2. 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. 安装（前端已预构建，无需 npm）
pip install -e .

# 4. 启动
vibe-studio
```

---

## 📁 配置

首次访问 http://localhost:7788 会自动跳转到设置页面：

1. 选择 AI 提供商（OpenAI / Anthropic / MiniMax 等）
2. 输入 API Key
3. 设置工作目录
4. 完成！

---

## 🔧 系统要求

- **Python**: 3.9+
- **操作系统**: macOS / Linux / Windows
- **内存**: 512MB+
- **磁盘**: 50MB（已包含前端构建文件）

---

## 🐳 Docker 命令

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down

# 更新到最新版本
git pull
docker-compose up -d --build
```

---

## ❓ 常见问题

**Q: 需要 Node.js 吗？**  
A: 不需要！前端已预构建并包含在 Python 包中。

**Q: 支持离线使用吗？**  
A: 需要联网调用 AI API，但界面完全离线可用。

**Q: 如何更新？**  
A: Docker: `docker-compose up -d --build`  
A: 手动: `git pull && pip install -e .`
