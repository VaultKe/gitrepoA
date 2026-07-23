import AsyncStorage from '@react-native-async-storage/async-storage';

export function attachPersistence(prototype) {
  prototype._loadFromCache = function() {
    return this._loadFromStorage();
  };

  prototype._loadFromStorage = async function() {
    try {
      const cacheData = await AsyncStorage.getItem('chat_cache');
      if (cacheData) {
        const { rooms, messages } = JSON.parse(cacheData);
        if (rooms) {
          rooms.forEach(room => this.rooms.set(room.id, room));
        }
        if (messages) {
          messages.forEach(([roomId, msgs]) => {
            const deduped = msgs.filter(m => {
              if (!m.tempId || m.tempId === m.id) return true;
              if (m.status === 'sending') return true;
              return false;
            });
            this.messages.set(roomId, deduped);
          });
        }
      }
    } catch (e) {
      console.error('Failed to load chat cache:', e);
    }
  };

  prototype._schedulePersist = function() {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => this._persistToStorage(), 1000);
  };

  prototype._persistToStorage = async function() {
    try {
      const data = {
        rooms: Array.from(this.rooms.values()),
        messages: Array.from(this.messages.entries()),
        timestamp: Date.now(),
      };

      let json = JSON.stringify(data);
      const MAX_CACHE_SIZE = 1024 * 1024;

      if (json.length > MAX_CACHE_SIZE) {
        const trimmedMessages = Array.from(data.messages).map(([roomId, msgs]) => {
          const sorted = msgs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return [roomId, sorted.slice(0, 50)];
        });

        const trimmedData = { ...data, messages: trimmedMessages };
        json = JSON.stringify(trimmedData);
      }

      if (json.length > MAX_CACHE_SIZE) {
        console.warn('Chat cache still too large after trimming, skipping persistence');
        return;
      }

      await AsyncStorage.setItem('chat_cache', json);
    } catch (e) {
      console.error('Failed to persist chat cache:', e);
    }
  };
}
