FROM node:20-slim

# Installa solo le dipendenze di sistema minime per Chromium
RUN apt-get update && apt-get install -y \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# @sparticuz/chromium scarica il proprio binario - non serve chromium di sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV NODE_ENV=production

WORKDIR /app

# Copia package files e installa dipendenze
COPY package*.json ./
RUN npm ci --only=production

# Copia il resto del codice
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
