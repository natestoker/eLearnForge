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

export function exportProjectJson(project: Project): void {
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
