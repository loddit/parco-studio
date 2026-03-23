import type { Dataset, DatasetFeatureCollection, LngLat } from "@/types/dataset";
import { createEmptyFeatureCollection } from "@/types/dataset";

const DB_NAME = "parco-studio";
const DB_VERSION = 2;
const STORE_NAME = "datasets";

function normalizeFeatureCollection(value: unknown): DatasetFeatureCollection {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features)
  ) {
    return value as DatasetFeatureCollection;
  }

  return createEmptyFeatureCollection();
}

function hydrateDataset(dataset: Dataset | (Omit<Dataset, "features"> & { features?: unknown })) {
  return {
    ...dataset,
    features: normalizeFeatureCollection(dataset.features),
  } satisfies Dataset;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      } else if (request.transaction && event.oldVersion < 2) {
        const store = request.transaction.objectStore(STORE_NAME);
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;

          if (!cursor) {
            return;
          }

          const nextValue = hydrateDataset(cursor.value as Dataset);
          cursor.update(nextValue);
          cursor.continue();
        };
      }
    };

    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => database.close();

        executor(store, resolve, reject);
      }),
  );
}

export async function listDatasets() {
  const datasets = await runTransaction<Dataset[]>("readonly", (store, resolve, reject) => {
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve((request.result as Dataset[]).map((dataset) => hydrateDataset(dataset)));
  });

  return datasets.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function getDataset(id: string) {
  return runTransaction<Dataset | undefined>("readonly", (store, resolve, reject) => {
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve(
        request.result
          ? hydrateDataset(request.result as Dataset)
          : undefined,
      );
  });
}

export function createDataset(name: string) {
  const now = new Date().toISOString();
  const dataset: Dataset = {
    id: crypto.randomUUID(),
    name: name.trim(),
    center: null,
    zoomLevel: null,
    features: createEmptyFeatureCollection(),
    createdAt: now,
    updatedAt: now,
  };

  return runTransaction<Dataset>("readwrite", (store, resolve, reject) => {
    const request = store.add(dataset);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(dataset);
  });
}

export async function updateDataset(
  id: string,
  updates: Partial<Pick<Dataset, "name" | "center" | "zoomLevel" | "features">>,
) {
  const existing = await getDataset(id);

  if (!existing) {
    throw new Error("Dataset not found");
  }

  const nextDataset: Dataset = {
    ...existing,
    ...updates,
    name: updates.name?.trim() || existing.name,
    updatedAt: new Date().toISOString(),
  };

  return runTransaction<Dataset>("readwrite", (store, resolve, reject) => {
    const request = store.put(nextDataset);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(nextDataset);
  });
}

export function deleteDataset(id: string) {
  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function saveViewport(id: string, center: LngLat, zoomLevel: number) {
  return updateDataset(id, {
    center,
    zoomLevel,
  });
}

export function saveDatasetState(
  id: string,
  center: LngLat,
  zoomLevel: number,
  features: DatasetFeatureCollection,
) {
  return updateDataset(id, {
    center,
    zoomLevel,
    features,
  });
}
