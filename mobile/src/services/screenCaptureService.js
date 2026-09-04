import { NativeModules, Platform } from 'react-native';

/**
 * Android MediaProjection foreground service control.
 *
 * Since Android 14 the platform will not create the screen-capture virtual
 * display unless a foreground service of type `mediaProjection` is already
 * running. react-native-webrtc starts the capturer right after the user accepts
 * the system prompt and swallows the SecurityException, so without this service
 * `getDisplayMedia()` resolves with a track that never emits a frame — remote
 * participants just see a black tile.
 *
 * No-ops on iOS and web, where nothing extra is required.
 */
const nativeModule = Platform.OS === 'android' ? NativeModules.ScreenCaptureService : null;

export const isScreenCaptureServiceAvailable = () => !!nativeModule;

export const startScreenCaptureService = async () => {
  if (!nativeModule) return false;
  try {
    await nativeModule.start();
    return true;
  } catch (error) {
    console.warn('[ScreenShare] Failed to start the capture foreground service:', error?.message || error);
    return false;
  }
};

export const stopScreenCaptureService = async () => {
  if (!nativeModule) return false;
  try {
    await nativeModule.stop();
    return true;
  } catch (error) {
    console.warn('[ScreenShare] Failed to stop the capture foreground service:', error?.message || error);
    return false;
  }
};
