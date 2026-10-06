/**
 * Where Workspace docs and boards live (Polaris, V 5.0.0): this device's
 * IndexedDB, like the custom background. Nothing is uploaded. Item records
 * (title, kind, times) and their content are separate stores, so listing the
 * Workspace never reads a large board. A save writes both in one transaction.
 *
 * Content shapes: a doc is Tiptap JSON; a board is the scene as Excalidraw's
 * own `.excalidraw` JSON text, so an export is that string as-is.
 */
import type { JSONContent } from "@tiptap/core";
import { useEffect, useState } from "react";

import { randomUUID } from "~/lib/utils";

import {
  isWorkspaceItem,
  newWorkspaceItem,
  normalizeTitle,
  sortWorkspaceItems,
  type WorkspaceItem,
  type WorkspaceKind,
} from "./workspaceModel";

const DB_NAME = "polaris-workspace";
const DB_VERSION = 1;
const ITEMS = "items";
const CONTENT = "content";
const CHANGE_EVENT = "polaris:workspace-changed";

type DocContent = { readonly kind: "doc"; readonly doc: JSONContent };
type BoardContent = { readonly kind: "board"; readonly scene: string };

let connection: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available here."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CONTENT)) db.createObjectStore(CONTENT);
    });
    request.addEventListener("success", () => {
      const db = request.result;
      // Another tab upgrading the schema: step aside and reopen next time.
      db.addEventListener("versionchange", () => {
        db.close();
        connection = null;
      });
      resolve(db);
    });
    request.addEventListener("error", () => {
      connection = null;
      reject(request.error ?? new Error("Could not open the Workspace storage."));
    });
  });
  return connection;
}

/** Runs `work` in one transaction and resolves with its result once it commits. */
async function transact<T>(
  mode: IDBTransactionMode,
  work: (stores: { items: IDBObjectStore; content: IDBObjectStore }) => () => T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction([ITEMS, CONTENT], mode);
    const result = work({
      items: transaction.objectStore(ITEMS),
      content: transaction.objectStore(CONTENT),
    });
    transaction.addEventListener("complete", () => resolve(result()));
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error("Workspace storage failed.")),
    );
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("Workspace storage was aborted.")),
    );
  });
}

const announce = () => window.dispatchEvent(new Event(CHANGE_EVENT));

export function subscribeWorkspaceChanges(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export async function listWorkspaceItems(): Promise<WorkspaceItem[]> {
  const records = await transact("readonly", ({ items }) => {
    const request = items.getAll();
    return () => request.result as unknown[];
  });
  return sortWorkspaceItems(records.filter(isWorkspaceItem));
}

export async function getWorkspaceItem(id: string): Promise<WorkspaceItem | null> {
  const record = await transact("readonly", ({ items }) => {
    const request = items.get(id);
    return () => request.result as unknown;
  });
  return isWorkspaceItem(record) ? record : null;
}

export async function createWorkspaceItem(kind: WorkspaceKind): Promise<WorkspaceItem> {
  const item = newWorkspaceItem(kind, randomUUID(), new Date());
  await transact("readwrite", ({ items }) => {
    items.add(item);
    return () => undefined;
  });
  announce();
  return item;
}

/**
 * Writes an item's record (and content, when given) with a fresh `updatedAt`.
 * Resolves with the stored record, or null when the item was deleted meanwhile
 * (a late autosave after Delete must not bring it back).
 */
async function writeItem(
  id: string,
  change: (item: WorkspaceItem) => WorkspaceItem,
  content?: DocContent | BoardContent,
): Promise<WorkspaceItem | null> {
  const written = await transact("readwrite", ({ items, content: contents }) => {
    let next: WorkspaceItem | null = null;
    const request = items.get(id);
    request.addEventListener("success", () => {
      const current: unknown = request.result;
      if (!isWorkspaceItem(current)) return;
      next = { ...change(current), updatedAt: new Date().toISOString() };
      items.put(next);
      if (content) contents.put(content, id);
    });
    return (): WorkspaceItem | null => next;
  });
  if (written) announce();
  return written;
}

export const renameWorkspaceItem = (id: string, title: string) =>
  writeItem(id, (item) => ({ ...item, title: normalizeTitle(title) }));

export const saveDoc = (id: string, doc: JSONContent) =>
  writeItem(id, (item) => item, { kind: "doc", doc });

export const saveBoard = (id: string, scene: string) =>
  writeItem(id, (item) => item, { kind: "board", scene });

async function readContent(id: string): Promise<unknown> {
  return transact("readonly", ({ content }) => {
    const request = content.get(id);
    return () => request.result as unknown;
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The doc's Tiptap JSON, or null for a doc never typed into. */
export async function loadDoc(id: string): Promise<JSONContent | null> {
  const value = await readContent(id);
  return isRecord(value) && value.kind === "doc" && isRecord(value.doc)
    ? (value.doc as JSONContent)
    : null;
}

/** The board's `.excalidraw` JSON text, or null for a board never drawn on. */
export async function loadBoard(id: string): Promise<string | null> {
  const value = await readContent(id);
  return isRecord(value) && value.kind === "board" && typeof value.scene === "string"
    ? value.scene
    : null;
}

export async function deleteWorkspaceItem(id: string): Promise<void> {
  await transact("readwrite", ({ items, content }) => {
    items.delete(id);
    content.delete(id);
    return () => undefined;
  });
  announce();
}

export type WorkspaceItemsState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly items: readonly WorkspaceItem[] }
  | { readonly status: "error"; readonly message: string };

/** Every item, newest edit first, refreshed whenever the Workspace changes. */
export function useWorkspaceItems(): WorkspaceItemsState {
  const [state, setState] = useState<WorkspaceItemsState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    const load = () => {
      listWorkspaceItems().then(
        (items) => live && setState({ status: "ready", items }),
        (error: unknown) =>
          live &&
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Could not read the Workspace.",
          }),
      );
    };
    load();
    const unsubscribe = subscribeWorkspaceChanges(load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return state;
}

/** One item's record, kept current; null once it is missing or deleted. */
export function useWorkspaceItem(id: string): WorkspaceItem | null | "loading" {
  const [item, setItem] = useState<WorkspaceItem | null | "loading">("loading");
  useEffect(() => {
    let live = true;
    const load = () => {
      getWorkspaceItem(id).then(
        (record) => live && setItem(record),
        () => live && setItem(null),
      );
    };
    load();
    const unsubscribe = subscribeWorkspaceChanges(load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [id]);
  return item;
}
