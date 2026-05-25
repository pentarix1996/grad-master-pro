import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'gradmaster_pro';
const DB_VERSION = 1;
const STORE_NAME = 'key_value';

interface StoredRecord<T> {
  key: string;
  value: T;
  updatedAt: string;
}

const openDatabase = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const readValue = async <T,>(key: string) => {
  const db = await openDatabase();

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as StoredRecord<T> | undefined;
      resolve(record?.value);
      db.close();
    };

    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
};

const writeValue = async <T,>(key: string, value: T) => {
  const db = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, value, updatedAt: new Date().toISOString() });

    request.onsuccess = () => {
      resolve();
      db.close();
    };

    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
};

const readLegacyLocalStorage = <T,>(key: string) => {
  const legacyItem = window.localStorage.getItem(key);
  if (!legacyItem) return undefined;

  return JSON.parse(legacyItem) as T;
};

export function useIndexedDbStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadValue = async () => {
      try {
        const indexedValue = await readValue<T>(key);

        if (indexedValue !== undefined) {
          if (!isCancelled) setStoredValue(indexedValue);
          return;
        }

        const legacyValue = readLegacyLocalStorage<T>(key);
        if (legacyValue !== undefined) {
          await writeValue(key, legacyValue);
          if (!isCancelled) setStoredValue(legacyValue);
        }
      } catch (error) {
        console.error('IndexedDB storage error:', error);

        try {
          const legacyValue = readLegacyLocalStorage<T>(key);
          if (legacyValue !== undefined && !isCancelled) setStoredValue(legacyValue);
        } catch (legacyError) {
          console.error('Legacy localStorage fallback error:', legacyError);
        }
      } finally {
        if (!isCancelled) setIsLoaded(true);
      }
    };

    loadValue();

    return () => {
      isCancelled = true;
    };
  }, [key]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue(previousValue => {
      const valueToStore = value instanceof Function ? value(previousValue) : value;
      writeValue(key, valueToStore).catch(error => console.error('IndexedDB write error:', error));
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue, isLoaded];
}
