export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Splits a value so it fits in expo-secure-store (about 2KB per item).
 * Used only for the auth session, never for reports or messages.
 */
export function createChunkedStorage(store: KeyValueStore, chunkSize = 1800): KeyValueStore {
  const countKey = (key: string) => `${key}.__chunks`;
  const partKey = (key: string, index: number) => `${key}.__${index}`;

  return {
    async getItem(key) {
      const rawCount = await store.getItem(countKey(key));
      const count = Number(rawCount ?? '0');
      if (!Number.isInteger(count) || count < 1) return store.getItem(key);
      let value = '';
      for (let index = 0; index < count; index += 1) {
        const part = await store.getItem(partKey(key, index));
        if (part == null) return null;
        value += part;
      }
      return value;
    },
    async setItem(key, value) {
      const parts: string[] = [];
      for (let index = 0; index < value.length; index += chunkSize) {
        parts.push(value.slice(index, index + chunkSize));
      }
      if (parts.length === 0) parts.push('');
      const previous = Number((await store.getItem(countKey(key))) ?? '0');
      await store.setItem(countKey(key), String(parts.length));
      for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index];
        if (part !== undefined) await store.setItem(partKey(key, index), part);
      }
      for (let index = parts.length; index < previous; index += 1) {
        await store.removeItem(partKey(key, index));
      }
      await store.removeItem(key);
    },
    async removeItem(key) {
      const count = Number((await store.getItem(countKey(key))) ?? '0');
      for (let index = 0; index < count; index += 1) await store.removeItem(partKey(key, index));
      await store.removeItem(countKey(key));
      await store.removeItem(key);
    },
  };
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}
