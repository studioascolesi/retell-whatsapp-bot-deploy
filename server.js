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

// Redirect root to setup page
app.get('/', (req, res) => {
  res.redirect('/setup');
});

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
  res.sendFile('stato.html', { root: 'public' });
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

// Log ultimi webhook ricevuti (per debug)
const webhookLog = [];
const MAX_LOG = 20;

// Cache per unire call_ended + call_analyzed
// Chiave: callId, Valore: { callDetails, timestamp }
const pendingCalls = new Map();
const CALL_ANALYSIS_TIMEOUT_MS = 30_000; // 30 secondi timeout

app.get('/webhook/log', (req, res) => {
  res.json(webhookLog);
});

app.post('/webhook/retell', async (req, res) => {
  try {
    const payload = req.body;
    const event = payload.event;
    const callData = payload.call || payload.data || payload;
    
    // Salva nel log
    webhookLog.unshift({
      time: new Date().toISOString(),
      event: event,
      from: callData?.from_number,
      to: callData?.to_number,
      hasTranscript: !!(callData?.transcript || callData?.transcript_object),
      transcriptLen: (callData?.transcript || '').length,
      transcriptPreview: (callData?.transcript || '').substring(0, 100),
      segments: (callData?.transcript_object || []).length,
      keys: Object.keys(callData || {}).join(',')
    });
    if (webhookLog.length > MAX_LOG) webhookLog.length = MAX_LOG;
    
    console.log(`📋 ${event} | from: ${callData?.from_number} | transcript: ${(callData?.transcript||'').length}c | segs: ${(callData?.transcript_object||[]).length}`);
    
    if (event === 'call_started') {
      console.log('▶️  Chiamata iniziata');
      res.status(200).json({ received: true });
      return;
    }

    if (event === 'call_ended') {
      console.log('⏹️  Chiamata terminata — salvo dati in cache, attendo call_analyzed');
      
      res.status(200).json({ 
        received: true,
        status: 'waiting_for_analysis'
      });
      
      const callId = callData.call_id;
      
      console.log(`📞 Call ID: ${callId}`);
      console.log(`👤 Da: ${callData.from_number} → A: ${callData.to_number}`);
      console.log(`📝 Transcript: ${(callData.transcript||'').length}c | Segments: ${(callData.transcript_object||[]).length}`);

      // Salva in cache per unire con call_analyzed
      const callDetails = retellService.parseWebhookData(callData);
      pendingCalls.set(callId, {
        callDetails,
        callData,
        timestamp: Date.now()
      });
      console.log(`💾 Dati salvati in cache per callId: ${callId}`);
      
      // Timeout: se call_analyzed non arriva entro 30s, invia comunque con dati da transcript
      setTimeout(() => {
        const pending = pendingCalls.get(callId);
        if (pending) {
          console.log(`⏰ Timeout call_analyzed per ${callId} — invio con dati da transcript`);
          pendingCalls.delete(callId);
          
          (async () => {
            try {
              const message = formatter.formatCallReport(pending.callDetails);
              const recipient = process.env.WHATSAPP_RECIPIENT;
              await whatsappService.sendMessage(recipient, message);
              console.log('✅ Messaggio WhatsApp inviato (fallback timeout)');
            } catch (err) {
              console.error('❌ Errore invio fallback:', err.message);
            }
          })();
        }
      }, CALL_ANALYSIS_TIMEOUT_MS);
      
      return;
    }

    if (event === 'call_analyzed') {
      console.log('📊 Chiamata analizzata (call_analyzed)');
      
      res.status(200).json({ received: true });
      
      const callId = callData.call_id;
      const callAnalysis = callData.call_analysis;
      
      if (callAnalysis?.call_summary) {
        console.log(`📝 Summary: ${callAnalysis.call_summary.substring(0, 100)}...`);
        console.log(`💬 Sentiment: ${callAnalysis.user_sentiment}`);
        console.log(`✅ Successful: ${callAnalysis.call_successful}`);
      }
      
      // Recupera dati dalla cache e unisci con call_analysis
      const pending = pendingCalls.get(callId);
      if (pending) {
        pendingCalls.delete(callId);
        console.log(`🔗 Dati uniti per callId: ${callId} — invio WhatsApp con call_analysis`);
        
        // Unisci: mantieni i dati del transcript, sovrascrivi con call_analysis
        if (callAnalysis) {
          pending.callDetails.callSummary = callAnalysis.call_summary || pending.callDetails.callSummary;
          pending.callDetails.sentiment = callAnalysis.user_sentiment || pending.callDetails.sentiment;
          pending.callDetails.callSuccessful = callAnalysis.call_successful ?? pending.callDetails.callSuccessful;
          pending.callDetails.customAnalysisData = callAnalysis.custom_analysis_data || null;
        }
        
        (async () => {
          try {
            const message = formatter.formatCallReport(pending.callDetails);
            const recipient = process.env.WHATSAPP_RECIPIENT;
            await whatsappService.sendMessage(recipient, message);
            console.log('✅ Messaggio WhatsApp inviato con call_analysis!');
          } catch (err) {
            console.error('❌ Errore invio WhatsApp:', err.message);
          }
        })();
      } else {
        console.log(`ℹ️  Nessun pending per callId: ${callId} — call_ended non ancora ricevuto o già elaborato`);
      }
      
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

// Cleanup periodico della cache pending (ogni 60s)
setInterval(() => {
  const now = Date.now();
  for (const [callId, entry] of pendingCalls) {
    if (now - entry.timestamp > 60_000) {
      console.log(`🧹 Rimuovo pending scaduto: ${callId}`);
      pendingCalls.delete(callId);
    }
  }
}, 60_000);

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
