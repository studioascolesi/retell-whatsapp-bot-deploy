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
app.get('/clienti', (req, res) => {
  res.sendFile('clienti.html', { root: 'public' });
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
// CLIENT DATABASE
// Lookup clienti per telefono
// ============================================
const fs = require('fs');
const CLIENTS_PATH = fs.existsSync('/data')
  ? path.join('/data', 'clients.json')
  : path.join(__dirname, 'clients.json');

// Seed clients.json nel Volume se non esiste ancora
if (fs.existsSync('/data') && !fs.existsSync(CLIENTS_PATH)) {
  const seedPath = path.join(__dirname, 'clients.json');
  if (fs.existsSync(seedPath)) {
    fs.copyFileSync(seedPath, CLIENTS_PATH);
    console.log(`🌱 [CLIENTS] Seed clients.json nel Volume da cartella app`);
  }
}

function loadClients() {
  try {
    const raw = fs.readFileSync(CLIENTS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('⚠️  clients.json non trovato o illeggibile:', e.message);
    return {};
  }
}

function lookupClient(phoneNumber) {
  if (!phoneNumber) return null;
  const clients = loadClients();
  // Normalizza: rimuovi + e spazi, prova vari formati
  const normalized = phoneNumber.replace(/[\s\-]/g, '');
  const variants = [
    normalized,
    normalized.replace(/^\+/, ''),
    normalized.replace(/^39/, '+39'),
    '+39' + normalized.replace(/^\+?39/, ''),
    normalized.replace(/^0039/, '+39'),
  ];
  for (const v of variants) {
    if (clients[v]) return clients[v];
  }
  // Cerca anche chiavi che terminano con gli ultimi 8-10 cifre
  const digits = normalized.replace(/\D/g, '');
  for (const [key, client] of Object.entries(clients)) {
    const keyDigits = key.replace(/\D/g, '');
    if (keyDigits.length >= 8 && digits.endsWith(keyDigits.slice(-8))) {
      return client;
    }
  }
  return null;
}

// ============================================
// LOG BUFFER per diagnosticare inbound webhook
// ============================================
const inboundLog = [];
const MAX_LOG = 50;

function logInbound(entry) {
  inboundLog.push(entry);
  if (inboundLog.length > MAX_LOG) inboundLog.shift();
}

// Endpoint diagnostico per vedere gli ultimi inbound
app.get('/debug/inbound', (req, res) => {
  res.json({ count: inboundLog.length, entries: inboundLog });
});

// ============================================
// WEBHOOK INBOUND RETELL
// Riceve chiamate in entrata PRIMA che Giulia risponda
// ============================================
app.post('/webhook/inbound', (req, res) => {
  try {
    const { from_number, to_number, agent_id } = req.body;
    const ts = new Date().toISOString();
    console.log(`📞 [INBOUND] === RICHIESTA INBOUND RICEVUTA ===`);
    console.log(`📞 [INBOUND] from: ${from_number} → to: ${to_number} | agent: ${agent_id}`);
    console.log(`📞 [INBOUND] Body completo:`, JSON.stringify(req.body));
    
    const client = lookupClient(from_number);
    
    if (client) {
      console.log(`✅ [INBOUND] ✅ CLIENTE TROVATO: ${client.nome} (${client.ruolo}) — phone: ${from_number}`);
      
      const dynamicVars = {
        client_name: client.nome,
        client_role: client.ruolo || 'cliente',
        client_targhe: (client.targhe || []).join(', ') || 'non fornite',
        client_pratiche: (client.pratiche || []).join(', ') || 'nessuna',
        client_note: client.note || '',
      };
      
      // Costruisci begin_message personalizzato
      let beginMsg;
      if (client.ruolo === 'avvocato') {
        beginMsg = `Salve Avvocato ${client.nome}, sono Giulia, assistente dello Studio Ascolesi. Come posso aiutarla?`;
      } else if (client.ruolo === 'proprietario') {
        beginMsg = `Ciao Massimo, sono Giulia. Come posso aiutarti?`;
      } else {
        beginMsg = `Salve ${client.nome}, sono Giulia, assistente dello Studio Ascolesi. Come posso aiutarla?`;
      }
      
      const responsePayload = {
        call_inbound: {
          dynamic_variables: dynamicVars,
          agent_override: {
            retell_llm: {
              begin_message: beginMsg,
            }
          }
        }
      };
      logInbound({ ts, from: from_number, to: to_number, found: true, client: client.nome, response: responsePayload });
      res.status(200).json(responsePayload);
    } else {
      console.log(`ℹ️  [INBOUND] Cliente non trovato per ${from_number} — saluto standard`);
      
      const responsePayload = {
        call_inbound: {
          dynamic_variables: {
            client_name: '',
            client_role: '',
            client_targhe: '',
            client_pratiche: '',
            client_note: '',
          }
        }
      };
      logInbound({ ts, from: from_number, to: to_number, found: false, response: responsePayload });
      res.status(200).json(responsePayload);
    }
  } catch (error) {
    console.error('❌ [INBOUND] Errore:', error.message);
    logInbound({ ts: new Date().toISOString(), error: error.message });
    res.status(200).json({ call_inbound: {} }); // Fall back gracefully
  }
});

// API CRUD per gestire clients.json
function saveClients(clients) {
  fs.writeFileSync(CLIENTS_PATH, JSON.stringify(clients, null, 2), 'utf8');
}

// LIST tutti i clienti
app.get('/api/clients', (req, res) => {
  const clients = loadClients();
  const { _note, ...clean } = clients;
  res.json(clean);
});

// LOOKUP per telefono
app.get('/api/clients/lookup/:phone', (req, res) => {
  const client = lookupClient(req.params.phone);
  res.json(client || { found: false });
});

// CREATE nuovo cliente
app.post('/api/clients', (req, res) => {
  try {
    const { phone, nome, ruolo, targhe, pratiche, note } = req.body;
    if (!phone || !nome) {
      return res.status(400).json({ error: 'Telefono e nome sono obbligatori' });
    }
    const clients = loadClients();
    const normalized = phone.replace(/[\s\-]/g, '');
    if (clients[normalized]) {
      return res.status(409).json({ error: 'Cliente già esistente per questo numero' });
    }
    clients[normalized] = {
      nome,
      ruolo: ruolo || 'cliente',
      targhe: targhe || [],
      pratiche: pratiche || [],
      note: note || ''
    };
    saveClients(clients);
    console.log(`➕ [API] Nuovo cliente: ${nome} (${normalized})`);
    res.status(201).json({ success: true, phone: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE cliente esistente
app.put('/api/clients/:phone', (req, res) => {
  try {
    const originalPhone = decodeURIComponent(req.params.phone);
    const { phone, nome, ruolo, targhe, pratiche, note } = req.body;
    const clients = loadClients();
    const normalizedOriginal = originalPhone.replace(/[\s\-]/g, '');
    
    if (!clients[normalizedOriginal]) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    // Se il telefono è cambiato, rimuovi il vecchio e crea il nuovo
    if (phone && phone.replace(/[\s\-]/g, '') !== normalizedOriginal) {
      const newNormalized = phone.replace(/[\s\-]/g, '');
      if (clients[newNormalized]) {
        return res.status(409).json({ error: 'Il nuovo numero è già in uso' });
      }
      clients[newNormalized] = {
        nome: nome || clients[normalizedOriginal].nome,
        ruolo: ruolo || clients[normalizedOriginal].ruolo,
        targhe: targhe !== undefined ? targhe : clients[normalizedOriginal].targhe,
        pratiche: pratiche !== undefined ? pratiche : clients[normalizedOriginal].pratiche,
        note: note !== undefined ? note : clients[normalizedOriginal].note
      };
      delete clients[normalizedOriginal];
      console.log(`✏️ [API] Cliente aggiornato: ${nome} (${normalizedOriginal} → ${newNormalized})`);
    } else {
      clients[normalizedOriginal] = {
        nome: nome || clients[normalizedOriginal].nome,
        ruolo: ruolo || clients[normalizedOriginal].ruolo,
        targhe: targhe !== undefined ? targhe : clients[normalizedOriginal].targhe,
        pratiche: pratiche !== undefined ? pratiche : clients[normalizedOriginal].pratiche,
        note: note !== undefined ? note : clients[normalizedOriginal].note
      };
      console.log(`✏️ [API] Cliente aggiornato: ${nome} (${normalizedOriginal})`);
    }
    
    saveClients(clients);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cliente
app.delete('/api/clients/:phone', (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const clients = loadClients();
    const normalized = phone.replace(/[\s\-]/g, '');
    
    if (!clients[normalized]) {
      return res.status(404).json({ error: 'Cliente non trovato' });
    }
    
    const nome = clients[normalized].nome;
    delete clients[normalized];
    saveClients(clients);
    console.log(`🗑️ [API] Cliente eliminato: ${nome} (${normalized})`);
    res.json({ success: true });
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
      console.log(`⏱️  call_ended ricevuto alle: ${new Date().toISOString()}`);

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
              console.log(`📱 Timeout fallback: messaggio pronto (${message.length}c), invio...`);
              const recipient = process.env.WHATSAPP_RECIPIENT;
              await whatsappService.sendMessage(recipient, message);
              console.log('✅ Messaggio WhatsApp inviato (fallback timeout)');
            } catch (err) {
              console.error('❌ Errore invio fallback:', err.message);
              console.error('❌ Stack:', err.stack);
            }
          })();
        }
      }, CALL_ANALYSIS_TIMEOUT_MS);
      
      return;
    }

    if (event === 'call_analyzed') {
      console.log('📊 Chiamata analizzata (call_analyzed)');
      console.log(`⏱️  call_analyzed ricevuto alle: ${new Date().toISOString()}`);
      
      res.status(200).json({ received: true });
      
      const callId = callData.call_id;
      const callAnalysis = callData.call_analysis;
      
      if (callAnalysis?.call_summary) {
        console.log(`📝 Summary: ${callAnalysis.call_summary.substring(0, 100)}...`);
        console.log(`💬 Sentiment: ${callAnalysis.user_sentiment}`);
        console.log(`✅ Successful: ${callAnalysis.call_successful}`);
      }

      // === AUTO-SALVA CLIENTE ===
      // Se il chiamante non è in clients.json, prova a salvarlo automaticamente
      try {
        const callerPhone = callData.from_number;
        if (callerPhone && callerPhone !== 'N/A') {
          const clients = loadClients();
          const normalized = callerPhone.replace(/[\s\-]/g, '');
          
          if (!clients[normalized]) {
            console.log(`🆕 [AUTO] Numero nuovo rilevato: ${normalized} — tentativo auto-salvataggio...`);
            
            // Prova a estrarre info dalla call_analysis
            const customData = callAnalysis?.custom_analysis_data || {};
            const structured = callData.structured_data || {};
            const transcript = callData.transcript || '';
            
            // Estrai nome dal custom_analysis_data (se Giulia lo ha estratto)
            let nome = customData.cliente_nome || customData.nome_cliente || customData.client_name || '';
            
            // Se non trovato nel custom data, prova dal transcript SOLO se il cliente ha effettivamente parlato
            if (!nome) {
              // Prima verifica che il cliente abbia parlato (almeno 2 segmenti utente)
              const userSegments = (transcriptObject || []).filter(s => s.role !== 'agent');
              if (userSegments.length >= 2) {
                // Cerca pattern: "cliente si chiama X", "sono X", "mi chiamo X"
                const namePatterns = [
                  /(?: cliente si chiama| sono| mi chiamo| parlo con| speaking with| this is)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){0,2})/i,
                  /(?:nome|name)\s+(?:è|is|:)?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){0,2})/i
                ];
                for (const pat of namePatterns) {
                  const match = transcript.match(pat);
                  if (match) { nome = match[1].trim(); break; }
                }
              }
            }
            
            // Estrai ruolo
            let ruolo = 'cliente';
            const lowerTranscript = transcript.toLowerCase();
            if (lowerTranscript.includes('avvocat') || lowerTranscript.includes('studio legale') || lowerTranscript.includes('foro')) {
              ruolo = 'avvocato';
            }
            
            // Estrai targhe
            let targhe = [];
            if (structured.targa) {
              targhe = Array.isArray(structured.targa) ? structured.targa : [structured.targa];
            } else {
              // Pattern targa italiana nel transcript
              const targaPattern = /\b([A-Z]{2})\s*(\d{1,3})\s*([A-Z]{2})\b/gi;
              let tMatch;
              while ((tMatch = targaPattern.exec(transcript)) !== null) {
                targhe.push(`${tMatch[1].toUpperCase()}${tMatch[2]}${tMatch[3].toUpperCase()}`);
              }
            }
            
            // Estrai pratiche
            let pratiche = [];
            if (structured.pratica) {
              pratiche = Array.isArray(structured.pratica) ? structured.pratica : [structured.pratica];
            }
            
            // Salva SOLO se il chiamante ha parlato E abbiamo dati utili
            const userSegments = (transcriptObject || []).filter(s => s.role !== 'agent');
            const haParlato = userSegments.length >= 2; // almeno 2 interventi del cliente
            
            if (haParlato && (nome || targhe.length > 0 || pratiche.length > 0)) {
              clients[normalized] = {
                nome: nome || `Cliente ${normalized.slice(-4)}`,
                ruolo,
                targhe: targhe.length > 0 ? targhe : [],
                pratiche: pratiche.length > 0 ? pratiche : [],
                note: `Auto-creato da chiamata del ${new Date().toLocaleDateString('it-IT')}`
              };
              saveClients(clients);
              console.log(`✅ [AUTO] Cliente salvato: ${clients[normalized].nome} (${normalized}) — ruolo: ${ruolo}, targhe: ${targhe.join(', ')}, pratiche: ${pratiche.join(', ')}`);
            } else if (!haParlato) {
              console.log(`ℹ️  [AUTO] Chiamante non ha parlato (${normalized}) — nessun salvataggio`);
            } else {
              console.log(`ℹ️  [AUTO] Dati insufficienti per auto-salvataggio (${normalized}) — nessun nome/targa/pratica estratto`);
            }
          } else {
            console.log(`ℹ️  [AUTO] Cliente già conosciuto: ${clients[normalized].nome} (${normalized})`);
          }
        }
      } catch (autoErr) {
        console.error('⚠️  [AUTO] Errore auto-salvataggio cliente:', autoErr.message);
      }
      // === FINE AUTO-SALVA CLIENTE ===
      
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
            console.log(`📱 Messaggio pronto (${message.length}c), invio a ${process.env.WHATSAPP_RECIPIENT}... alle ${new Date().toISOString()}`);
            const recipient = process.env.WHATSAPP_RECIPIENT;
            await whatsappService.sendMessage(recipient, message);
            console.log(`✅ Messaggio WhatsApp inviato con call_analysis! alle ${new Date().toISOString()}`);
          } catch (err) {
            console.error('❌ Errore invio WhatsApp:', err.message);
            console.error('❌ Stack:', err.stack);
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
