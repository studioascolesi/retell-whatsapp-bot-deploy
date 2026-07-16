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
   * Estrae solo il testo del cliente (User) da transcript_object
   */
  _getUserText(transcriptObject) {
    if (!transcriptObject || !Array.isArray(transcriptObject)) return '';
    return transcriptObject
      .filter(seg => seg.role === 'user')
      .map(seg => seg.content)
      .join(' ');
  }

  /**
   * Estrae solo il testo dell'agente (Agent) da transcript_object
   */
  _getAgentText(transcriptObject) {
    if (!transcriptObject || !Array.isArray(transcriptObject)) return '';
    return transcriptObject
      .filter(seg => seg.role === 'agent')
      .map(seg => seg.content)
      .join(' ');
  }

  /**
   * Estrae i punti salienti dalla trascrizione.
   * Usa transcript_object per separare i messaggi del cliente da quelli dell'agente.
   */
  _extractHighlights(transcript, callType, fromNumber, transcriptObject) {
    if (!transcript) return [];
    
    const highlights = [];
    const userText = this._getUserText(transcriptObject).toLowerCase();
    const fullText = transcript.toLowerCase();
    
    // ── CHI CHIAMA (solo da messaggi del cliente) ──
    const namePatterns = [
      /(?:mi chiamo|sono il signor[ao]?|sono la signor[ao]?|sono avv?oc[ao]t[oa]?|parla|il mio nome è|a parlar[et] è|chi parla\?\s*sono|qui con (?:me|lui|lei))\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i,
      /(?:sono)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i,
      /(?:parl[ao]|chi è|di chi parlo)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = userText.match(pattern);
      if (match) {
        const name = (match[1] || match[0]).trim();
        if (!['il', 'la', 'le', 'lo', 'un', 'una', 'che', 'come', 'cosa', 'dove', 'quando', 'perché', 'bene', 'male'].includes(name.toLowerCase())) {
          highlights.push(`👤 Nome: ${name}`);
          break;
        }
      }
    }
    
    // Ruolo (avvocato, cliente, ecc.) - solo da userText
    if (userText.includes('avvocat') || userText.includes('avv. ') || userText.includes('legale') || userText.includes('giudice')) {
      highlights.push('⚖️ Ruolo: Avvocato/Legale');
    }
    
    // Numero del chiamante
    if (fromNumber && fromNumber !== 'N/A') {
      const formatted = fromNumber.replace(/^\+/, '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
      highlights.push(`📞 Telefono: ${formatted}`);
    }
    
    // Email - solo da userText
    const emailMatch = userText.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) highlights.push(`📧 Email: ${emailMatch[0]}`);
    
    // Codice fiscale - solo da userText
    const cfMatch = userText.match(/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/);
    if (cfMatch) highlights.push(`🪪 CF: ${cfMatch[0]}`);
    
    // ── VEICOLO (da fullText) ──
    const targaMatch = transcript.match(/\b[A-Z]{2}\d{3}[A-Z]{2}\b/);
    if (targaMatch) highlights.push(`🔢 Targa: ${targaMatch[0]}`);
    
    if (fullText.includes('barca') || fullText.includes('imbarcazione') || fullText.includes('motore fuoribordo')) {
      highlights.push('⛵ Veicolo: Barca');
    } else if (fullText.includes('moto') || fullText.includes('motoveicolo')) {
      highlights.push('🏍️ Veicolo: Moto');
    } else if (fullText.includes('auto') || fullText.includes('automobile') || fullText.includes('macchina')) {
      highlights.push('🚗 Veicolo: Auto');
    }
    
    // ── TIPO RICHIESTA (da userText) ──
    if (userText.includes('sinistro') || userText.includes('danno') || userText.includes('incidente')) {
      if (userText.includes('perizia')) {
        highlights.push('🔍 Sinistro + richiesta perizia');
      } else {
        highlights.push('🚨 Segnalazione sinistro/danno');
      }
    }
    
    if (userText.includes('perizia') || userText.includes('perito') || userText.includes('sopralluogo')) {
      if (!highlights.some(h => h.includes('perizia'))) {
        highlights.push('🔍 Richiesta perizia');
      }
    }
    
    if (userText.includes('causa') || userText.includes('tribunale') || userText.includes('udienza') || userText.includes('sentenza') || userText.includes('giudice')) {
      highlights.push('⚖️ Causa legale');
    }
    
    if (userText.includes('document') || userText.includes('integrazione') || userText.includes('manca') || userText.includes('mancante')) {
      highlights.push('📄 Documentazione richiesta');
    }
    
    if (userText.includes('testimone') || userText.includes('testimonial') || userText.includes('dichiarazion')) {
      highlights.push('👤 Menziona testimoni');
    }
    
    if (userText.includes('polizza')) {
      if (userText.includes('rinnovo') || userText.includes('rinnovare')) {
        highlights.push('🔄 Rinnovo polizza');
      } else {
        highlights.push('📋 Discussione polizza');
      }
    }
    
    if (userText.includes('preventivo') || userText.includes('quotazione') || userText.includes('costo') || userText.includes('prezzo')) {
      highlights.push('💰 Preventivo/costo');
    }
    
    if (userText.includes('risarciment') || userText.includes('pagamento') || userText.includes('liquidazion')) {
      highlights.push('💰 Risarcimento/pagamento');
    }
    
    if (userText.includes('appuntamento') || userText.includes('incontro') || userText.includes('passare')) {
      highlights.push('📅 Richiesta appuntamento');
    }
    
    if (userText.includes('richiam') || userText.includes('callback')) {
      highlights.push('📞 Richiamare il cliente');
    }
    
    // Numero pratica - solo da userText, richiede almeno una cifra
    const praticaMatch = userText.match(/(?:pratica|numero\s*pratica|n[°.]*\s*pratica)\s*(?:n[°.]*\s*)?[:\s]*(\d[\w\-\/]*\d|\d+)/i);
    if (praticaMatch) highlights.push(`📂 Pratica: ${praticaMatch[1]}`);
    
    // Numero sinistro - solo da userText, richiede almeno una cifra
    const sinistroMatch = userText.match(/(?:sinistro|numero\s*sinistro|n[°.]*\s*sinistro)\s*(?:n[°.]*\s*)?[:\s]*(\d[\w\-\/]*\d|\d+)/i);
    if (sinistroMatch) highlights.push(`🚨 Sinistro: ${sinistroMatch[1]}`);
    
    // Compagnia assicurativa - solo da userText
    const compagnie = ['general', 'assitalia', 'axa', 'allianz', 'unipol', 'zagame', 'convergenze', 'bper', 'intesa', 'sai', 'vittoria', 'groupama', 'terna', 'cattolica', 'poste', 'arca', 'helvetia', 'quixa', 'sara'];
    for (const c of compagnie) {
      if (userText.includes(c.toLowerCase())) {
        highlights.push(`🏢 Compagnia: ${c}`);
        break;
      }
    }
    
    // Avvocato - solo da userText
    const avvocatoMatch = userText.match(/(?:avv[oc]*\.?\s+|avvocat[oa]?\s+)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i);
    if (avvocatoMatch) highlights.push(`⚖️ Avvocato: ${avvocatoMatch[0].trim()}`);
    
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
    
    // ── DATI AGGIUNTIVI DAL PROMPT ──
    
    // Numero pratica — richiede almeno una cifra
    const praticaMatch = transcript.match(/(?:pratica|numero\s*pratica|n[°.]*\s*pratica)\s*(?:n[°.]*\s*)?[:\s]*(\d[\w\-\/]*\d|\d+)/i);
    if (praticaMatch) data.numeroPratica = praticaMatch[1];
    
    // Numero sinistro — richiede almeno una cifra
    const sinistroMatch = transcript.match(/(?:sinistro|numero\s*sinistro|n[°.]*\s*sinistro)\s*(?:n[°.]*\s*)?[:\s]*(\d[\w\-\/]*\d|\d+)/i);
    if (sinistroMatch) data.numeroSinistro = sinistroMatch[1];
    
    // Compagnia assicurativa
    const compagnie = ['general', 'assitalia', 'axa', 'allianz', 'Generali', 'unipol', 'zagame', 'convergenze', 'bper', 'intesa', 'sai', 'vittoria', 'groupama', 'terna', 'cattolica', 'poste', 'arca', 'helvetia', 'romagna', 'quixa', 'sara', 'reu'];
    for (const c of compagnie) {
      if (text.includes(c.toLowerCase())) {
        data.compagniaAssicurativa = c;
        break;
      }
    }
    
    // Avvocato di riferimento
    const avvocatoMatch = transcript.match(/(?:avv[oc]*\.?\s+|avvocat[oa]?\s+)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i);
    if (avvocatoMatch) data.avvocatoDiRiferimento = avvocatoMatch[0].trim();
    
    // Studio legale
    const studioMatch = transcript.match(/(?:studio\s+)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+){0,2})/i);
    if (studioMatch && !studioMatch[1].toLowerCase().includes('ascolesi')) {
      data.studioLegale = `Studio ${studioMatch[1].trim()}`;
    }
    
    // Urgenza
    if (text.includes('urgenz') || text.includes('urgente') || text.includes('subito') || text.includes('importante')) {
      data.urgenza = 'Alta';
    } else if (text.includes('non urgente') || text.includes('nessuna fretta') || text.includes('quando può')) {
      data.urgenza = 'Bassa';
    } else {
      data.urgenza = 'Normale';
    }
    
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
   * Parsa i dati della chiamata dal payload del webhook
   * Il webhook wrappa i dati in `call` object (payload.call)
   */
  parseWebhookData(data) {
    const transcriptObject = data.transcript_object || [];
    const transcript = data.transcript || this._buildTranscriptFromObject(transcriptObject);
    const duration = data.duration_ms ? Math.round(data.duration_ms / 1000) 
                    : data.call_duration_ms ? Math.round(data.call_duration_ms / 1000)
                    : data.duration || 0;
    const fromNumber = data.from_number || 'N/A';
    const callAnalysis = data.call_analysis || null;
    
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
      sentiment: callAnalysis?.user_sentiment || this._analyzeSentiment(transcript),
      callSummary: callAnalysis?.call_summary || null,
      callSuccessful: callAnalysis?.call_successful ?? null,
      highlights: this._extractHighlights(transcript, data.call_type, fromNumber, transcriptObject),
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
