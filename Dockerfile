FROM node:20-alpine

WORKDIR /app

COPY Backend/package*.json ./Backend/
COPY ai-service/package*.json ./ai-service/
RUN npm ci --omit=dev --prefix ./Backend && npm ci --omit=dev --prefix ./ai-service

COPY Backend ./Backend
COPY ai-service ./ai-service

EXPOSE 3000 5001

CMD ["sh", "-c", "PORT=5001 node /app/ai-service/src/server.js & node /app/Backend/server.js"]