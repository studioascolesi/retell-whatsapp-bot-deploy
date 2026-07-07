const axios = require('axios');

class RetellService {
  constructor() {
    this.apiKey = process.env.RETELL_API_KEY;
    this.baseUrl = 'https://api.retellai.com';
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Recupera i dettagli completi di una chiamata
   */
  async getCallDetails(callId) {
    try {
      console.log(`🔍 Recupero dettagli chiamata: ${callId}`);
      
      const response = await axios.get(
        `${this.baseUrl}/v2/get-call/${callId}`,
        { headers: this.headers }
      );
      
      const callData = response.data;
      console.log('✅ Dettagli chiamata recuperati');
      
      return this._parseCallData(callData);
      
    } catch (error) {
      console.error('❌ Errore recupero dettagli Retell:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Recupera le chiamate recenti
   */
  async getRecentCalls(limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v2/list-calls`,
        { 
          headers: this.headers,
          params: { limit }
        }
      );
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Errore recupero chiamate:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Analizza il sentiment della conversazione
   */
  _analyzeSentiment(transcript) {
    if (!transcript) return 'neutro';
    
    const positiveWords = ['grazie', 'perfetto', 'ottimo', 'bene', 'certo', 'volentieri', 'sì', 'accetto', 'mi piace'];
    const negativeWords = ['problema', 'lamentela', 'no', 'purtroppo', 'non funziona', 'insoddisfatto', 'errore'];
    
    const text = transcript.toLowerCase();
    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'positivo';
    if (negativeCount > positiveCount) return 'negativo';
    return 'neutro';
  }

  /**
   * Estrae i punti salienti dalla trascrizione
   */
  _extractHighlights(transcript, callType, fromNumber) {
    if (!transcript) return [];
    
    const highlights = [];
    const text = transcript.toLowerCase();
    
    // Nome del chiamante (più pattern)
    const namePatterns = [
      /(?:mi chiamo|sono|qui con me|parla|il mio nome è|a parlar(e|ti) è|chi parla\?* sono)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:sono)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:parl[ao]|chi è\?*|di chi parlo\?*)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        const name = match[1] || match[0];
        highlights.push(`👤 Nome: ${name.trim()}`);
        break;
      }
    }
    
    // Numero del chiamante
    if (fromNumber && fromNumber !== 'N/A') {
      const formatted = fromNumber.replace(/^\+/, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
      highlights.push(`📞 Telefono: ${formatted}`);
    }
    
    // Email
    const emailMatch = transcript.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) highlights.push(`📧 Email: ${emailMatch[0]}`);
    
    // Codice fiscale
    const cfMatch = transcript.match(/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/);
    if (cfMatch) highlights.push(`🪪 Codice fiscale: ${cfMatch[0]}`);
    
    // Targa
    const targaMatch = transcript.match(/\b[A-Z]{2}\d{3}[A-Z]{2}\b/);
    if (targaMatch) highlights.push(`🚗 Targa: ${targaMatch[0]}`);
    
    // Polizza
    if (text.includes('polizza')) {
      const polizzaMatch = transcript.match(/polizza\s+(?:n[°.]?\s*)?(\w+)/i);
      if (polizzaMatch) highlights.push(`📋 Polizza: ${polizzaMatch[0]}`);
      else highlights.push('📋 Discussione polizza');
    }
    
    // Preventivo/costo
    if (text.includes('preventivo') || text.includes('quotazione')) {
      highlights.push('💰 Richiesta preventivo');
    }
    if (text.includes('premio') || text.includes('costo') || text.includes('prezzo') || text.includes('euro')) {
      highlights.push('💰 Argomento economico');
    }
    
    // Sinistro
    if (text.includes('sinistro') || text.includes('danno') || text.includes('incidente')) {
      highlights.push('🚨 Segnalazione sinistro/danno');
    }
    
    // Veicolo
    if (text.includes('auto') || text.includes('automobile')) highlights.push('🚗 Veicolo: Auto');
    if (text.includes('moto') || text.includes('motoveicolo')) highlights.push('🏍️ Veicolo: Moto');
    if (text.includes('barca') || text.includes('imbarcazione')) highlights.push('⛵ Veicolo: Barca');
    
    // Tipo richiesta
    if (text.includes('rinnovo')) highlights.push('🔄 Rinnovo polizza');
    if (text.includes('nuova polizza') || text.includes('nuova assicurazione')) highlights.push('🆕 Nuova polizza');
    if (text.includes('cambio') || text.includes('trasferimento')) highlights.push('🔄 Cambio/trasferimento');
    
    // Appuntamento/azione
    if (text.includes('appuntamento') || text.includes('incontro')) highlights.push('📅 Appuntamento fissato');
    if (text.includes('richiam') || text.includes('callback')) highlights.push('📞 Richiamo programmato');
    if (text.includes('email') || text.includes('invio')) highlights.push('📧 Invio documenti/email');
    
    // Documenti
    if (text.includes('document') || text.includes('modulo') || text.includes('carta identità')) {
      highlights.push('📄 Documenti richiesti');
    }
    
    // Scadenza
    const scadenzaMatch = transcript.match(/scad[enz]\w*\s+(?:il\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (scadenzaMatch) highlights.push(`⏰ Scadenza: ${scadenzaMatch[1]}`);
    
    return highlights.length > 0 ? highlights : ['nessun punto saliente specifico rilevato'];
  }

  /**
   * Analizza i dati estratti dalla chiamata
   */
  _extractStructuredData(transcript, fromNumber) {
    if (!transcript) return {};
    
    const data = {};
    const text = transcript.toLowerCase();
    
    // Numero del chiamante (sempre presente)
    if (fromNumber && fromNumber !== 'N/A') {
      const formatted = fromNumber.replace(/^\+/, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
      data.numeroChiamante = formatted;
    }
    
    // Estrai tipo veicolo
    if (text.includes('auto') || text.includes('automobile')) data.tipoVeicolo = 'Auto';
    else if (text.includes('moto') || text.includes('motoveicolo')) data.tipoVeicolo = 'Moto';
    else if (text.includes('barca') || text.includes('imbarcazione')) data.tipoVeicolo = 'Barca';
    else if (text.includes('furgone') || text.includes('commercial')) data.tipoVeicolo = 'Veicolo commerciale';
    
    // Estrai tipo richiesta
    if (text.includes('preventivo') || text.includes('quotazione')) data.tipoRichiesta = 'Preventivo';
    else if (text.includes('polizza') || text.includes('rinnovo')) data.tipoRichiesta = 'Polizza/Rinnovo';
    else if (text.includes('sinistro') || text.includes('danno')) data.tipoRichiesta = 'Segnalazione sinistro';
    else if (text.includes('informazioni') || text.includes('chiariment')) data.tipoRichiesta = 'Richiesta informazioni';
    
    // Cerca date menzionate
    const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
    const dates = transcript.match(dateRegex);
    if (dates) data.dateMenzionate = dates;
    
    // Cerca importi
    const amountRegex = /(?:euro|€|\$)\s*\d+(?:,\d{2})?|\d+(?:,\d{2})?\s*(?:euro|€|\$)/gi;
    const amounts = transcript.match(amountRegex);
    if (amounts) data.importi = amounts;
    
    // Cerca altri numeri di telefono nel transcript (diversi dal chiamante)
    const phoneRegex = /(?:\+39|0039|39)?\s*\d{3}\s*\d{3}\s*\d{4}/g;
    const phones = transcript.match(phoneRegex);
    if (phones) {
      // Filtra il numero del chiamante se presente
      const cleanFrom = fromNumber?.replace(/\D/g, '') || '';
      const otherPhones = phones.filter(p => {
        const clean = p.replace(/\D/g, '');
        return clean !== cleanFrom && !cleanFrom.endsWith(clean) && !clean.endsWith(cleanFrom.slice(-10));
      });
      if (otherPhones.length > 0) data.altriTelefoni = otherPhones;
    }
    
    return data;
  }

  /**
   * Parsa i dati della chiamata dal payload del webhook (già presente nel body)
   */
  parseWebhookData(data) {
    const transcriptObject = data.transcript_object || [];
    const transcript = data.transcript || this._buildTranscriptFromObject(transcriptObject);
    const duration = data.call_duration_ms ? Math.round(data.call_duration_ms / 1000) 
                    : data.duration || 0;
    const fromNumber = data.from_number || 'N/A';
    
    return {
      callId: data.call_id,
      agentId: data.agent_id,
      startTime: data.start_timestamp ? new Date(data.start_timestamp) : new Date(),
      endTime: data.end_timestamp ? new Date(data.end_timestamp) : new Date(),
      duration: duration,
      fromNumber: fromNumber,
      toNumber: data.to_number || 'N/A',
      status: data.call_status,
      transcript: transcript,
      disconnectionReason: data.disconnection_reason,
      sentiment: this._analyzeSentiment(transcript),
      highlights: this._extractHighlights(transcript, data.call_type, fromNumber),
      structuredData: this._extractStructuredData(transcript, fromNumber),
      recordingUrl: data.recording_url,
      transcriptObject: transcriptObject
    };
  }

  /**
   * Costruisce il testo del transcript da transcript_object (array di segmenti)
   */
  _buildTranscriptFromObject(transcriptObject) {
    if (!transcriptObject || transcriptObject.length === 0) return '';
    
    return transcriptObject
      .map(seg => {
        const role = seg.role === 'agent' ? 'Bot' : 'Cliente';
        return `${role}: ${seg.content}`;
      })
      .join('\n');
  }

  /**
   * Parsa i dati della chiamata dal formato Retell API
   */
  _parseCallData(data) {
    const transcriptObject = data.transcript_object || [];
    const transcript = data.transcript || this._buildTranscriptFromObject(transcriptObject);
    const duration = data.call_duration_ms ? Math.round(data.call_duration_ms / 1000) : 0;
    const fromNumber = data.from_number || 'N/A';
    
    return {
      callId: data.call_id,
      agentId: data.agent_id,
      startTime: data.start_timestamp ? new Date(data.start_timestamp) : new Date(),
      endTime: data.end_timestamp ? new Date(data.end_timestamp) : new Date(),
      duration: duration,
      fromNumber: fromNumber,
      toNumber: data.to_number || 'N/A',
      status: data.call_status,
      transcript: transcript,
      disconnectionReason: data.disconnection_reason,
      sentiment: this._analyzeSentiment(transcript),
      highlights: this._extractHighlights(transcript, data.call_type, fromNumber),
      structuredData: this._extractStructuredData(transcript, fromNumber),
      recordingUrl: data.recording_url,
      transcriptObject: transcriptObject
    };
  }
}

module.exports = { RetellService };
