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

export function resetFileHandle(): void {
  currentFileHandle = null;
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
      currentFileHandle = handle;
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
  currentFileHandle = null;
  return exportProjectJson(project);
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
        currentFileHandle = await (window as any).showSaveFilePicker({
          suggestedName: `${project.title.replace(/[^\w\- ]+/g, '').trim() || 'project'}.elearnforge.json`,
          types: [{
            description: 'eLearnForge Project',
            accept: { 'application/json': ['.json', '.elearnforge.json'] }
          }]
        });
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
