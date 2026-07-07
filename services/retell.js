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
    
    // ── CHI CHIAMA ──
    // Nome del chiamante
    const namePatterns = [
      /(?:mi chiamo|sono il signor[ao]?|sono la signor[ao]?|sono avv?oc[ao]t[oa]?|parla|il mio nome è|a parlar[et] è|chi parla\?\s*sono|qui con (?:me|lui|lei))\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i,
      /(?:sono)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i,
      /(?:parl[ao]|chi è|di chi parlo)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        const name = (match[1] || match[0]).trim();
        // Evita falsi positivi
        if (!['il', 'la', 'le', 'lo', 'un', 'una', 'che', 'come', 'cosa', 'dove', 'quando', 'perché', 'bene', 'male'].includes(name.toLowerCase())) {
          highlights.push(`👤 Nome: ${name}`);
          break;
        }
      }
    }
    
    // Ruolo (avvocato, cliente, ecc.)
    if (text.includes('avvocat') || text.includes('avv. ') || text.includes('legale')) {
      highlights.push('⚖️ Ruolo: Avvocato/Legale');
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
    if (cfMatch) highlights.push(`🪪 CF: ${cfMatch[0]}`);
    
    // ── VEICOLO ──
    const targaMatch = transcript.match(/\b[A-Z]{2}\d{3}[A-Z]{2}\b/);
    if (targaMatch) highlights.push(`🔢 Targa: ${targaMatch[0]}`);
    
    if (text.includes('barca') || text.includes('imbarcazione') || text.includes('motore fuoribordo')) {
      highlights.push('⛵ Veicolo: Barca');
    } else if (text.includes('moto') || text.includes('motoveicolo')) {
      highlights.push('🏍️ Veicolo: Moto');
    } else if (text.includes('auto') || text.includes('automobile') || text.includes('macchina')) {
      highlights.push('🚗 Veicolo: Auto');
    }
    
    // ── TIPO RICHIESTA ──
    // Sinistro / Danno
    if (text.includes('sinistro') || text.includes('danno') || text.includes('incidente')) {
      if (text.includes('perizia')) {
        highlights.push('🔍 Sinistro + richiesta perizia');
      } else {
        highlights.push('🚨 Segnalazione sinistro/danno');
      }
    }
    
    // Perizia (anche senza sinistro)
    if (text.includes('perizia') || text.includes('perito') || text.includes('sopralluogo')) {
      if (!highlights.some(h => h.includes('perizia'))) {
        highlights.push('🔍 Richiesta perizia');
      }
    }
    
    // Causa / Tribunale
    if (text.includes('causa') || text.includes('tribunale') || text.includes('udienza') || text.includes('sentenza') || text.includes('giudice')) {
      highlights.push('⚖️ Causa legale');
    }
    
    // Documenti
    if (text.includes('document') || text.includes('integrazione') || text.includes('manca') || text.includes('mancante')) {
      highlights.push('📄 Documentazione richiesta');
    }
    
    // Testimoni
    if (text.includes('testimone') || text.includes('testimonial') || text.includes('dichiarazion')) {
      highlights.push('👤 Menziona testimoni');
    }
    
    // Polizza
    if (text.includes('polizza')) {
      if (text.includes('rinnovo') || text.includes('rinnovare')) {
        highlights.push('🔄 Rinnovo polizza');
      } else {
        highlights.push('📋 Discussione polizza');
      }
    }
    
    // Preventivo / Costo
    if (text.includes('preventivo') || text.includes('quotazione') || text.includes('costo') || text.includes('prezzo')) {
      highlights.push('💰 Preventivo/costo');
    }
    
    // Risarcimento / Pagamento
    if (text.includes('risarciment') || text.includes('pagamento') || text.includes('liquidazion')) {
      highlights.push('💰 Risarcimento/pagamento');
    }
    
    // Appuntamento
    if (text.includes('appuntamento') || text.includes('incontro') || text.includes('passare')) {
      highlights.push('📅 Richiesta appuntamento');
    }
    
    // Richiamare
    if (text.includes('richiam') || text.includes('callback')) {
      highlights.push('📞 Richiamare il cliente');
    }
    
    return highlights.length > 0 ? highlights : ['📞 Chiamata ricevuta'];
  }

  /**
   * Analizza i dati estratti dalla chiamata
   */
  _extractStructuredData(transcript, fromNumber) {
    if (!transcript) return {};
    
    const data = {};
    const text = transcript.toLowerCase();
    
    // Numero del chiamante
    if (fromNumber && fromNumber !== 'N/A') {
      const formatted = fromNumber.replace(/^\+/, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
      data.numeroChiamante = formatted;
    }
    
    // Tipo veicolo
    if (text.includes('barca') || text.includes('imbarcazione') || text.includes('motore fuoribordo')) {
      data.tipoVeicolo = 'Barca';
    } else if (text.includes('moto') || text.includes('motoveicolo')) {
      data.tipoVeicolo = 'Moto';
    } else if (text.includes('auto') || text.includes('automobile') || text.includes('macchina')) {
      data.tipoVeicolo = 'Auto';
    }
    
    // Tipo richiesta (priorità)
    if (text.includes('sinistro')) data.tipoRichiesta = 'Sinistro';
    else if (text.includes('perizia') || text.includes('perito')) data.tipoRichiesta = 'Perizia';
    else if (text.includes('causa') || text.includes('tribunale')) data.tipoRichiesta = 'Causa legale';
    else if (text.includes('avvocat') || text.includes('legale')) data.tipoRichiesta = 'Rapporto avvocato';
    else if (text.includes('document') || text.includes('integrazione')) data.tipoRichiesta = 'Documentazione';
    else if (text.includes('testimone') || text.includes('dichiarazion')) data.tipoRichiesta = 'Testimoni';
    else if (text.includes('polizza') || text.includes('rinnovo')) data.tipoRichiesta = 'Polizza';
    else if (text.includes('preventivo') || text.includes('costo')) data.tipoRichiesta = 'Preventivo';
    else if (text.includes('risarciment') || text.includes('pagamento')) data.tipoRichiesta = 'Risarcimento';
    
    // Date menzionate
    const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g;
    const dates = transcript.match(dateRegex);
    if (dates) data.dateMenzionate = dates;
    
    // Importi
    const amountRegex = /(?:euro|€|\$)\s*\d+(?:,\d{2})?|\d+(?:,\d{2})?\s*(?:euro|€|\$)/gi;
    const amounts = transcript.match(amountRegex);
    if (amounts) data.importi = amounts;
    
    // Targa
    const targaMatch = transcript.match(/\b[A-Z]{2}\d{3}[A-Z]{2}\b/);
    if (targaMatch) data.targa = targaMatch[0];
    
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
        const role = seg.role === 'agent' ? 'Giulia' : 'Cliente';
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
