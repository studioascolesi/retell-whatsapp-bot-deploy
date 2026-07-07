FROM node:20-slim

# Installa Chrome/Chromium + dbus per Puppeteer (necessario per whatsapp-web.js)
RUN apt-get update && apt-get install -y \
    chromium \
    dbus \
    dbus-x11 \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/dbus \
    && dbus-uuidgen > /var/lib/dbus/machine-id

# Imposta variabile per Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null

WORKDIR /app

# Copia package files e installa dipendenze
COPY package*.json ./
RUN npm ci --only=production

# Copia il resto del codice
COPY . .

EXPOSE 3000

# Avvia dbus e poi il server
CMD dbus-daemon --system --fork 2>/dev/null; exec node server.js
