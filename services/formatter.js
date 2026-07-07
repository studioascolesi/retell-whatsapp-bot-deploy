const moment = require('moment');

class MessageFormatter {
  formatCallReport(callData) {
    const lines = [];
    const text = (callData.transcript || '').toLowerCase();
    
    // Chi chiama
    const nameH = (callData.highlights || []).find(h => h.startsWith('👤 Nome:'));
    const callerName = nameH ? nameH.replace('👤 Nome: ', '').trim() : null;
    
    // Saluto sempre a Massimo
    lines.push('Ciao Massimo! 👋');
    
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
    const daFare = this._getDaFare(text);
    if (daFare) {
      lines.push(`➡️ *Azioni*`);
      lines.push(daFare);
    }
    
    lines.push('');
    lines.push('Tua Giulia 💬');
    
    return lines.join('\n');
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
   * Dettagli specifici rilevanti
   */
  _getDettagli(text, callData) {
    const dettagli = [];
    const sd = callData.structuredData || {};
    
    // Veicolo
    if (sd.tipoVeicolo) dettagli.push(`🚗 Veicolo: ${sd.tipoVeicolo}`);
    
    // Targa
    const targaH = (callData.highlights || []).find(h => h.startsWith('🚗 Targa:'));
    if (targaH) dettagli.push(`🔢 Targa: ${targaH.replace('🚗 Targa: ', '')}`);
    
    // Polizza
    const polizzaH = (callData.highlights || []).find(h => h.includes('Polizza') && !h.includes('Discussione'));
    if (polizzaH) dettagli.push(`📋 ${polizzaH.replace('📋 ', '')}`);
    
    // Perizia
    if (text.includes('perizia') || text.includes('perito')) dettagli.push('🔍 Menziona perizia/perito');
    
    // Documenti mancanti
    if (text.includes('manca') || text.includes('mancante') || text.includes('integrazione')) {
      dettagli.push('📄 Documentazione incompleta');
    }
    
    // Testimoni
    if (text.includes('testimone') || text.includes('testimonial')) dettagli.push('👤 Menziona testimoni');
    
    // Causa
    if (text.includes('causa') || text.includes('tribunale')) dettagli.push('⚖️ Menziona causa legale');
    
    // Date
    if (sd.dateMenzionate && sd.dateMenzionate.length > 0) {
      dettagli.push(`📅 Date: ${sd.dateMenzionate.join(', ')}`);
    }
    
    // Importi
    if (sd.importi && sd.importi.length > 0) {
      dettagli.push(`💰 ${sd.importi.join(', ')}`);
    }
    
    // Email
    const emailH = (callData.highlights || []).find(h => h.startsWith('📧 Email:'));
    if (emailH) dettagli.push(`📧 ${emailH.replace('📧 Email: ', '')}`);
    
    return dettagli;
  }

  /**
   * Cosa fare subito
   */
  _getDaFare(text) {
    const azioni = [];
    
    // Priorità alta
    if (text.includes('sinistro') && (text.includes('urgenz') || text.includes('subito'))) {
      azioni.push('🔴 SINISTRO URGENTE - gestire subito');
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
    
    // Azioni standard
    if (text.includes('richiam') || text.includes('callback')) azioni.push('📞 Richiamare il cliente');
    if (text.includes('email') || text.includes('mail')) azioni.push('📧 Inviare email');
    if (text.includes('appuntamento')) azioni.push('📅 Fissare appuntamento');
    if (text.includes('preventivo')) azioni.push('💰 Preparare preventivo');
    
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
