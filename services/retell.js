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
  _extractHighlights(transcript, callType) {
    if (!transcript) return [];
    
    const highlights = [];
    const text = transcript.toLowerCase();
    
    // Pattern per assicurazioni
    if (text.includes('polizza') || text.includes('assicurazione')) {
      highlights.push(' discussingione polizza/assicurazione');
    }
    if (text.includes('premio') || text.includes('costo') || text.includes('prezzo')) {
      highlights.push(' argomento economico/premium');
    }
    if (text.includes('sinistro') || text.includes('danno') || text.includes('incidente')) {
      highlights.push(' riferimento a sinistro/danno');
    }
    if (text.includes('auto') || text.includes('moto') || text.includes('barca')) {
      highlights.push(' veicolo menzionato');
    }
    if (text.includes('appuntamento') || text.includes('incontro') || text.includes('richiam')) {
      highlights.push(' appuntamento fissato');
    }
    if (text.includes('document') || text.includes('modulo') || text.includes('richiesta')) {
      highlights.push(' documenti/richieste menzionate');
    }
    
    return highlights.length > 0 ? highlights : ['nessun punto saliente specifico rilevato'];
  }

  /**
   * Analizza i dati estratti dalla chiamata
   */
  _extractStructuredData(transcript) {
    if (!transcript) return {};
    
    const data = {};
    const text = transcript.toLowerCase();
    
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
    
    // Cerca numeri di telefono
    const phoneRegex = /(?:\+39|0039|39)?\s*\d{3}\s*\d{3}\s*\d{4}/g;
    const phones = transcript.match(phoneRegex);
    if (phones) data.telefoni = phones;
    
    return data;
  }

  /**
   * Parsa i dati della chiamata dal formato Retell
   */
  _parseCallData(data) {
    const transcript = data.transcript || '';
    const duration = data.call_duration_ms ? Math.round(data.call_duration_ms / 1000) : 0;
    
    return {
      callId: data.call_id,
      agentId: data.agent_id,
      startTime: data.start_timestamp ? new Date(data.start_timestamp) : new Date(),
      endTime: data.end_timestamp ? new Date(data.end_timestamp) : new Date(),
      duration: duration,
      fromNumber: data.from_number || 'N/A',
      toNumber: data.to_number || 'N/A',
      status: data.call_status,
      transcript: transcript,
      disconnectionReason: data.disconnection_reason,
      sentiment: this._analyzeSentiment(transcript),
      highlights: this._extractHighlights(transcript, data.call_type),
      structuredData: this._extractStructuredData(transcript),
      recordingUrl: data.recording_url,
      transcriptObject: data.transcript_object || []
    };
  }
}

module.exports = { RetellService };
