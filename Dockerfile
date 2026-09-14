# ============ Stage 1: Build ============
FROM node:20-alpine AS builder

WORKDIR /app

# 先拷贝 package 文件，利用 Docker 缓存
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# 安装全部依赖（含 devDependencies，用于构建）
# 忽略 lockfile：它生成于 Windows，缺少 Linux musl 的 rollup 原生二进制（npm optional deps bug）
RUN npm install --no-package-lock

# 拷贝源码
COPY client/ ./client/
COPY server/ ./server/

# 构建前端 + 后端
RUN npm run build -w client && npm run build -w server

# ============ Stage 2: Runtime ============
FROM node:20-alpine

WORKDIR /app

# 只拷贝运行所需文件
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/client/dist ./public
COPY --from=builder /app/server/package.json ./package.json

# 仅安装生产依赖
RUN npm install --production

# 创建数据目录（JSON 数据库 + 上传图片会落在这里）
RUN mkdir -p /app/data /app/uploads

# 高德 Key 等敏感配置通过运行时环境变量传入（docker-compose / -e）
# 参见 docker-compose.yml
ENV PORT=8787
ENV DAILY_QUOTA=2000
ENV DRIVING_TTL_DAYS=7

EXPOSE 8787

# 数据持久化：挂载这两个目录即可保留行程数据和上传图片
VOLUME ["/app/data", "/app/uploads"]

CMD ["node", "dist/index.js"]
