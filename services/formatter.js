const moment = require('moment');

class MessageFormatter {
  formatCallReport(callData) {
    const lines = [];
    
    lines.push('📞 *RESOCONTO CHIAMATA*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');
    
    lines.push('📋 *INFO*');
    lines.push(`📆 ${moment(callData.startTime).format('DD/MM/YYYY HH:mm')}`);
    lines.push(`⏱️ Durata: ${this._formatDuration(callData.duration)}`);
    lines.push(`📞 Da: ${callData.fromNumber}`);
    lines.push(`📱 A: ${callData.toNumber}`);
    lines.push('');
    
    if (callData.highlights && callData.highlights.length > 0) {
      lines.push('⭐ *PUNTI CHIAVE*');
      callData.highlights.forEach(h => {
        lines.push(`• ${h}`);
      });
      lines.push('');
    }
    
    if (callData.structuredData && Object.keys(callData.structuredData).length > 0) {
      lines.push('📊 *DATI RILEVATI*');
      
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
    
    const actions = this._generateActionItems(callData);
    if (actions) {
      lines.push('✅ *AZIONI*');
      lines.push(actions);
      lines.push('');
    }
    
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🤖 Retell AI | ${moment().format('HH:mm')}`);
    
    return lines.join('\n');
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
      actions.push('📞 Programma richiamo');
    }
    if (text.includes('email') || text.includes('mail')) {
      actions.push('📧 Invia email');
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
    
    return actions.length > 0 ? actions.join('\n') : null;
  }
}

module.exports = { MessageFormatter };
