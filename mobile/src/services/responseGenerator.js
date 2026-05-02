class ResponseGenerator {
  async generateDataDrivenResponse(questionAnalysis, userData) {
    const response = await fetch('/api/response-generator/data-driven', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionAnalysis, userData }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate response: ${response.statusText}`);
    }

    return response.json();
  }

  async generateContextualGuidance(contextValidation) {
    const response = await fetch('/api/response-generator/contextual-guidance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contextValidation }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate guidance: ${response.statusText}`);
    }

    return response.json();
  }

  async generateDataGuidanceResponse(dataValidation, userData) {
    const response = await fetch('/api/response-generator/data-guidance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataValidation, userData }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate data guidance: ${response.statusText}`);
    }

    return response.json();
  }

  async generateErrorResponse(error, question) {
    const response = await fetch('/api/response-generator/error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error, question }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate error response: ${response.statusText}`);
    }

    return response.json();
  }
}

export default new ResponseGenerator();