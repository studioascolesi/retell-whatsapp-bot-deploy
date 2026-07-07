FROM node:20-slim

# Installa Chrome/Chromium per Puppeteer (necessario per whatsapp-web.js)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Imposta variabile per Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copia package files e installa dipendenze
COPY package*.json ./
RUN npm ci --only=production

# Copia il resto del codice
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
