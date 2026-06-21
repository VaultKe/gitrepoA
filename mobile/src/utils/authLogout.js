let appLogout = null;

export const setAppLogout = (fn) => {
  appLogout = typeof fn === 'function' ? fn : null;
};

export const triggerAppLogout = async () => {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    const authKeys = ['authToken', 'token', 'user', 'userRole', 'userData'];
    await AsyncStorage.multiRemove(authKeys);
  } catch {
    // no-op
  }
  if (appLogout) {
    try {
      appLogout();
    } catch {
      // no-op
    }
  }
};
