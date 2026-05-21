import { StoredFile } from './types';

const DB_NAME = 'GestorArchivosDB2026';
const STORE_NAME = 'archivos';
const DB_VERSION = 1;

/**
 * Opens and initializes the IndexedDB database.
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('No se pudo abrir la base de datos de IndexedDB'));
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves a file to the database.
 */
export async function saveFileToDB(file: StoredFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Error al guardar el archivo: ${file.name}`));
    };
  });
}

/**
 * Retrieves all files from the database.
 */
export async function getAllFilesFromDB(): Promise<StoredFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by creation date descending by default
      const files = request.result as StoredFile[];
      files.sort((a, b) => b.createdAt - a.createdAt);
      resolve(files);
    };

    request.onerror = () => {
      reject(new Error('Error al obtener los archivos de la base de datos'));
    };
  });
}

/**
 * Deletes a file from the database.
 */
export async function deleteFileFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('Error al eliminar el archivo de la base de datos'));
    };
  });
}

/**
 * Updates metadata of a file.
 */
export async function updateFileFieldsInDB(
  id: string,
  updates: Partial<Pick<StoredFile, 'name' | 'description' | 'tags'>>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const file = getRequest.result as StoredFile | undefined;
      if (!file) {
        reject(new Error('Archivo no encontrado para actualizar'));
        return;
      }

      const updatedFile: StoredFile = {
        ...file,
        ...updates,
      };

      const putRequest = store.put(updatedFile);
      putRequest.onsuccess = () => {
        resolve();
      };
      putRequest.onerror = () => {
        reject(new Error('No se pudieron actualizar los datos del archivo'));
      };
    };

    getRequest.onerror = () => {
      reject(new Error('Error al consultar el archivo para actualización'));
    };
  });
}
