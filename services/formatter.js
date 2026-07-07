const moment = require('moment');

class MessageFormatter {
  formatCallReport(callData) {
    const lines = [];
    
    lines.push('Ciao! 👋 Sono Giulia, l\'assistente dello studio.');
    lines.push('Ho appena registrato la chiamata, ecco il riepilogo:');
    lines.push('');
    
    lines.push('📋 *Chiamata ricevuta*');
    lines.push(`📞 Da: ${callData.fromNumber}`);
    lines.push(`📱 A: ${callData.toNumber}`);
    lines.push(`📆 Data: ${moment(callData.startTime).format('DD/MM/YYYY HH:mm')}`);
    lines.push(`⏱️ Durata: ${this._formatDuration(callData.duration)}`);
    lines.push('');
    
    if (callData.highlights && callData.highlights.length > 0) {
      lines.push('⭐ *Cosa ho raccolto dalla chiamata*');
      callData.highlights.forEach(h => {
        lines.push(`• ${h}`);
      });
      lines.push('');
    }
    
    if (callData.structuredData && Object.keys(callData.structuredData).length > 0) {
      lines.push('📊 *Dati importanti*');
      
      if (callData.structuredData.numeroChiamante) {
        lines.push(`📞 Numero chiamante: ${callData.structuredData.numeroChiamante}`);
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
    
    const actions = this._generateActionItems(callData);
    if (actions) {
      lines.push('✅ *Cosa fare dopo*');
      lines.push(actions);
      lines.push('');
    }
    
    lines.push('Se hai bisogno di altro, sono qui! 💬');
    lines.push(`_Giulia | ${moment().format('HH:mm')}_`);
    
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
      actions.push('📞 Devo richiamare per confermare i dettagli');
    }
    if (text.includes('email') || text.includes('mail')) {
      actions.push('📧 Devo inviare un\'email con i documenti');
    }
    if (text.includes('appuntamento') || text.includes('incontro')) {
      actions.push('📅 Ho fissato un appuntamento');
    }
    if (text.includes('preventivo') || text.includes('quotazione')) {
      actions.push('💰 Devo preparare il preventivo');
    }
    if (text.includes('polizza') && (text.includes('rinnov') || text.includes('nuov'))) {
      actions.push('📋 Devo elaborare la polizza');
    }
    if (text.includes('sinistro') || text.includes('danno')) {
      actions.push('🚨 Ho preso in carico la segnalazione');
    }
    
    return actions.length > 0 ? actions.join('\n') : null;
  }
}

module.exports = { MessageFormatter };
