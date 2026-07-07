# 🤖 Retell AI → WhatsApp Bot

Bot che invia resoconti automatici delle chiamate AI su WhatsApp.

## 📋 Come Funziona

```
📞 Chiamata Telefonica
        ↓
    🤖 Retell AI (gestisce la conversazione)
        ↓
    📥 Webhook → Il server riceve i dati
        ↓
    📊 Elaborazione (trascrizione, punti salienti)
        ↓
    📱 WhatsApp → Invio resoconto al cliente
```

**Nessun agente WhatsApp** - serve SOLO per inviare messaggi!

## ⚡ Setup in 5 Minuti

### 1. Installa
```bash
cd ~/Desktop/retell-whatsapp-bot
npm install
```

### 2. Configura il Bot (.env)
Rinomina `.env.example` in `.env` e inserisci le tue chiavi di Retell AI e il numero di telefono del destinatario.

### 3. Avvia
```bash
npm start
```

### 4. Collega WhatsApp (Gratis)
Vai su `http://localhost:3000/setup` e scansiona il QR code con il tuo telefono (Impostazioni > Dispositivi collegati).

### 5. Espone con ngrok (per test locali)
```bash
ngrok http 3000
```

### 6. Configura Retell AI
Nel dashboard Retell AI:
1. Vai su **Agents** → il tuo agent
2. Vai su **Webhook**
3. Inserisci: `https://tuo-url.ngrok.io/webhook/retell`
4. Seleziona evento: `call_ended`

## 📱 Cosa Ricevi su WhatsApp

Ogni chiamata genera un messaggio tipo:

```
📞 *RESOCONTO CHIAMATA AI*
━━━━━━━━━━━━━━━━━━━━━━

📆 Data: 06/01/2026 14:30
⏱️ Durata: 5m 32s
📞 Da: +39 123 456 7890

🎭 *SENTIMENT* 😊 POSITIVO

⭐ *PUNTI SALIENTI*
• Discussione polizza auto
• Preventivo richiesto

📝 *TRASCRIZIONE*
[Testo completo chiamata]

✅ *AZIONI* 💰 Invia preventivo
```

## 🛠️ Comandi Utili

```bash
# Avvia il bot
npm start

# Testa invio WhatsApp
curl -X POST http://localhost:3000/test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"message": "Test"}'

# Verifica stato
curl http://localhost:3000/health
```

## ❓ Problemi?

1. **Non arriva il webhook?** → Controlla che ngrok sia attivo
2. **Errore WhatsApp?** → Verifica il token nel file `.env`
3. **Non ricevi messaggi?** → Controlla il numero destinatario

## 📞 Supporto

Il progetto è nella cartella: `~/Desktop/retell-whatsapp-bot/`
