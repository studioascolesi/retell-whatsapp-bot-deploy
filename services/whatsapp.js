const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let chromium;
try {
  chromium = require('@sparticuz/chromium');
} catch (e) {
  // Fallback locale - non serve su Render
  chromium = null;
}

class WhatsAppService {
  constructor() {
    console.log('⏳ Inizializzazione WhatsApp Client in corso...');
    
    this.isReady = false;
    this.currentQr = null;
    this.client = null;
    
    this._init();
  }

  async _init() {
    const puppeteerConfig = await this._getPuppeteerConfig();
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "retell-bot"
      }),
      puppeteer: puppeteerConfig
    });

    this.client.on('qr', (qr) => {
      this.currentQr = qr;
      console.log('\n========================================');
      console.log('📱 SCANSIONA QUESTO QR CODE CON WHATSAPP');
      console.log('========================================\n');
      qrcode.generate(qr, { small: true });
      console.log('Attendendo la scansione per completare il login...');
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.currentQr = null;
      console.log('✅ WhatsApp Web Client è pronto e connesso!');
    });

    this.client.on('authenticated', () => {
      console.log('✅ Autenticazione WhatsApp riuscita');
    });

    this.client.on('auth_failure', msg => {
      console.error('❌ Errore autenticazione WhatsApp:', msg);
    });

    this.client.on('disconnected', (reason) => {
      this.isReady = false;
      console.log('❌ WhatsApp disconnesso:', reason);
    });

    this.client.initialize();
  }

  async _getPuppeteerConfig() {
    // Su Render / serverless usa @sparticuz/chromium
    if (chromium) {
      const execPath = await chromium.executablePath();
      return {
        args: chromium.args,
        executablePath: execPath,
        headless: chromium.headless,
      };
    }

    // Fallback locale
    return {
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
    };
  }

  getQrCode() {
    return {
      isReady: this.isReady,
      qr: this.currentQr
    };
  }

  async sendMessage(recipient, message) {
    if (!this.isReady) {
      console.warn('⚠️ Il client WhatsApp non è ancora pronto.');
      throw new Error('Client WhatsApp non pronto');
    }
    
    try {
      console.log(`📱 Invio messaggio WhatsApp a: ${recipient}`);
      
      let formattedRecipient = recipient.replace(/^\+/, '').replace(/\s+/g, '');
      
      if (!formattedRecipient.endsWith('@c.us')) {
        formattedRecipient = `${formattedRecipient}@c.us`;
      }
      
      const response = await this.client.sendMessage(formattedRecipient, message);
      
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
