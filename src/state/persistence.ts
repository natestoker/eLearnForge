import type { Project } from '../schema/types';

// Persistence design note (open question #3 from the brief):
// IndexedDB autosave for "it just remembers", plus JSON export/import as the
// portable escape hatch. Single 'current' record for v1; multi-project shelf
// is a v2 door.

const DB_NAME = 'elearnforge';
const STORE = 'projects';
const CURRENT_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(project, CURRENT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadProject(): Promise<Project | null> {
  const db = await openDb();
  const result = await new Promise<Project | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(CURRENT_KEY);
    req.onsuccess = () => resolve((req.result as Project) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

let currentFileHandle: any | null = null;

// Desktop-style Save: the file handle persists in IndexedDB (handles are
// structured-cloneable), so after a reload Save still overwrites the same
// file instead of prompting again. The browser re-asks write permission on
// the first Save of a session - that request happens inside the Save click,
// which satisfies the user-gesture requirement.
const HANDLE_KEY = 'fileHandle';

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  const result = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

function rememberHandle(handle: unknown | null): void {
  currentFileHandle = handle;
  idbPut(HANDLE_KEY, handle).catch(() => { /* remembering is best-effort */ });
}

// Called once at app start: restore the last session's file handle so the
// first Save overwrites the same project file.
export async function restoreFileHandle(): Promise<void> {
  try {
    const h = await idbGet<unknown>(HANDLE_KEY);
    if (h && typeof (h as { createWritable?: unknown }).createWritable === 'function') {
      currentFileHandle = h;
    }
  } catch { /* no stored handle */ }
}

export function resetFileHandle(): void {
  rememberHandle(null);
}

export async function importProjectJsonWithPicker(): Promise<Project | null> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'eLearnForge Project',
          accept: { 'application/json': ['.json', '.elearnforge.json'] }
        }],
        multiple: false
      });
      rememberHandle(handle);
      const file = await handle.getFile();
      return importProjectJson(file);
    } catch (e: any) {
      if (e && e.name === 'AbortError') {
        throw e; // Rethrow so the caller knows it was cancelled
      }
      console.warn('File System Access API failed, falling back to classic file input:', e);
    }
  }
  return null;
}

// Save As: always prompt for a (new) file, then keep writing there. Plain
// Save (exportProjectJson) overwrites the current file silently once a
// handle exists - from a Save As or from loading via the file picker.
export async function exportProjectJsonAs(project: Project): Promise<void> {
  const prev = currentFileHandle;
  currentFileHandle = null;
  await exportProjectJson(project);
  // Cancelled the picker: keep saving to the previous file.
  if (!currentFileHandle) currentFileHandle = prev;
}

// True when Save will overwrite a known file rather than prompting.
export function hasFileHandle(): boolean {
  return currentFileHandle !== null;
}

export async function exportProjectJson(project: Project): Promise<void> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      if (currentFileHandle) {
        const opts = { mode: 'readwrite' };
        if ((await currentFileHandle.queryPermission(opts)) !== 'granted') {
          if ((await currentFileHandle.requestPermission(opts)) !== 'granted') {
            currentFileHandle = null;
          }
        }
      }
      
      if (!currentFileHandle) {
        rememberHandle(await (window as any).showSaveFilePicker({
          suggestedName: `${project.title.replace(/[^\w\- ]+/g, '').trim() || 'project'}.elearnforge.json`,
          types: [{
            description: 'eLearnForge Project',
            accept: { 'application/json': ['.json', '.elearnforge.json'] }
          }]
        }));
      }
      
      const writable = await currentFileHandle.createWritable();
      await writable.write(JSON.stringify(project, null, 2));
      await writable.close();
      return;
    } catch (e: any) {
      if (e && e.name === 'AbortError') {
        return; // User cancelled
      }
      console.warn('File System Access API failed, falling back to download:', e);
      currentFileHandle = null;
    }
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    alert(
      "Note: Direct file saving (overwriting) is disabled by your browser when running from a local file URL (file:///).\n\n" +
      "To enable direct saving back to your project file, please use http://localhost:5173/ in your browser."
    );
  }

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.title.replace(/[^\w\- ]+/g, '').trim() || 'project'}.elearnforge.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectJson(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result)) as Project;
        if (!p || !Array.isArray(p.slides) || p.slides.length === 0) {
          throw new Error('Not a valid eLearnForge project file.');
        }
        if (!Array.isArray(p.variables)) p.variables = [];
        resolve(p);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
