# Vibe Studio

🎵 一个支持多模型切换的 AI 编程助手，基于 React + FastAPI 构建。

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## 功能特性

- 🤖 **多模型支持**: OpenAI, Anthropic Claude, Google Gemini, Moonshot Kimi, DeepSeek, MiniMax, 智谱 AI 等
- 💬 **线程级模型切换**: 每个对话可独立选择模型，默认跟随主模型
- 🔧 **内置工具**: 文件读写、代码搜索、命令执行、智能替换
- 🔄 **AI 工具发现**: 自动检测 OpenClaw, Codex, Claude Code 等已安装的 AI CLI 工具
- 📁 **项目管理**: 支持多项目、本地目录选择
- 🔐 **JWT 认证**: 安全的登录机制，支持环境变量配置

## 快速开始

### 方式一：使用设置脚本

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd vibe-studio

# 2. 运行设置脚本
./scripts/setup.sh

# 3. 启动服务
source .venv/bin/activate
vibe-studio
```

### 方式二：手动安装

```bash
# 1. 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2. 安装依赖
pip install -e .

# 3. 构建前端（可选）
cd react && npm install && npm run build && cd ..

# 4. 启动服务
vibe-studio
```

访问 http://localhost:7788

## 配置说明

### 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VIBE_JWT_SECRET` | JWT 签名密钥 | 自动生成 |
| `VIBE_CONFIG_DIR` | 配置目录 | `~/.vibe-studio` |
| `ANTHROPIC_API_KEY` | Claude API Key | - |
| `OPENAI_API_KEY` | OpenAI API Key | - |

### 配置文件

配置文件存储在用户目录下 `~/.vibe-studio/config.json`：

```json
{
  "setup_complete": true,
  "primary_model": "anthropic/claude-sonnet-4",
  "providers": {
    "anthropic": {
      "api_key": "${ANTHROPIC_API_KEY}",
      "api_type": "anthropic"
    }
  }
}
```

**注意**: API Key 支持 `${ENV_VAR}` 语法从环境变量读取。

## 支持的模型提供商

| 提供商 | 类型 | 说明 |
|--------|------|------|
| OpenAI | GPT-4o, o3, o1 | 原生 OpenAI API |
| Anthropic | Claude Opus/Sonnet/Haiku | 原生 Anthropic API |
| MiniMax | M2.7, M2.5, Text-01 | Token Plan (Anthropic 兼容) |
| Moonshot | Kimi K2 | OpenAI 兼容 |
| DeepSeek | V3, R1 | OpenAI 兼容 |
| Google Gemini | 2.5 Pro/Flash | OpenAI 兼容 |
| 智谱 AI | GLM-4 | OpenAI 兼容 |
| 火山引擎 | 豆包 | OpenAI 兼容 |

## 开发

### 项目结构

```
vibe-studio/
├── vibe_studio/          # 后端 (FastAPI)
│   ├── api/              # REST API & WebSocket
│   ├── agent/            # AI Agent 核心
│   ├── config.py         # 配置管理
│   └── server.py         # 服务入口
├── react/                # 前端 (React + Vite)
│   ├── src/
│   │   ├── views/        # 页面组件
│   │   ├── components/   # 通用组件
│   │   └── store.ts      # 状态管理
│   └── dist/             # 构建输出
├── scripts/              # 工具脚本
└── README.md
```

### 开发模式

```bash
# 终端 1: 启动后端
cd vibe-studio
source .venv/bin/activate
python -m vibe_studio

# 终端 2: 启动前端开发服务器
cd react
npm run dev
```

### 构建

```bash
cd react
npm run build
```

构建输出在 `react/dist/`，会自动复制到 `vibe_studio/dist/`。

## 安全注意事项

⚠️ **上传前请务必执行**:

```bash
./scripts/pre-push-check.sh
```

检查清单：
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] `node_modules/` 和 `.venv/` 不在仓库中
- [ ] 没有硬编码的 API Keys
- [ ] `~/.vibe-studio/` 配置目录未上传

## 命令参考

在对话中可使用以下命令：

| 命令 | 说明 |
|------|------|
| `/status` | 查看当前模型和配置状态 |
| `/model <provider>/<model>` | 切换当前对话的模型 |

## 许可证

MIT License

## 致谢

- UI 设计基于 [Pixso](https://pixso.cn)
- 图标来自 [Lucide](https://lucide.dev)
