# 安全指南

## 脱敏检查清单

在将项目上传到 Git 仓库前，请确保完成以下检查：

### 1. 敏感文件检查

```bash
# 运行自动检查脚本
./scripts/pre-push-check.sh
```

### 2. 手动检查清单

#### API Keys 和密钥
- [ ] 没有硬编码的 API Keys (`sk-...`)
- [ ] 没有硬编码的密码或密钥
- [ ] JWT Secret 使用自动生成或环境变量

#### 配置文件
- [ ] `~/.vibe-studio/config.json` 未上传
- [ ] `.env` 文件已添加到 `.gitignore`
- [ ] `.env.example` 已提供（不含真实密钥）

#### 依赖目录
- [ ] `node_modules/` 在 `.gitignore` 中
- [ ] `.venv/` 或 `venv/` 在 `.gitignore` 中
- [ ] `__pycache__/` 在 `.gitignore` 中

#### 用户数据
- [ ] `conversations/` 目录未上传
- [ ] `vibe_studio/data/` 目录未上传
- [ ] 日志文件未上传

### 3. 文件大小检查

```bash
# 检查大文件
find . -type f -size +10M -not -path "./.git/*"
```

不应上传的文件：
- 设计源文件 (`.pxhm`, `react-设计文件.zip`)
- 字体文件 (如果很大)
- 测试数据

### 4. Git 提交前检查

```bash
# 查看将要提交的文件
git status

# 检查每个文件内容
git diff --cached

# 确保没有敏感信息
git diff --cached | grep -E "sk-[a-zA-Z0-9]|api_key|password|secret"
```

### 5. 清理历史（如已泄露）

如果之前不小心提交了敏感信息：

```bash
# 使用 git-filter-repo 清理 (需安装)
git filter-repo --path config.json --invert-paths

# 或使用 BFG Repo-Cleaner
bfg --delete-files config.json
```

## 安全最佳实践

1. **使用环境变量**: API Keys 通过环境变量或配置文件注入
2. **配置文件分离**: 用户配置存储在 `~/.vibe-studio/`，不在项目目录
3. **JWT Secret 自动生成**: 首次运行时自动生成随机密钥
4. **文件权限**: 配置文件设置为 `600` 权限

## 报告安全问题

如发现安全漏洞，请通过以下方式报告：
- 不要公开创建 Issue
- 发送邮件至: [your-email]
