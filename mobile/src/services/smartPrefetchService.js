class SmartPrefetchService {
  async prefetchForPage(pageName, priority = 'normal') {
    return { success: true, data: null };
  }

  async executePrefetch(pageName, priority = 'normal') {
    return { success: true, data: null };
  }

  async onNavigationChange(currentRoute, previousRoute) {
    return { success: true, data: null };
  }

  async onUserHover(element, currentRoute) {
    return { success: true, data: null };
  }

  async onUserScroll(currentRoute, scrollPosition) {
    return { success: true, data: null };
  }

  async getStats() {
    return { success: true, data: null };
  }

  async clearPatterns() {
    return { success: true, data: null };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

export default new SmartPrefetchService();