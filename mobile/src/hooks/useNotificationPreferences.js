import { useState, useEffect, useRef, useCallback } from 'react';
import ApiService from '../services/api';

let cachedPreferences = null;
let cachedSounds = null;
let loadPromise = null;

const useNotificationPreferences = () => {
  const [preferences, setPreferences] = useState(cachedPreferences);
  const [sounds, setSounds] = useState(cachedSounds);
  const [loading, setLoading] = useState(!cachedPreferences);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPreferences = useCallback(async () => {
    if (cachedPreferences && cachedSounds) {
      return { preferences: cachedPreferences, sounds: cachedSounds };
    }

    if (loadPromise) {
      const result = await loadPromise;
      if (mountedRef.current) {
        setPreferences(result.preferences);
        setSounds(result.sounds);
        setLoading(false);
      }
      return result;
    }

    loadPromise = (async () => {
      try {
        const response = await ApiService.getNotificationPreferences();
        if (response.success) {
          cachedPreferences = response.data.preferences;
          cachedSounds = response.data.available_sounds || [];
          return { preferences: cachedPreferences, sounds: cachedSounds };
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        throw error;
      }
    })();

    try {
      const result = await loadPromise;
      if (mountedRef.current) {
        setPreferences(result.preferences);
        setSounds(result.sounds);
        setLoading(false);
      }
      return result;
    } finally {
      loadPromise = null;
    }
  }, []);

  const updatePreference = useCallback(async (key, value) => {
    try {
      const response = await ApiService.updateNotificationPreferences({ [key]: value });
      if (response.success) {
        setPreferences(prev => {
          const next = { ...prev, [key]: value };
          cachedPreferences = next;
          return next;
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      return false;
    }
  }, []);

  return {
    preferences,
    sounds,
    loading,
    loadPreferences,
    updatePreference,
  };
};

export default useNotificationPreferences;
