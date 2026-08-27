import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { getLocales, getCalendars } from 'expo-localization';
import * as Network from 'expo-network';

const DEVICE_ID_KEY = 'vaultke_device_id';

// Generate an RFC4122 v4 UUID without external crypto dependencies.
const generateUUID = () => {
  let rng = Math.random;
  try {
    if (typeof global !== 'undefined' && global.crypto && typeof global.crypto.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      global.crypto.getRandomValues(buf);
      rng = (() => {
        let i = 0;
        return () => buf[i++ % 16] / 256;
      })();
    }
  } catch (e) {
    // fall back to Math.random
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (rng() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Returns a stable per-device identifier, persisted in AsyncStorage so the
// same physical device is always recognised across app updates/restarts.
export const getStableDeviceId = async () => {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch (e) {
    return generateUUID();
  }
};

const mapDeviceType = (type) => {
  // On web, always report as 'web' regardless of expo-device emulation.
  // This prevents desktop-browser mobile emulation from being recorded as a real mobile device.
  if (Platform.OS === 'web') {
    return 'web';
  }
  switch (type) {
    case Device.DeviceType.PHONE:
      return 'mobile';
    case Device.DeviceType.TABLET:
      return 'tablet';
    case Device.DeviceType.TV:
    case Device.DeviceType.DESKTOP:
      return 'desktop';
    default:
      return 'mobile';
  }
};

const buildHumanReadableName = (manufacturer, brand, model, osName) => {
  const make = (manufacturer || brand || '').trim();
  const name = (model || '').trim();
  if (make && name && !name.toLowerCase().startsWith(make.toLowerCase())) {
    return `${make} ${name}`;
  }
  if (name) {
    return name;
  }
  if (make) {
    return `${make} Device`;
  }
  return osName ? `${osName} Device` : 'Unknown Device';
};

// Gathers comprehensive details about the device the app is running on.
// This is sent to the backend (via request headers) so login history and the
// registered-devices table contain accurate, per-device information.
export const getDeviceInfo = async () => {
  const fallback = {
    deviceId: await getStableDeviceId(),
    userAgent: 'VaultKe-Mobile-App/1.0',
    platform: Platform.OS || 'mobile',
    language: 'en',
    locale: 'en',
    timezone: 'UTC',
    deviceType: 'mobile',
    deviceName: 'Mobile Device - VaultKe App',
    browserName: 'VaultKe App',
    osName: 'Mobile OS',
    osVersion: '',
    manufacturer: '',
    brand: '',
    model: '',
    appVersion: '',
    screenResolution: '',
    connectionType: 'unknown',
  };

  let deviceInfo = { ...fallback };

  try {
    const isWeb = Platform.OS === 'web';
    const osName = isWeb ? 'Web' : (Device.osName || (Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Unknown'));
    const osVersion = isWeb ? '' : (Device.osVersion || '');
    const manufacturer = isWeb ? '' : (Device.manufacturer || '');
    const brand = isWeb ? '' : (Device.brand || '');
    const model = isWeb ? '' : (Device.modelName || '');
    const deviceType = mapDeviceType(Device.deviceType);

    // Safety: native apps must never report as 'web'
    if (!isWeb && deviceType === 'web') {
      // This should never happen, but if it does, force to mobile
      deviceType = 'mobile';
    }

    const deviceName = isWeb
      ? 'Web Browser'
      : (Device.deviceName || buildHumanReadableName(manufacturer, brand, model, osName));

    let appVersion = '';
    if (!isWeb) {
      try {
        appVersion = Application.nativeApplicationVersion || Application.nativeBuildVersion || '';
      } catch (e) {
        appVersion = '';
      }
    }

    let timezone = 'UTC';
    let locale = 'en';
    try {
      const calendars = getCalendars();
      if (calendars && calendars.length > 0 && calendars[0].timeZone) {
        timezone = calendars[0].timeZone;
      }
      const locales = getLocales();
      if (locales && locales.length > 0) {
        const loc = locales[0];
        locale = (loc.languageCode || loc.languageTag || 'en').split('-')[0];
      }
    } catch (e) {
      // keep defaults
    }

    let screenResolution = '';
    try {
      const { width, height } = Dimensions.get('window');
      screenResolution = `${Math.round(width)}x${Math.round(height)}`;
    } catch (e) {
      // ignore
    }

    let connectionType = 'unknown';
    try {
      const netState = await Network.getNetworkStateAsync();
      connectionType = netState?.type || 'unknown';
    } catch (e) {
      // ignore
    }

    deviceInfo = {
      deviceId: await getStableDeviceId(),
      userAgent: isWeb ? 'VaultKe-Web/1.0' : `VaultKe-Mobile-App/${appVersion || '1.0'} (${osName} ${osVersion})`,
      platform: Platform.OS || 'mobile',
      language: locale,
      locale,
      timezone,
      deviceType,
      deviceName,
      browserName: isWeb ? 'Web Browser' : 'VaultKe App',
      osName,
      osVersion,
      manufacturer,
      brand,
      model,
      appVersion,
      screenResolution,
      connectionType,
    };
  } catch (e) {
    // On unexpected errors, fall back to the safe defaults already set.
    deviceInfo.deviceId = await getStableDeviceId();
  }

  return deviceInfo;
};

export default getDeviceInfo;
