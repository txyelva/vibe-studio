# 极简 Docker 部署
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# 复制后端代码和预构建前端
COPY vibe_studio/ ./vibe_studio/

# 创建配置目录
RUN mkdir -p /root/.vibe-studio

# 暴露端口
EXPOSE 7788

# 启动命令
CMD ["vibe-studio"]
