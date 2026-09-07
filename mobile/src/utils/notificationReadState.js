import AsyncStorage from '@react-native-async-storage/async-storage';

// Device-local record of which notifications the user has read / deleted.
// Notification IDs are globally unique and never reused, so this can only ever
// suppress a stale "unread" — never hide a genuinely new notification. Shared by
// the notifications screen and the header bell so their counts always agree.

export const READ_KEY = (uid) => `notif_read_ids_${uid || 'anon'}`;
export const DEL_KEY = (uid) => `notif_deleted_ids_${uid || 'anon'}`;
export const MAX_STORED_IDS = 800;

export const loadIdSet = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

export const saveIdSet = async (key, set) => {
  try {
    const arr = Array.from(set).slice(-MAX_STORED_IDS);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch {}
};

// Guarantor / referee requests are actionable items, not "messages" — they clear
// by accepting/declining, not by reading. They must not keep the bell badge
// above zero after the user has read everything else.
const BELL_EXCLUDED_TYPES = new Set(['guarantor_request', 'referee_request']);
const isBackerRequest = (n) =>
  BELL_EXCLUDED_TYPES.has(n?.type) ||
  String(n?.id ?? '').startsWith('guarantor_req_') ||
  String(n?.id ?? '').startsWith('referee_req_');

// True unread = server says unread AND the user hasn't locally read or deleted it.
export const isEffectivelyUnread = (n, readSet, deletedSet) => {
  const id = String(n?.id ?? '');
  if (!id) return false;
  if (isBackerRequest(n)) return false;
  if (deletedSet && deletedSet.has(id)) return false;
  if (readSet && readSet.has(id)) return false;
  return !(n?.isRead === true || n?.is_read === true);
};

export const countUnread = (list, readSet, deletedSet) =>
  (Array.isArray(list) ? list : []).filter((n) => isEffectivelyUnread(n, readSet, deletedSet)).length;
