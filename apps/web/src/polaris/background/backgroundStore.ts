/**
 * Where the background file lives (Polaris): one record in this device's
 * IndexedDB. Nothing is uploaded; the server never sees it. Changes are
 * announced in-page so every mounted background picks them up at once.
 */
import type { BackgroundMediaKind } from "./backgroundRules";

const DB_NAME = "polaris-background";
const STORE = "media";
const KEY = "current";
const CHANGE_EVENT = "polaris:background-changed";

export interface StoredBackground {
  readonly kind: BackgroundMediaKind;
  readonly name: string;
  readonly blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available here."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.addEventListener("upgradeneeded", () => request.result.createObjectStore(STORE));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("Could not open storage.")),
    );
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.addEventListener("complete", () => resolve(request.result));
      transaction.addEventListener("error", () =>
        reject(transaction.error ?? new Error("Storage failed.")),
      );
      transaction.addEventListener("abort", () =>
        reject(transaction.error ?? new Error("Storage was aborted.")),
      );
    });
  } finally {
    db.close();
  }
}

function isStoredBackground(value: unknown): value is StoredBackground {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.kind === "image" || record.kind === "video") &&
    typeof record.name === "string" &&
    record.blob instanceof Blob
  );
}

export async function loadBackground(): Promise<StoredBackground | null> {
  const value: unknown = await withStore("readonly", (store) => store.get(KEY));
  return isStoredBackground(value) ? value : null;
}

export async function saveBackground(background: StoredBackground): Promise<void> {
  await withStore("readwrite", (store) => store.put(background, KEY));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function clearBackground(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(KEY));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeBackgroundChanges(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

/**
 * The lowest Dim (percent) that keeps text readable over the current
 * background and theme, published by AppBackground for the settings row.
 */
let contrastFloor = 0;
const floorListeners = new Set<() => void>();

export function publishContrastFloor(percent: number): void {
  if (percent === contrastFloor) return;
  contrastFloor = percent;
  for (const listener of floorListeners) listener();
}

export function subscribeContrastFloor(listener: () => void): () => void {
  floorListeners.add(listener);
  return () => floorListeners.delete(listener);
}

export const readContrastFloor = (): number => contrastFloor;
