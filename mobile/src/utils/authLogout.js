let appLogout = null;
let isLoggingOut = false;

export const setAppLogout = (fn) => {
  appLogout = typeof fn === 'function' ? fn : null;
};

export const triggerAppLogout = async () => {
  if (isLoggingOut) {
    return new Promise(() => {});
  }

  isLoggingOut = true;
  try {
    console.warn('triggerAppLogout invoked - clearing auth keys', new Error().stack);
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const authKeys = ['authToken', 'token', 'user', 'userRole', 'userData'];
    await AsyncStorage.multiRemove(authKeys);

    if (appLogout) {
      try {
        appLogout();
      } catch {
        // no-op
      }
    }
  } finally {
    isLoggingOut = false;
  }
};

export const getLoggingOut = () => isLoggingOut;
