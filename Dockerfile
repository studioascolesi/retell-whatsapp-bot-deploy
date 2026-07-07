FROM node:20-slim

RUN apt-get update && apt-get install -y \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
