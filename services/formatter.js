const moment = require('moment');

class MessageFormatter {
  formatCallReport(callData) {
    const lines = [];
    const text = (callData.transcript || '').toLowerCase();
    
    // Urgenza (的情绪 indicator)
    const urgenza = this._getUrgenza(text, callData);
    lines.push(`${urgenza.icon} *${urgenza.label}*`);
    lines.push('');
    
    // Saluto sempre a Massimo
    lines.push('Ciao Massimo! 👋');
    
    // Caller name from highlights
    const nameH = (callData.highlights || []).find(h => h.startsWith('Nome:'));
    const callerName = nameH ? nameH.replace('Nome: ', '').trim() : null;
    
    if (callerName) {
      lines.push(`Ho appena ricevuto una chiamata da *${callerName}*.`);
    } else {
      lines.push('Ho appena ricevuto una chiamata.');
    }
    lines.push('');
    
    // Info base
    const durata = this._formatDuration(callData.duration);
    const data = moment(callData.startTime).format('DD/MM/YYYY HH:mm');
    lines.push(`📆 ${data} • ⏱️ ${durata}`);
    if (callData.fromNumber && callData.fromNumber !== 'N/A') {
      lines.push(`📞 ${callData.fromNumber}`);
    }
    lines.push('');
    
    // Retell AI summary (translate English → Italian)
    if (callData.callSummary) {
      const summaryIt = this._translateSummaryToItalian(callData.callSummary, callData);
      lines.push('📋 *Riepilogo chiamata:*');
      lines.push(summaryIt);
      lines.push('');
    }
    
    // Sentiment + Esito
    const sentiment = this._getSentimentLabel(callData.sentiment, callData.callSuccessful);
    lines.push(sentiment);
    lines.push('');
    
    // Cosa chiede il cliente
    const richiesta = this._getRichiesta(text, callData);
    if (richiesta) {
      lines.push(`📌 *${richiesta}*`);
      lines.push('');
    }
    
    // Dettagli rilevanti
    const dettagli = this._getDettagli(text, callData);
    if (dettagli.length > 0) {
      dettagli.forEach(d => lines.push(`• ${d}`));
      lines.push('');
    }
    
    // Da fare subito
    const daFare = this._getDaFare(text, callData);
    if (daFare) {
      lines.push(`➡️ *Azioni consigliate*`);
      lines.push(daFare);
    }
    
    lines.push('');
    lines.push('Tua Giulia 💬');
    
    return lines.join('\n');
  }

  /**
   * Traduce il summary inglese di Retell AI in un riepilogo italiano conciso
   */
  _translateSummaryToItalian(englishSummary, callData) {
    const text = (callData.transcript || '').toLowerCase();
    const sd = callData.structuredData || {};
    const highlights = callData.highlights || [];
    const sentiment = callData.sentiment;
    
    // Costruisci riepilogo italiano dai dati estratti
    const parts = [];
    
    // Chi ha chiamato
    const nameH = highlights.find(h => h.startsWith('Nome:'));
    if (nameH) {
      parts.push(`Il chiamante è ${nameH.replace('Nome: ', '').trim()}.`);
    }
    
    // Tipo richiesta
    const richiesta = this._getRichiesta(text, callData);
    if (richiesta) {
      const cleanRichiesta = richiesta.replace(/^[\s\S]*?\s/, '');
      parts.push(`Richiesta: ${cleanRichiesta}.`);
    }
    
    // Dettagli chiave
    if (sd.targa) parts.push(`Targa: ${sd.targa}.`);
    if (sd.numeroPratica) parts.push(`Pratica n. ${sd.numeroPratica}.`);
    if (sd.numeroSinistro) parts.push(`Sinistro n. ${sd.numeroSinistro}.`);
    if (sd.compagniaAssicurativa) parts.push(`Compagnia: ${sd.compagniaAssicurativa}.`);
    if (sd.avvocatoDiRiferimento) parts.push(`Avvocato: ${sd.avvocatoDiRiferimento}.`);
    if (sd.tipoVeicolo) parts.push(`Veicolo: ${sd.tipoVeicolo}.`);
    
    // Sentiment tradotto
    if (sentiment === 'Positive') parts.push('Il cliente si è mostrato collaborativo.');
    else if (sentiment === 'Negative') parts.push('Il cliente sembra insoddisfatto.');
    
    if (parts.length > 0) {
      return parts.join(' ');
    }
    
    // Fallback: primo frammento utile dal transcript
    const userText = this._getUserText(callData.transcriptObject);
    if (userText && userText.length > 20) {
      return userText.substring(0, 200).trim() + (userText.length > 200 ? '...' : '');
    }
    
    return 'Chiamata ricevuta.';
  }

  /**
   * Identifica cosa sta chiedendo il cliente
   */
  _getRichiesta(text, callData) {
    // Sinistro / Perizia
    if (text.includes('sinistro') || text.includes('danno') || text.includes('incidente')) {
      if (text.includes('perizia') || text.includes('perito')) {
        if (text.includes('stato') || text.includes('punto') || text.includes('aggiornamento')) {
          return '📊 Chiede aggiornamenti sulla perizia del sinistro';
        }
        return '📊 Richiesta sinistro / perizia';
      }
      return '🚨 Segnalazione sinistro/danno';
    }
    
    // Perizia
    if (text.includes('perizia') || text.includes('perito')) {
      return '📊 Chiede info sulla perizia';
    }
    
    // Causa / Tribunale / Giudice
    if (text.includes('causa') || text.includes('tribunale') || text.includes('udienza') || text.includes('giudice') || text.includes('sentenza')) {
      return '⚖️ Chiede aggiornamenti sulla causa legale';
    }
    
    // Avvocato
    if (text.includes('avvocato') || text.includes('legale')) {
      if (text.includes('aggiornamento') || text.includes('stato') || text.includes('fatto')) {
        return '⚖️ Chiede news dall\'avvocato';
      }
      return '⚖️ Richiesta legale';
    }
    
    // Documenti
    if (text.includes('document') || text.includes('integrazione') || text.includes('manca')) {
      return '📄 Richiesta documentazione';
    }
    
    // Testimoni
    if (text.includes('testimone') || text.includes('testimonial') || text.includes('dichiarazion')) {
      return '👤 Richiesta dichiarazioni testimoni';
    }
    
    // Risarcimento / Pagamento / Liquidazione
    if (text.includes('risarciment') || text.includes('pagamento') || text.includes('liquidazion') || text.includes('pagare')) {
      return '💰 Chiede info su risarcimento/pagamento';
    }
    
    // Appuntamento
    if (text.includes('appuntamento') || text.includes('incontro') || text.includes('veder')) {
      return '📅 Richiesta appuntamento';
    }
    
    // Preventivo
    if (text.includes('preventivo') || text.includes('quotazione') || text.includes('costo')) {
      return '💰 Richiesta preventivo/costo';
    }
    
    // Polizza
    if (text.includes('polizza') || text.includes('assicurazion')) {
      if (text.includes('rinnovo')) return '🔄 Rinnovo polizza';
      return '📋 Richiesta polizza';
    }
    
    // Richiesta generica
    return '📞 Chiamata in arrivo';
  }

  /**
   * Determina urgenza della chiamata
   */
  _getUrgenza(text, callData) {
    // Urgenza alta
    if (text.includes('urgenz') || text.includes('subito') || text.includes('emergenz') || text.includes('pericolo')) {
      return { icon: '🔴', label: 'CHIAMATA URGENTE' };
    }
    
    // Sinistro = sempre alta priorità
    if (text.includes('sinistro') && (text.includes('appena') || text.includes('oggi') || text.includes('ieri'))) {
      return { icon: '🔴', label: 'SINISTRO RECENTE' };
    }
    
    // Frustrazione / rabbia
    if (text.includes('arrabbi') || text.includes('furios') || text.includes('insoddisf') || text.includes('problema grande')) {
      return { icon: '🟠', label: 'CLIENTE FRUSTRATO' };
    }
    
    // Normale
    return { icon: '🟢', label: 'Chiamata ricevuta' };
  }

  /**
   * Formatta sentiment ed esito
   */
  _getSentimentLabel(sentiment, callSuccessful) {
    const parts = [];
    
    // Sentiment
    if (sentiment === 'Positive') parts.push('😊 Sentiment: Positivo');
    else if (sentiment === 'Negative') parts.push('😠 Sentiment: Negativo');
    else if (sentiment === 'Neutral') parts.push('😐 Sentiment: Neutro');
    
    // Esito
    if (callSuccessful === true) parts.push('✅ Chiamata completata');
    else if (callSuccessful === false) parts.push('⚠️ Chiamata non completata');
    
    if (parts.length === 0) return '';
    
    return '💬 ' + parts.join(' • ');
  }

  /**
   * Dettagli specifici rilevanti
   */
  _getDettagli(text, callData) {
    const dettagli = [];
    const sd = callData.structuredData || {};
    
    // Veicolo
    if (sd.tipoVeicolo) dettagli.push(`🚗 Veicolo: ${sd.tipoVeicolo}`);
    
    // Targa
    if (sd.targa) dettagli.push(`🔢 Targa: ${sd.targa}`);
    
    // Numero pratica
    if (sd.numeroPratica) dettagli.push(`📂 Pratica: ${sd.numeroPratica}`);
    
    // Numero sinistro
    if (sd.numeroSinistro) dettagli.push(`🚨 Sinistro: ${sd.numeroSinistro}`);
    
    // Compagnia assicurativa
    if (sd.compagniaAssicurativa) dettagli.push(`🏢 Compagnia: ${sd.compagniaAssicurativa}`);
    
    // Avvocato di riferimento
    if (sd.avvocatoDiRiferimento) dettagli.push(`⚖️ Avvocato: ${sd.avvocatoDiRiferimento}`);
    
    // Studio legale
    if (sd.studioLegale) dettagli.push(`🏛️ Studio: ${sd.studioLegale}`);
    
    // Urgenza
    if (sd.urgenza && sd.urgenza !== 'Normale') {
      dettagli.push(`🔴 Urgenza: ${sd.urgenza}`);
    }
    
    // Email
    const emailH = (callData.highlights || []).find(h => h.startsWith('Email:'));
    if (emailH) dettagli.push(`📧 ${emailH.replace('Email: ', '')}`);
    
    // Polizza
    const polizzaH = (callData.highlights || []).find(h => h.includes('Polizza') && !h.includes('Discussione'));
    if (polizzaH) dettagli.push(`📋 ${polizzaH.replace('Polizza: ', '').trim()}`);
    
    // Date
    if (sd.dateMenzionate && sd.dateMenzionate.length > 0) {
      dettagli.push(`📅 ${sd.dateMenzionate.join(', ')}`);
    }
    
    // Importi
    if (sd.importi && sd.importi.length > 0) {
      dettagli.push(`💰 ${sd.importi.join(', ')}`);
    }
    
    return dettagli;
  }

  /**
   * Cosa fare subito — con callData per contesto migliore
   */
  _getDaFare(text, callData) {
    const azioni = [];
    const sd = callData?.structuredData || {};
    const sentiment = callData?.sentiment;
    
    // Priorità alta
    if (text.includes('sinistro') && (text.includes('urgenz') || text.includes('subito'))) {
      azioni.push('🔴 SINISTRO URGENTE — gestire subito');
    }
    
    if (text.includes('perizia') && (text.includes('mancante') || text.includes('non fatta'))) {
      azioni.push('⚠️ Verificare stato perizia');
    }
    
    if (text.includes('document') && (text.includes('mancante') || text.includes('manca'))) {
      azioni.push('⚠️ Inviare documentazione mancante');
    }
    
    if (text.includes('testimone') && (text.includes('mancante') || text.includes('non avvisato'))) {
      azioni.push('⚠️ Contattare testimone');
    }
    
    // Cliente frustrato → richiamare subito
    if (sentiment === 'Negative') {
      azioni.push('📞 Richiamare al più presto — cliente insoddisfatto');
    }
    
    // Richiamare
    if (text.includes('richiam') || text.includes('callback')) {
      azioni.push('📞 Richiamare il cliente');
    }
    
    // Email
    if (text.includes('email') || text.includes('mail')) {
      azioni.push('📧 Inviare email');
    }
    
    // Appuntamento
    if (text.includes('appuntamento')) {
      azioni.push('📅 Fissare appuntamento');
    }
    
    // Preventivo
    if (text.includes('preventivo')) {
      azioni.push('💰 Preparare preventivo');
    }
    
    // Pratica specifica → contesto
    if (sd.numeroPratica) {
      azioni.push(`📂 Verificare pratica n. ${sd.numeroPratica}`);
    }
    
    // Avvocato → aggiornamento
    if (sd.avvocatoDiRiferimento) {
      azioni.push(`⚖️ Contattare ${sd.avvocatoDiRiferimento} per aggiornamento`);
    }
    
    // Compagnia → verifica
    if (sd.compagniaAssicurativa) {
      azioni.push(`🏢 Verificare con ${sd.compagniaAssicurativa}`);
    }
    
    return azioni.length > 0 ? azioni.join('\n') : null;
  }

  _formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
}

module.exports = { MessageFormatter };
