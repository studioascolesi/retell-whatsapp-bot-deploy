require('dotenv').config();
const express = require('express');
const cors = require('cors');
const moment = require('moment');
const { RetellService } = require('./services/retell');
const { WhatsAppService } = require('./services/whatsapp');
const { MessageFormatter } = require('./services/formatter');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servizi
const retellService = new RetellService();
const whatsappService = new WhatsAppService();
const formatter = new MessageFormatter();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    service: 'Retell-WhatsApp Bot'
  });
});

// ============================================
// SETUP WHATSAPP WEB
// Pagina web per scansionare il QR code
// ============================================
app.get('/setup', async (req, res) => {
  try {
    const status = whatsappService.getQrCode();
    
    if (status.isReady) {
      return res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
            <h1 style="color: #4CAF50;">✅ WhatsApp è già connesso!</h1>
            <p>Il bot è pronto per inviare messaggi automaticamente. Non c'è bisogno di scansionare il QR code di nuovo.</p>
          </body>
        </html>
      `);
    }

    if (!status.qr) {
      return res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
            <h1>⏳ Caricamento...</h1>
            <p>Il bot si sta avviando o sta recuperando il QR code. Ricarica la pagina tra qualche secondo.</p>
            <script>setTimeout(() => window.location.reload(), 5000);</script>
          </body>
        </html>
      `);
    }

    const qrImage = await qrcode.toDataURL(status.qr);
    
    res.send(`
      <html>
        <head>
          <title>Collega WhatsApp</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #f0f2f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #075E54; margin-top: 0;">Collega il tuo WhatsApp</h2>
            <p>1. Apri WhatsApp sul tuo telefono</p>
            <p>2. Vai su <b>Impostazioni > Dispositivi collegati</b></p>
            <p>3. Inquadra questo QR Code:</p>
            <img src="${qrImage}" style="width: 250px; height: 250px; border: 1px solid #ccc; padding: 10px; border-radius: 10px;" />
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Questa pagina si aggiornerà automaticamente dopo la scansione.</p>
          </div>
          <script>
            // Polling per ricaricare se si connette
            setInterval(() => {
              fetch('/health').then(() => {
                // Non fa nulla per ora, ma si potrebbe fare un polling all'endpoint setup per vedere lo stato
              });
            }, 5000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Errore durante la generazione della pagina di setup: ' + err.message);
  }
});

// ============================================
// WEBHOOK RETELL AI
// Riceve notifiche quando una chiamata termina
// ============================================
app.post('/webhook/retell', async (req, res) => {
  console.log('\n========================================');
  console.log('📞 NUOVA CHIAMATA RICEVUTA DA RETELL AI');
  console.log('========================================');
  
  try {
    const payload = req.body;
    console.log('📋 Payload ricevuto:', JSON.stringify(payload, null, 2));

    // Verifica il tipo di evento
    const event = payload.event;
    
    if (event === 'call_started') {
      console.log('▶️  Chiamata iniziata');
      res.status(200).json({ received: true });
      return;
    }

    if (event === 'call_ended') {
      console.log('⏹️  Chiamata terminata - Elaborazione in corso in background...');
      
      res.status(200).json({ 
        received: true,
        status: 'processing_in_background'
      });
      
      const callData = payload.call;
      const callId = callData.call_id;
      
      console.log(`📞 Call ID: ${callId}`);
      console.log(`👤 Persona: ${callData.from_number} → ${callData.to_number}`);

      (async () => {
        try {
          const callDetails = retellService.parseWebhookData(callData);
          const message = formatter.formatCallReport(callDetails);
          
          const recipient = process.env.WHATSAPP_RECIPIENT;
          await whatsappService.sendMessage(recipient, message);
          
          console.log('✅ Elaborazione webhook completata con successo!');
          console.log('========================================\n');
        } catch (bgError) {
          console.error('❌ Errore durante l\'elaborazione in background:', bgError.message);
        }
      })();
      
      return;
    }

    // Per altri eventi
    console.log(`ℹ️  Evento ricevuto: ${event}`);
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('❌ Errore durante l\'elaborazione:', error.message);
    res.status(500).json({ 
      error: 'Errore elaborazione webhook',
      details: error.message 
    });
  }
});

// Endpoint per testare l'invio WhatsApp manualmente
app.post('/test/whatsapp', async (req, res) => {
  try {
    const { recipient, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Messaggio richiesto' });
    }
    
    const target = recipient || process.env.WHATSAPP_RECIPIENT;
    await whatsappService.sendMessage(target, message);
    
    res.json({ success: true, recipient: target });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint per visualizzare le chiamate recenti
app.get('/calls/recent', async (req, res) => {
  try {
    const calls = await retellService.getRecentCalls();
    res.json({ calls });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Avvio server
app.listen(PORT, () => {
  console.log('\n🚀 ====================================');
  console.log('   RETELL-WHATSAPP BOT IN AVVIO');
  console.log('========================================\n');
  console.log(`📍 Server in ascolto sulla porta: ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 Setup WhatsApp: http://localhost:${PORT}/setup`);
  console.log(`📞 Webhook Retell: http://localhost:${PORT}/webhook/retell`);
  console.log(`🧪 Test WhatsApp: http://localhost:${PORT}/test/whatsapp`);
  console.log('\n========================================');
  console.log('📋 ISTRUZIONI:');
  console.log('========================================');
  console.log('1. Configura le variabili d\'ambiente nel file .env');
  console.log('2. Scansiona il QR Code che appare qui sopra con l\'app WhatsApp per collegare il bot');
  console.log('3. Usa ngrok per esporre il server: ngrok http 3000');
  console.log('4. Configura l\'URL del webhook in Retell AI');
  console.log('========================================\n');
});
