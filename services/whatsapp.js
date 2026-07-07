const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const logger = pino({ level: 'silent' });

class WhatsAppService {
  constructor() {
    console.log('⏳ Inizializzazione WhatsApp Client in corso...');
    
    this.isReady = false;
    this.currentQr = null;
    this.sock = null;
    this.authDir = path.join(__dirname, '..', 'auth_info');
    
    // Crea la directory auth se non esiste
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
      console.log('📁 Directory auth creata');
    }
    
    this._init();
  }

  async _init() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const { version } = await fetchLatestBaileysVersion();

      console.log(`🔗 Baileys versione: ${version.join('.')}`);

      this.sock = makeWASocket({
        version,
        auth: state,
        browser: ['Retell WhatsApp Bot', 'Chrome', '4.0.0'],
        logger,
        connectTimeout: 60000,
        keepAliveInterval: 30000,
        markOnlineOnConnect: true
      });

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        console.log(`🔄 Connection update: ${JSON.stringify({ connection, hasQr: !!qr, disconnectReason: lastDisconnect?.error?.output?.statusCode })}`);

        if (qr) {
          this.currentQr = qr;
          console.log('\n========================================');
          console.log('📱 SCANSIONA QUESTO QR CODE CON WHATSAPP');
          console.log('========================================\n');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`❌ Connessione chiusa. StatusCode: ${statusCode}. Riconnessione: ${shouldReconnect}`);
          
          this.isReady = false;
          
          if (shouldReconnect) {
            console.log('🔄 Riconnessione tra 3 secondi...');
            setTimeout(() => this._init(), 3000);
          } else {
            console.log('❌ Disconnesso definitivamente. Riscansiona il QR.');
            this.currentQr = null;
          }
        }

        if (connection === 'open') {
          this.isReady = true;
          this.currentQr = null;
          console.log('✅ WhatsApp connesso e pronto!');
        }
      });

      this.sock.ev.on('creds.update', (creds) => {
        saveCreds(creds);
        console.log('💾 Credenziali salvate');
      });

    } catch (error) {
      console.error('❌ Errore inizializzazione:', error.message);
      setTimeout(() => this._init(), 5000);
    }
  }

  getQrCode() {
    return {
      isReady: this.isReady,
      qr: this.currentQr
    };
  }

  async sendMessage(recipient, message) {
    if (!this.isReady || !this.sock) {
      console.warn('⚠️ Il client WhatsApp non è ancora pronto.');
      throw new Error('Client WhatsApp non pronto');
    }
    
    try {
      console.log(`📱 Invio messaggio WhatsApp a: ${recipient}`);
      
      let formattedRecipient = recipient.replace(/^\+/, '').replace(/\s+/g, '');
      
      if (!formattedRecipient.endsWith('@s.whatsapp.net')) {
        formattedRecipient = `${formattedRecipient}@s.whatsapp.net`;
      }
      
      const response = await this.sock.sendMessage(formattedRecipient, { text: message });
      
      console.log('✅ Messaggio WhatsApp inviato con successo');
      
      return response;
      
    } catch (error) {
      console.error('❌ Errore invio WhatsApp:', error.message);
      throw error;
    }
  }

  async sendFormattedMessage(recipient, message) {
    return this.sendMessage(recipient, message);
  }
}

module.exports = { WhatsAppService };
