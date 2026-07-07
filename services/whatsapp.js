const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

const logger = pino({ level: 'silent' });

class WhatsAppService {
  constructor() {
    console.log('⏳ Inizializzazione WhatsApp Client in corso...');
    
    this.isReady = false;
    this.currentQr = null;
    this.sock = null;
    this.authDir = path.join(__dirname, '..', 'auth_info');
    
    this._init();
  }

  async _init() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      browser: ['Retell WhatsApp Bot', 'Chrome', '4.0.0'],
      logger
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.currentQr = qr;
        console.log('\n========================================');
        console.log('📱 SCANSIONA QUESTO QR CODE CON WHATSAPP');
        console.log('========================================\n');
        qrcode.generate(qr, { small: true });
        console.log('Attendendo la scansione per completare il login...');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`❌ Connessione chiusa. Motivo: ${statusCode}. Riconnessione: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          setTimeout(() => this._init(), 3000);
        } else {
          this.isReady = false;
          console.log('❌ Disconnesso definitivamente. Riscansiona il QR.');
        }
      }

      if (connection === 'open') {
        this.isReady = true;
        this.currentQr = null;
        console.log('✅ WhatsApp Web Client è pronto e connesso!');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
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
