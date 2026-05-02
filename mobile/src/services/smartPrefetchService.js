import AsyncStorage from '@react-native-async-storage/async-storage';
import lightningDataService from './cacheDataService';

/**
 * Smart Prefetch Service
 * Intelligently prefetches data based on user behavior patterns
 */
class SmartPrefetchService {
  constructor() {
    this.navigationHistory = [];
    this.userPatterns = new Map();
    this.prefetchRules = new Map();
    this.activePrefetches = new Set();
    this.prefetchStats = {
      successful: 0,
      failed: 0,
      cacheHits: 0,
      totalPrefetches: 0,
    };

    this.initializePrefetchRules();
    this.loadUserPatterns();
  }

  initializePrefetchRules() {
    // Define smart prefetch rules based on user behavior
    this.prefetchRules.set('user-dashboard', {
      immediate: ['wallet', 'notifications', 'unread-count'],
      delayed: ['chamas', 'transactions'],
      conditional: {
        'time-morning': ['meetings'],
        'time-evening': ['chama-transactions'],
      }
    });

    this.prefetchRules.set('chama-dashboard', {
      immediate: ['chamas'],
      delayed: ['meetings'], // chama-members and chama-transactions need specific chamaId
      onHover: ['chama-details'],
    });

    

    this.prefetchRules.set('chat', {
      immediate: ['chat-rooms'],
      delayed: ['recent-messages'],
      onRoomSelect: ['room-messages', 'room-members'],
    });

    this.prefetchRules.set('wallet', {
      immediate: ['wallet', 'transactions'],
      delayed: ['recent-contacts'],
      onTransactionStart: ['payment-methods'],
    });

    this.prefetchRules.set('notifications', {
      immediate: ['notifications', 'unread-count'],
      delayed: [],
      onMarkRead: ['updated-notifications'],
    });

    this.prefetchRules.set('admin', {
      immediate: ['system-stats'],
      delayed: ['all-users', 'all-chamas', 'support-requests'],
      onUserManagement: ['user-details'],
    });
  }

  /**
   * NAVIGATION-BASED PREFETCHING
   */
  async prefetchForPage(pageName, priority = 'normal') {
    const rules = this.prefetchRules.get(pageName);
    if (!rules) {
      return;
    }

    // Execute prefetch based on priority
    if (priority === 'high' && rules.immediate) {
      await this.executePrefetch(pageName, 'immediate');
    } else if (rules.delayed) {
    }
  }

  async onNavigationChange(currentRoute, previousRoute) {
    // Record navigation pattern
    this.recordNavigation(currentRoute, previousRoute);
    
    // Execute immediate prefetches for current page
    await this.executePrefetch(currentRoute, 'immediate');
    
    // Execute delayed prefetches in background
    setTimeout(() => {
      this.executePrefetch(currentRoute, 'delayed');
    }, 500);
    
    // Predict and prefetch next likely pages
    await this.predictivelyPrefetch(currentRoute);
  }

  async executePrefetch(route, priority) {
    const rules = this.prefetchRules.get(route);
    if (!rules || !rules[priority]) return;

    const dataToPrefetch = rules[priority];
    const prefetchPromises = dataToPrefetch.map(async (dataType) => {
      if (this.activePrefetches.has(dataType)) {
        return;
      }

      this.activePrefetches.add(dataType);
      this.prefetchStats.totalPrefetches++;

      try {
        const result = await lightningDataService.getData(dataType);
        if (result.success) {
          this.prefetchStats.successful++;
          if (result.source !== 'api') {
            this.prefetchStats.cacheHits++;
          }
        } else {
          this.prefetchStats.failed++;
        }
      } catch (error) {
        this.prefetchStats.failed++;
      } finally {
        this.activePrefetches.delete(dataType);
      }
    });

    if (priority === 'immediate') {
      // Wait for immediate prefetches
      await Promise.all(prefetchPromises);
    } else {
    }
  }

  /**
   * PREDICTIVE PREFETCHING - Based on user patterns
   */
  async predictivelyPrefetch(currentRoute) {
    const predictions = this.predictNextRoutes(currentRoute);
    for (const prediction of predictions) {
      if (prediction.confidence > 0.6) {
        // Prefetch immediate data for highly likely next routes
        setTimeout(() => {
          this.executePrefetch(prediction.route, 'immediate');
        }, 1000);
      }
    }
  }

  predictNextRoutes(currentRoute) {
    const patterns = this.userPatterns.get(currentRoute) || new Map();
    const predictions = [];

    for (const [nextRoute, count] of patterns) {
      const totalFromCurrent = Array.from(patterns.values()).reduce((sum, c) => sum + c, 0);
      const confidence = count / totalFromCurrent;
      
      predictions.push({
        route: nextRoute,
        confidence,
        count,
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * CONTEXTUAL PREFETCHING - Based on time, user state, etc.
   */
  async contextualPrefetch(route) {
    const rules = this.prefetchRules.get(route);
    if (!rules?.conditional) return;

    const context = this.getCurrentContext();
    
    for (const [condition, dataTypes] of Object.entries(rules.conditional)) {
      if (this.evaluateCondition(condition, context)) {
        const prefetchPromises = dataTypes.map(dataType => 
          lightningDataService.getData(dataType)
        );
      }
    }
  }

  getCurrentContext() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    return {
      timeOfDay: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
      dayType: day === 0 || day === 6 ? 'weekend' : 'weekday',
      hour,
      day,
    };
  }

  evaluateCondition(condition, context) {
    switch (condition) {
      case 'time-morning':
        return context.timeOfDay === 'morning';
      case 'time-afternoon':
        return context.timeOfDay === 'afternoon';
      case 'time-evening':
        return context.timeOfDay === 'evening';
      case 'day-weekend':
        return context.dayType === 'weekend';
      case 'day-weekday':
        return context.dayType === 'weekday';
      default:
        return false;
    }
  }

  /**
   * USER INTERACTION PREFETCHING
   */
  async onUserHover(element, route) {
    const rules = this.prefetchRules.get(route);
    if (rules?.onHover) {
      this.executePrefetch(route, 'onHover');
    }
  }

  async onUserScroll(route, scrollPosition) {
    const rules = this.prefetchRules.get(route);
    if (rules?.onScroll && scrollPosition > 0.7) {
      this.executePrefetch(route, 'onScroll');
    }
  }

  async onSearchStart(route, query) {
    const rules = this.prefetchRules.get(route);
    if (rules?.onSearch) {
      this.executePrefetch(route, 'onSearch');
    }
  }

  /**
   * PATTERN LEARNING
   */
  recordNavigation(currentRoute, previousRoute) {
    if (!previousRoute) return;

    this.navigationHistory.push({
      from: previousRoute,
      to: currentRoute,
      timestamp: Date.now(),
    });

    // Keep only recent history (last 100 navigations)
    if (this.navigationHistory.length > 100) {
      this.navigationHistory = this.navigationHistory.slice(-100);
    }

    // Update patterns
    if (!this.userPatterns.has(previousRoute)) {
      this.userPatterns.set(previousRoute, new Map());
    }

    const fromPatterns = this.userPatterns.get(previousRoute);
    const currentCount = fromPatterns.get(currentRoute) || 0;
    fromPatterns.set(currentRoute, currentCount + 1);

    // Save patterns periodically
    this.saveUserPatterns();
  }

  async loadUserPatterns() {
    try {
      const stored = await AsyncStorage.getItem('userNavigationPatterns');
      if (stored) {
        const patterns = JSON.parse(stored);
        this.userPatterns = new Map(
          Object.entries(patterns).map(([key, value]) => [
            key,
            new Map(Object.entries(value))
          ])
        );
      }
    } catch (error) {
    }
  }

  async saveUserPatterns() {
    try {
      const patterns = Object.fromEntries(
        Array.from(this.userPatterns.entries()).map(([key, value]) => [
          key,
          Object.fromEntries(value)
        ])
      );
      await AsyncStorage.setItem('userNavigationPatterns', JSON.stringify(patterns));
    } catch (error) {
    }
  }

  /**
   * PREFETCH OPTIMIZATION
   */
  async optimizePrefetching() {
    const hitRate = this.prefetchStats.cacheHits / this.prefetchStats.totalPrefetches;
    const successRate = this.prefetchStats.successful / this.prefetchStats.totalPrefetches;
    
    // Adjust prefetch rules based on performance
    if (hitRate > 0.8) {
      this.increaseAggressiveness();
    } else if (hitRate < 0.3) {
      this.reduceAggressiveness();
    }
  }

  increaseAggressiveness() {
    // Move some delayed prefetches to immediate
    for (const [route, rules] of this.prefetchRules) {
      if (rules.delayed && rules.delayed.length > 0) {
        const toPromote = rules.delayed.splice(0, 1);
        rules.immediate = [...(rules.immediate || []), ...toPromote];
      }
    }
  }

  reduceAggressiveness() {
    // Move some immediate prefetches to delayed
    for (const [route, rules] of this.prefetchRules) {
      if (rules.immediate && rules.immediate.length > 2) {
        const toDemote = rules.immediate.splice(-1);
        rules.delayed = [...(rules.delayed || []), ...toDemote];
      }
    }
  }

  /**
   * STATUS AND CONTROL
   */
  getStats() {
    return {
      ...this.prefetchStats,
      hitRate: this.prefetchStats.cacheHits / this.prefetchStats.totalPrefetches,
      successRate: this.prefetchStats.successful / this.prefetchStats.totalPrefetches,
      activePrefetches: this.activePrefetches.size,
      learnedPatterns: this.userPatterns.size,
    };
  }

  clearPatterns() {
    this.userPatterns.clear();
    this.navigationHistory = [];
    AsyncStorage.removeItem('userNavigationPatterns');
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

export default new SmartPrefetchService();
