import { Alert, Linking, Platform } from 'react-native';

/**
 * Central, user-friendly runtime permission gate.
 *
 * Every feature that needs a device capability should call `ensurePermission`
 * BEFORE touching the API. It:
 *   1. checks the current status,
 *   2. shows the OS prompt if it can still be asked,
 *   3. if the user has permanently denied it, explains what the feature needs
 *      and offers to open the system Settings page — instead of the feature
 *      silently failing or crashing.
 *
 * Returns `true` only when the permission is granted.
 */

const COPY = {
  photos: {
    title: 'Photo access needed',
    message:
      'VaultKe needs access to your photos to set a profile picture and share images in chat.',
  },
  camera: {
    title: 'Camera access needed',
    message:
      'VaultKe needs the camera for video meetings and to take photos for your profile and chat.',
  },
  microphone: {
    title: 'Microphone access needed',
    message: 'VaultKe needs the microphone for audio and video meetings.',
  },
  location: {
    title: 'Location access needed',
    message:
      'VaultKe uses your location to tag and find nearby physical chama meetings.',
  },
  notifications: {
    title: 'Notifications are turned off',
    message:
      'Turn on notifications so VaultKe can alert you about loan approvals, guarantor requests, contributions and meetings.',
  },
};

function openSettingsPrompt(kind) {
  const c = COPY[kind] || { title: 'Permission needed', message: 'This feature needs a permission that is turned off.' };
  return new Promise((resolve) => {
    Alert.alert(
      c.title,
      `${c.message}\n\nYou can turn it on in Settings.`,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Open Settings',
          onPress: async () => {
            try {
              await Linking.openSettings();
            } catch {}
            resolve(false);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

async function getModules(kind) {
  switch (kind) {
    case 'photos':
    case 'cameraImage': // expo-image-picker camera
      return await import('expo-image-picker');
    case 'location':
      return await import('expo-location');
    case 'notifications':
      return await import('expo-notifications');
    default:
      return null;
  }
}

/**
 * @param {'photos'|'camera'|'microphone'|'location'|'notifications'} kind
 * @param {{ silent?: boolean }} [opts] silent = don't show the settings prompt on hard-denial
 * @returns {Promise<boolean>}
 */
export async function ensurePermission(kind, opts = {}) {
  const { silent = false } = opts;

  try {
    // Camera + microphone for WebRTC meetings go through the OS layer directly.
    if ((kind === 'camera' || kind === 'microphone') && Platform.OS === 'android') {
      const { PermissionsAndroid } = require('react-native');
      const perm =
        kind === 'camera'
          ? PermissionsAndroid.PERMISSIONS.CAMERA
          : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      if (await PermissionsAndroid.check(perm)) return true;
      const result = await PermissionsAndroid.request(perm);
      if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN && !silent) {
        await openSettingsPrompt(kind);
      }
      return false;
    }

    if (kind === 'camera' || kind === 'microphone') {
      // iOS / web: go through expo-camera's permission surface.
      const Camera = await import('expo-camera');
      const getFn =
        kind === 'microphone'
          ? Camera.getMicrophonePermissionsAsync
          : Camera.getCameraPermissionsAsync;
      const reqFn =
        kind === 'microphone'
          ? Camera.requestMicrophonePermissionsAsync
          : Camera.requestCameraPermissionsAsync;
      if (typeof getFn !== 'function' || typeof reqFn !== 'function') return true; // can't gate — let the caller try

      const cur = await getFn();
      if (cur.granted) return true;
      if (cur.canAskAgain) {
        const asked = await reqFn();
        if (asked.granted) return true;
      }
      if (!silent) await openSettingsPrompt(kind);
      return false;
    }

    const mod = await getModules(kind);
    if (!mod) return false;

    if (kind === 'photos' || kind === 'cameraImage') {
      const isCamera = kind === 'cameraImage';
      const cur = isCamera
        ? await mod.getCameraPermissionsAsync()
        : await mod.getMediaLibraryPermissionsAsync();
      if (cur.granted) return true;
      if (cur.canAskAgain) {
        const asked = isCamera
          ? await mod.requestCameraPermissionsAsync()
          : await mod.requestMediaLibraryPermissionsAsync();
        if (asked.granted) return true;
        if (asked.canAskAgain === false && !silent) {
          await openSettingsPrompt(isCamera ? 'camera' : 'photos');
        }
        return false;
      }
      if (!silent) await openSettingsPrompt(isCamera ? 'camera' : 'photos');
      return false;
    }

    if (kind === 'location') {
      const cur = await mod.getForegroundPermissionsAsync();
      if (cur.granted) return true;
      if (cur.canAskAgain) {
        const asked = await mod.requestForegroundPermissionsAsync();
        if (asked.granted) return true;
      }
      if (!silent) await openSettingsPrompt('location');
      return false;
    }

    if (kind === 'notifications') {
      const cur = await mod.getPermissionsAsync();
      if (cur.granted || cur.ios?.status === 3 /* provisional */) return true;
      if (cur.canAskAgain) {
        const asked = await mod.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        if (asked.granted) return true;
      }
      if (!silent) await openSettingsPrompt('notifications');
      return false;
    }

    return false;
  } catch (error) {
    console.warn(`ensurePermission(${kind}) failed:`, error?.message || error);
    return false;
  }
}

export default ensurePermission;
