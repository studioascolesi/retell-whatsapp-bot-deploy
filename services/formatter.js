const moment = require('moment');

class MessageFormatter {
  constructor() {
    this.includeTranscription = process.env.INCLUDE_TRANSCRIPTION === 'true';
    this.includeSentiment = process.env.INCLUDE_SENTIMENT === 'true';
    this.includeActionItems = process.env.INCLUDE_ACTION_ITEMS === 'true';
  }

  /**
   * Formatta il report della chiamata per WhatsApp
   */
  formatCallReport(callData) {
    const lines = [];
    
    // Header
    lines.push('📞 *RESOCONTO CHIAMATA AI*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    
    // Informazioni generali
    lines.push('📋 *INFORMAZIONI CHIAMATA*');
    lines.push(`📆 Data: ${moment(callData.startTime).format('DD/MM/YYYY HH:mm')}`);
    lines.push(`⏱️ Durata: ${this._formatDuration(callData.duration)}`);
    lines.push(`📞 Da: ${callData.fromNumber}`);
    lines.push(`📱 A: ${callData.toNumber}`);
    lines.push(`✅ Stato: ${this._formatStatus(callData.status)}`);
    lines.push('');
    
    // Sentiment
    if (this.includeSentiment) {
      lines.push('🎭 *SENTIMENT*');
      lines.push(`${this._getSentimentEmoji(callData.sentiment)} ${callData.sentiment.toUpperCase()}`);
      lines.push('');
    }
    
    // Punti salienti
    if (callData.highlights && callData.highlights.length > 0) {
      lines.push('⭐ *PUNTI SALIENTI*');
      callData.highlights.forEach(h => {
        lines.push(`• ${h}`);
      });
      lines.push('');
    }
    
    // Dati strutturati
    if (Object.keys(callData.structuredData).length > 0) {
      lines.push('📊 *DATI ESTRATTI*');
      
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
      if (callData.structuredData.telefoni) {
        lines.push(`☎️ Telefoni: ${callData.structuredData.telefoni.join(', ')}`);
      }
      lines.push('');
    }
    
    // Trascrizione
    if (this.includeTranscription && callData.transcript) {
      lines.push('📝 *TRASCRIZIONE COMPLETA*');
      lines.push('━━━━━━━━━━━━━━━━━━━━━━');
      
      // Dividi la trascrizione in blocchi per evitare messaggi troppo lunghi
      const transcriptChunks = this._chunkTranscription(callData.transcript);
      transcriptChunks.forEach(chunk => {
        lines.push(chunk);
        lines.push('');
      });
    }
    
    // Azioni consigliate
    if (this.includeActionItems) {
      lines.push('✅ *AZIONI CONSIGLIATE*');
      lines.push(this._generateActionItems(callData));
      lines.push('');
    }
    
    // Footer
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('🤖 Generato da Retell AI Bot');
    lines.push(`🕐 ${moment().format('DD/MM/YYYY HH:mm:ss')}`);
    
    return lines.join('\n');
  }

  /**
   * Formatta la durata in formato leggibile
   */
  _formatDuration(seconds) {
    if (seconds < 60) return `${seconds} secondi`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}m ${secs}s`;
  }

  /**
   * Formatta lo stato della chiamata
   */
  _formatStatus(status) {
    const statusMap = {
      'completed': '✅ Completata',
      'in-progress': '🔄 In corso',
      'failed': '❌ Fallita',
      'no-answer': '📵 Nessuna risposta',
      'busy': '📞 Occupato',
      'cancelled': '🚫 Annullata'
    };
    return statusMap[status] || status;
  }

  /**
   * Ottieni l'emoji per il sentiment
   */
  _getSentimentEmoji(sentiment) {
    const emojiMap = {
      'positivo': '😊',
      'negativo': '😟',
      'neutro': '😐'
    };
    return emojiMap[sentiment] || '❓';
  }

  /**
   * Dividi la trascrizione in blocchi per WhatsApp
   */
  _chunkTranscription(transcript, maxChunkSize = 4000) {
    if (!transcript) return [];
    
    const chunks = [];
    const words = transcript.split(' ');
    let currentChunk = '';
    
    words.forEach(word => {
      if ((currentChunk + ' ' + word).length > maxChunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += ' ' + word;
      }
    });
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Genera azioni consigliate basate sui dati
   */
  _generateActionItems(callData) {
    const actions = [];
    const text = callData.transcript?.toLowerCase() || '';
    
    if (text.includes('richiam') || text.includes('callback')) {
      actions.push('📞 Programma richiamo');
    }
    if (text.includes('email') || text.includes('mail')) {
      actions.push('📧 Invia email con documenti');
    }
    if (text.includes('appuntamento') || text.includes('incontro')) {
      actions.push('📅 Conferma appuntamento');
    }
    if (text.includes('preventivo') || text.includes('quotazione')) {
      actions.push('💰 Invia preventivo');
    }
    if (text.includes('polizza') && (text.includes('rinnov') || text.includes('nuov'))) {
      actions.push('📋 Elabora polizza');
    }
    if (text.includes('sinistro') || text.includes('danno')) {
      actions.push('🚨 Apri pratica sinistro');
    }
    
    if (actions.length === 0) {
      actions.push('👁️ Nessuna azione specifica richiesta');
    }
    
    return actions.join('\n');
  }

  /**
   * Formatta un messaggio di testo semplice
   */
  formatSimpleMessage(text, recipient) {
    return `📱 Messaggio per ${recipient}:\n\n${text}`;
  }
}

module.exports = { MessageFormatter };
