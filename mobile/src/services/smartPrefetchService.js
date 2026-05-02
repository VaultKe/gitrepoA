class SmartPrefetchService {
  async prefetchForPage(pageName, priority = 'normal') {
    const response = await fetch('/api/smart-prefetch/prefetch-for-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pageName, priority }),
    });

    if (!response.ok) {
      throw new Error(`Failed to prefetch for page: ${response.statusText}`);
    }

    return response.json();
  }

  async onNavigationChange(currentRoute, previousRoute) {
    const response = await fetch('/api/smart-prefetch/on-navigation-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentRoute, previousRoute }),
    });

    if (!response.ok) {
      throw new Error(`Failed to handle navigation change: ${response.statusText}`);
    }

    return response.json();
  }

  async getStats() {
    const response = await fetch('/api/smart-prefetch/stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get prefetch stats: ${response.statusText}`);
    }

    return response.json();
  }

  async clearPatterns() {
    const response = await fetch('/api/smart-prefetch/clear-patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear patterns: ${response.statusText}`);
    }

    return response.json();
  }

  setEnabled(enabled) {
    // This could be stored locally or sent to backend if needed
    this.enabled = enabled;
  }
}

export default new SmartPrefetchService();