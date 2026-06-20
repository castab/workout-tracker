"use client";

import type { OfflineWorkoutOperation, WorkoutSnapshot } from "@/lib/workout-sync-types";

const databaseName = "workout-tracker-offline";
const databaseVersion = 1;
const snapshotStore = "snapshots";
const operationStore = "operations";

type StoredOperation = OfflineWorkoutOperation & { workoutId: string };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(snapshotStore)) {
        database.createObjectStore(snapshotStore, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(operationStore)) {
        const store = database.createObjectStore(operationStore, { keyPath: "id" });
        store.createIndex("workoutId", "workoutId");
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
) {
  const database = await openDatabase();

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = callback(store);

    transaction.oncomplete = () => {
      database.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function saveWorkoutSnapshot(snapshot: WorkoutSnapshot) {
  await withStore(snapshotStore, "readwrite", (store) => store.put(snapshot));
}

export async function getCachedWorkoutSnapshot(workoutId: string) {
  return withStore<WorkoutSnapshot>(snapshotStore, "readonly", (store) => store.get(workoutId));
}

export async function addPendingOperation(workoutId: string, operation: OfflineWorkoutOperation) {
  await withStore(operationStore, "readwrite", (store) => store.put({ ...operation, workoutId }));
}

export async function getPendingOperations(workoutId: string) {
  const database = await openDatabase();

  return new Promise<OfflineWorkoutOperation[]>((resolve, reject) => {
    const transaction = database.transaction(operationStore, "readonly");
    const store = transaction.objectStore(operationStore);
    const index = store.index("workoutId");
    const request = index.getAll(workoutId);

    request.onsuccess = () => {
      const operations = (request.result as StoredOperation[])
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((storedOperation) => {
          const operation = { ...storedOperation } as Partial<StoredOperation>;

          delete operation.workoutId;

          return operation as OfflineWorkoutOperation;
        });

      resolve(operations);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function clearPendingOperations(workoutId: string) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(operationStore, "readwrite");
    const store = transaction.objectStore(operationStore);
    const index = store.index("workoutId");
    const request = index.openCursor(workoutId);

    request.onsuccess = () => {
      const cursor = request.result;

      if (!cursor) {
        return;
      }

      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
}
