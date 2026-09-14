import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const ROOT_BINARIES = [
  '/system/app/su',
  '/system/bin/su',
  '/sbin/su',
  '/vendor/bin/su',
  '/system/bin/busybox',
  '/system/app/Superuser.apk',
  '/data/data/eu.chainfire.supersu',
  '/system/bin/.installed_su',
  '/dev/.su',
];

const isDeviceRooted = async () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  for (const path of ROOT_BINARIES) {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        return true;
      }
    } catch {
      // continue checking
    }
  }

  return false;
};

const isDeviceEmulator = () => {
  const model = Platform.model;
  const isEmulator =
    !!model &&
    (model.includes('google_sdk') ||
      model.includes('Emulator') ||
      model.includes('Android SDK') ||
      model.includes('sdk_'));
  return isEmulator;
};

export const securityCheck = async () => {
  const rooted = await isDeviceRooted();
  const emulator = isDeviceEmulator();

  if (rooted || emulator) {
    console.warn('Security check failed: device is rooted or running on an emulator');
    return false;
  }

  return true;
};

export default isDeviceRooted;
