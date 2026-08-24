import { useEffect, useState, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { useApp } from '../context/AppContext';
import Toast from 'react-native-toast-message';

const useAutoUpdate = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { theme } = useApp();

  const checkForUpdates = useCallback(async () => {
    if (__DEV__) {
      return;
    }

    if (isChecking) {
      return;
    }

    try {
      setIsChecking(true);

      if (!Updates.isEmbeddedLaunch) {
        return;
      }

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateAvailable(true);

        Toast.show({
          type: 'info',
          text1: 'Update available',
          text2: 'Downloading update in the background...',
          position: 'bottom',
          visibilityTime: 3000,
        });

        await Updates.fetchUpdateAsync();

        Toast.show({
          type: 'success',
          text1: 'Update ready',
          text2: 'Restarting app to apply changes...',
          position: 'bottom',
          visibilityTime: 3000,
        });

        setTimeout(() => {
          Updates.reloadAsync();
        }, 2500);
      }
    } catch (error) {
      console.error('Auto-update check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    isChecking,
    updateAvailable,
    checkForUpdates,
  };
};

export default useAutoUpdate;
