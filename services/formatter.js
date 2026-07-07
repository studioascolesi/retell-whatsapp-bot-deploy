const moment = require('moment');

class MessageFormatter {
  formatCallReport(callData) {
    const lines = [];
    
    // Estrai nome cliente
    const nameHighlight = (callData.highlights || []).find(h => h.startsWith('👤 Nome:'));
    const clientName = nameHighlight ? nameHighlight.replace('👤 Nome: ', '').trim() : null;
    
    // Saluto
    if (clientName) {
      lines.push(`Ciao ${clientName}! 👋`);
    } else {
      lines.push('Ciao! 👋');
    }
    lines.push('Abbiamo appena ricevuto una chiamata.');
    lines.push('');
    
    // Info base
    lines.push(`📆 ${moment(callData.startTime).format('DD/MM/YYYY HH:mm')} • ⏱️ ${this._formatDuration(callData.duration)}`);
    if (callData.fromNumber && callData.fromNumber !== 'N/A') {
      lines.push(`📞 ${callData.fromNumber}`);
    }
    lines.push('');
    
    // Solo i punti chiave (nessun nome Giulia, solo info utili)
    const keyPoints = this._getKeyPoints(callData);
    if (keyPoints.length > 0) {
      lines.push('⭐ *Punti chiave*');
      keyPoints.forEach(p => lines.push(`• ${p}`));
      lines.push('');
    }
    
    // Azione consigliata
    const action = this._getAction(callData);
    if (action) {
      lines.push(action);
    }
    
    lines.push('Tua Giulia 💬');
    
    return lines.join('\n');
  }

  /**
   * Estrae solo le informazioni importanti dalla chiamata
   */
  _getKeyPoints(callData) {
    const points = [];
    const text = (callData.transcript || '').toLowerCase();
    const sd = callData.structuredData || {};
    
    // Nome
    const nameH = (callData.highlights || []).find(h => h.startsWith('👤 Nome:'));
    if (nameH) points.push(nameH.replace('👤 Nome: ', '👤 Cliente: '));
    
    // Veicolo
    if (sd.tipoVeicolo) {
      points.push(`🚗 ${sd.tipoVeicolo}`);
    }
    
    // Tipo richiesta
    if (sd.tipoRichiesta) {
      points.push(`📝 ${sd.tipoRichiesta}`);
    }
    
    // Targa
    const targaH = (callData.highlights || []).find(h => h.startsWith('🚗 Targa:'));
    if (targaH) points.push(`🔢 ${targaH.replace('🚗 Targa: ', 'Targa: ')}`);
    
    // Email
    const emailH = (callData.highlights || []).find(h => h.startsWith('📧 Email:'));
    if (emailH) points.push(`📧 ${emailH.replace('📧 Email: ', '')}`);
    
    // Polizza
    const polizzaH = (callData.highlights || []).find(h => h.includes('Polizza'));
    if (polizzaH && !polizzaH.includes('Discussione')) points.push(`📋 ${polizzaH.replace('📋 ', '')}`);
    
    // Importi
    if (sd.importi && sd.importi.length > 0) {
      points.push(`💰 ${sd.importi.join(', ')}`);
    }
    
    // Date
    if (sd.dateMenzionate && sd.dateMenzionate.length > 0) {
      points.push(`📅 ${sd.dateMenzionate.join(', ')}`);
    }
    
    // Sinistro
    if (text.includes('sinistro') || text.includes('danno') || text.includes('incidente')) {
      points.push('🚨 Segnalazione sinistro/danno');
    }
    
    // Se non abbiamo nulla di utile, almeno mostriamo qualcosa
    if (points.length === 0) {
      points.push('Chiamata ricevuta, nessun dato specifico estratto');
    }
    
    return points;
  }

  /**
   * Genera un'azione concisa
   */
  _getAction(callData) {
    const text = (callData.transcript || '').toLowerCase();
    
    if (text.includes('richiam') || text.includes('callback')) return '➡️ Da richiamare';
    if (text.includes('email') || text.includes('mail')) return '➡️ Da inviare email';
    if (text.includes('appuntamento')) return '➡️ Appuntamento da confermare';
    if (text.includes('preventivo')) return '➡️ Da preparare preventivo';
    if (text.includes('sinistro')) return '➡️ Sinistro da elaborare';
    
    return null;
  }

  _formatDuration(seconds) {
    if (!seconds || seconds < 60) return `${seconds || 0}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
}

module.exports = { MessageFormatter };
