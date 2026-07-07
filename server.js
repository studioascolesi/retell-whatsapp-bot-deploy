require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
app.use(express.static(path.join(__dirname, 'public')));

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

// Pagina stato stilizzata
app.get('/stato', (req, res) => {
  res.sendFile('health.html', { root: 'public' });
});

app.get('/status', (req, res) => {
  const waStatus = whatsappService.getQrCode();
  res.json({
    whatsapp: {
      connected: waStatus.isReady,
      hasQr: !!waStatus.qr
    }
  });
});

// Disconnetti WhatsApp e genera nuovo QR
app.post('/disconnect', async (req, res) => {
  try {
    console.log('🔌 Richiesta disconnessione WhatsApp...');
    const result = await whatsappService.disconnect();
    res.json(result);
  } catch (error) {
    console.error('❌ Errore disconnect:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SETUP WHATSAPP WEB
// Pagina premium per scansionare il QR code
// ============================================
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// QR code come JSON (per polling AJAX)
app.get('/qr', async (req, res) => {
  try {
    const status = whatsappService.getQrCode();
    
    if (status.isReady) {
      return res.json({ connected: true, qr: null });
    }

    if (!status.qr) {
      return res.json({ connected: false, qr: null });
    }

    const qrImage = await qrcode.toDataURL(status.qr);
    res.json({ connected: false, qr: qrImage });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
