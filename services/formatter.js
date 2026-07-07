const moment = require('moment');

class MessageFormatter {
  formatCallReport(callData) {
    const lines = [];
    
    // Estrai nome cliente dai highlights
    const nameHighlight = (callData.highlights || []).find(h => h.startsWith('👤 Nome:'));
    const clientName = nameHighlight ? nameHighlight.replace('👤 Nome: ', '').trim() : null;
    
    // Saluto personalizzato
    if (clientName) {
      lines.push(`Ciao ${clientName}! 👋`);
      lines.push('Abbiamo appena ricevuto una chiamata, ecco il riepilogo:');
    } else {
      lines.push('Ciao! 👋');
      lines.push('Abbiamo appena ricevuto una chiamata, ecco il riepilogo:');
    }
    lines.push('');
    
    // Info chiamata
    lines.push('📋 *Chiamata ricevuta*');
    if (callData.fromNumber && callData.fromNumber !== 'N/A') {
      lines.push(`📞 Da: ${callData.fromNumber}`);
    }
    if (callData.toNumber && callData.toNumber !== 'N/A') {
      lines.push(`📱 A: ${callData.toNumber}`);
    }
    lines.push(`📆 Data: ${moment(callData.startTime).format('DD/MM/YYYY HH:mm')}`);
    lines.push(`⏱️ Durata: ${this._formatDuration(callData.duration)}`);
    lines.push('');
    
    // Trascrizione conversazione
    const transcript = this._cleanTranscript(callData.transcript, callData.transcriptObject);
    if (transcript) {
      lines.push('💬 *Conversazione*');
      lines.push(transcript);
      lines.push('');
    }
    
    // Highlights estratti
    if (callData.highlights && callData.highlights.length > 0 && callData.highlights[0] !== 'nessun punto saliente specifico rilevato') {
      lines.push('⭐ *Punti chiave*');
      callData.highlights.forEach(h => {
        lines.push(`• ${h}`);
      });
      lines.push('');
    }
    
    // Dati strutturati
    if (callData.structuredData && Object.keys(callData.structuredData).length > 0) {
      lines.push('📊 *Dati importanti*');
      
      if (callData.structuredData.numeroChiamante) {
        lines.push(`📞 Numero: ${callData.structuredData.numeroChiamante}`);
      }
      if (callData.structuredData.tipoVeicolo) {
        lines.push(`🚗 Veicolo: ${callData.structuredData.tipoVeicolo}`);
      }
      if (callData.structuredData.tipoRichiesta) {
        lines.push(`📝 Richiesta: ${callData.structuredData.tipoRichiesta}`);
      }
      if (callData.structuredData.dateMenzionate) {
        lines.push(`📅 Date: ${callData.structuredData.dateMenzionate.join(', ')}`);
      }
      if (callData.structuredData.importi) {
        lines.push(`💰 Importi: ${callData.structuredData.importi.join(', ')}`);
      }
      if (callData.structuredData.altriTelefoni) {
        lines.push(`☎️ Altri telefoni: ${callData.structuredData.altriTelefoni.join(', ')}`);
      }
      lines.push('');
    }
    
    // Azioni suggerite
    const actions = this._generateActionItems(callData);
    if (actions) {
      lines.push('✅ *Suggerimento*');
      lines.push(actions);
      lines.push('');
    }
    
    lines.push('Tua Giulia 💬');
    
    return lines.join('\n');
  }

  /**
   * Pulisce e formatta la trascrizione per il messaggio WhatsApp
   */
  _cleanTranscript(transcript, transcriptObject) {
    let text = '';
    
    if (typeof transcript === 'string' && transcript.length > 0) {
      text = transcript;
    } else if (Array.isArray(transcriptObject) && transcriptObject.length > 0) {
      text = transcriptObject
        .map(seg => {
          const label = seg.role === 'agent' ? '🤖 Giulia' : '👤 Cliente';
          return `${label}: ${seg.content}`;
        })
        .join('\n');
    }
    
    if (!text) return null;
    
    // Pulisci il testo: rimuovi timestamp, codici, e formatta
    text = text
      .replace(/\[\d{2}:\d{2}:\d{2}[.\d]*\s*→\s*\d{2}:\d{2}:\d{2}[.\d]*\]/g, '') // rimuovi timestamp
      .replace(/^\s*[\d.]+\s+/gm, '') // rimuovi numeri all'inizio delle righe
      .replace(/\n{3,}/g, '\n\n') // riduci righe vuote
      .trim();
    
    // Tronca se troppo lungo (WhatsApp ha limiti)
    if (text.length > 1500) {
      text = text.substring(0, 1497) + '...';
    }
    
    return text;
  }

  _formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  _generateActionItems(callData) {
    const actions = [];
    const text = callData.transcript?.toLowerCase() || '';
    
    if (text.includes('richiam') || text.includes('callback')) {
      actions.push('📞 Richiamare per confermare i dettagli');
    }
    if (text.includes('email') || text.includes('mail')) {
      actions.push('📧 Inviare email con documenti');
    }
    if (text.includes('appuntamento') || text.includes('incontro')) {
      actions.push('📅 Appuntamento da confermare');
    }
    if (text.includes('preventivo') || text.includes('quotazione')) {
      actions.push('💰 Preparare preventivo');
    }
    if (text.includes('polizza') && (text.includes('rinnov') || text.includes('nuov'))) {
      actions.push('📋 Elaborare polizza');
    }
    if (text.includes('sinistro') || text.includes('danno')) {
      actions.push('🚨 Segnalazione sinistro presa in carico');
    }
    
    return actions.length > 0 ? actions.join('\n') : null;
  }
}

module.exports = { MessageFormatter };
