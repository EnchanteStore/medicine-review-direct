import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createChunkedStorage, type KeyValueStore } from './chunked-storage';
import { logSafe } from './log';

function webStore(): KeyValueStore {
  return {
    async getItem(key) {
      if (typeof sessionStorage === 'undefined') return null;
      return sessionStorage.getItem(key);
    },
    async setItem(key, value) {
      sessionStorage.setItem(key, value);
    },
    async removeItem(key) {
      sessionStorage.removeItem(key);
    },
  };
}

function nativeStore(): KeyValueStore {
  return {
    async getItem(key) {
      return SecureStore.getItemAsync(key);
    },
    async setItem(key, value) {
      await SecureStore.setItemAsync(key, value);
    },
    async removeItem(key) {
      await SecureStore.deleteItemAsync(key);
    },
  };
}

/**
 * Native: expo-secure-store, chunked because a session is larger than one item.
 * Web preview: sessionStorage for this tab only, not localStorage.
 * Reports and messages are never written here.
 */
export function sessionStorageAdapter(): KeyValueStore {
  const backend = Platform.OS === 'web' ? webStore() : nativeStore();
  const chunked = createChunkedStorage(backend);
  return {
    async getItem(key) {
      try {
        return await chunked.getItem(key);
      } catch {
        logSafe('session.read_failed');
        return null;
      }
    },
    async setItem(key, value) {
      try {
        await chunked.setItem(key, value);
      } catch {
        logSafe('session.write_failed');
      }
    },
    async removeItem(key) {
      try {
        await chunked.removeItem(key);
      } catch {
        logSafe('session.clear_failed');
      }
    },
  };
}
