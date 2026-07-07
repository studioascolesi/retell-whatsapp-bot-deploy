const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
  constructor() {
    console.log('⏳ Inizializzazione WhatsApp Client in corso...');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: "retell-bot" // Nome della sessione
      }),
      puppeteer: {
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--single-process',
          '--disable-features=dbus'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        headless: true
      }
    });

    this.isReady = false;
    this.currentQr = null; // Memorizza l'ultimo QR code generato

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
      this.currentQr = null; // Svuota il QR code una volta connesso
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
    
    // Inizializza il client per generare il QR o riprendere la sessione
    this.client.initialize();
  }

  /**
   * Ottieni lo stato e l'eventuale QR code del client
   */
  getQrCode() {
    return {
      isReady: this.isReady,
      qr: this.currentQr
    };
  }

  /**
   * Invia un messaggio WhatsApp
   */
  async sendMessage(recipient, message) {
    if (!this.isReady) {
      console.warn('⚠️ Il client WhatsApp non è ancora pronto. Impossibile inviare il messaggio ora.');
      throw new Error('Client WhatsApp non pronto');
    }
    
    try {
      console.log(`📱 Invio messaggio WhatsApp a: ${recipient}`);
      
      // Formatta il numero (rimuovi + iniziale se presente e spazi)
      let formattedRecipient = recipient.replace(/^\+/, '').replace(/\s+/g, '');
      
      // whatsapp-web.js richiede il suffisso @c.us per i numeri normali
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

  /**
   * Invia un messaggio con formattazione
   */
  async sendFormattedMessage(recipient, message) {
    return this.sendMessage(recipient, message);
  }
}

module.exports = { WhatsAppService };
