# 현담토목 업무관리 - 서버 이미지
# 1단계: 의존성 설치와 빌드
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 2단계: 실행에 필요한 파일만 담은 작은 이미지
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app && mkdir -p /app/data && chown -R app:app /app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.js"]
