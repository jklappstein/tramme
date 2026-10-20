// The plugins installed on this device (docs/installed-plugins-roadmap.md,
// steps 1 and 2): kept where the platform allows, in the order of the
// roadmap's table. The desktop app keeps them in its folder; a browser with
// the File System Access API, in a real folder the user picked once; the
// personal mode, in the browser's own storage (made persistent); the private
// deployment, in the server's bucket. All but the picked folder answer the
// library's address (/api/library), so the existing library is this store.
// A plugin's own files (a .trammeplugin's fonts, LUTs, translations) are kept
// beside it in a companion module `<name>--files.js`.

import { signal } from '@preact/signals';
import { recordBucket } from '@tramme/api';
import { compareVersions, manifestOf, packInstalled, permissionsAdded, readPluginPackage, unpackInstalled, type PluginManifest } from '@tramme/project';
import { api } from './api.ts';
import { folderRecords, type DirHandle } from './local/folder.ts';
import { personal } from './mode.ts';
import { prefs, setPrefs } from './settings.ts';
import { tauri } from './tauri.ts';

export type StorageKind = 'desktop' | 'folder' | 'browser' | 'server';

export interface Installed {
  /** its file in the storage: charts.js */
  file: string;
  manifest: PluginManifest;
  size: number;
  modified: string;
  /** its text: what the sandbox loads */
  code: string;
  /** its own files (from its package), by path */
  files: Map<string, Uint8Array>;
  enabled: boolean;
}

/** a name the storages take: lower case, digits, - and _, then .js */
export const FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,62}\.(js|mjs)$/;
const COMPANION = /--files\.js$/;
const companionOf = (file: string) => file.replace(/\.(js|mjs)$/, '--files.js');

export const installed = signal<Installed[]>([]);
export const storageKind = signal<StorageKind>(tauri ? 'desktop' : personal ? 'browser' : 'server');
/** the persistence of the browser's storage: granted, refused, or not asked (another storage) */
export const persistence = signal<'granted' | 'refused' | 'n/a'>('n/a');
/** the picked folder's name, when the plugins are in one */
export const folderName = signal<string | null>(null);

// ── the picked folder's handle, kept between visits ──
const HANDLES = 'tramme-handles';
const idb = <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  const open = indexedDB.open(HANDLES, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('handles');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => { const r = run(open.result.transaction('handles', mode).objectStore('handles')); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); };
});
type FolderHandle = DirHandle & { name: string; queryPermission?(o: { mode: string }): Promise<string>; requestPermission?(o: { mode: string }): Promise<string> };
let folder: FolderHandle | null = null;

/** the browsers that can keep the plugins in a real folder (Chrome and Edge on a computer) */
export const canPickFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window && !tauri;

/** the folder the user picks for their plugins (asked once; the handle is kept) */
export async function pickFolder(): Promise<void> {
  const h = await (window as unknown as { showDirectoryPicker(o: { mode: string; id?: string }): Promise<FolderHandle> }).showDirectoryPicker({ mode: 'readwrite', id: 'tramme-plugins' });
  await idb('readwrite', (s) => s.put(h, 'plugins'));
  folder = h;
  storageKind.value = 'folder';
  folderName.value = h.name;
  await refreshInstalled();
}

/** back to the platform's own storage (the folder is left as it is) */
export async function forgetFolder(): Promise<void> {
  await idb('readwrite', (s) => s.delete('plugins')).catch(() => {});
  folder = null;
  folderName.value = null;
  storageKind.value = tauri ? 'desktop' : personal ? 'browser' : 'server';
  await refreshInstalled();
}

/** the folder's access, asked again when the browser requires it (a click must ask: false when it needs one) */
export async function folderAccess(ask = false): Promise<boolean> {
  if (!folder) return true;
  const q = await folder.queryPermission?.({ mode: 'readwrite' }) ?? 'granted';
  if (q === 'granted') return true;
  if (!ask) return false;
  return (await folder.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

/** where the plugins are, found once: a folder picked before, else the platform's storage; persistence asked where it is the browser's */
export async function startInstalled(): Promise<void> {
  if (canPickFolder()) {
    try {
      const h = await idb<FolderHandle | undefined>('readonly', (s) => s.get('plugins') as IDBRequest<FolderHandle | undefined>);
      if (h) { folder = h; storageKind.value = 'folder'; folderName.value = h.name; }
    } catch { /* no folder kept */ }
  }
  if (storageKind.value === 'browser' && navigator.storage?.persist) {
    // Safari may clear a site's storage after weeks without a visit when it is not installed as an app
    persistence.value = (await navigator.storage.persisted().catch(() => false)) || (await navigator.storage.persist().catch(() => false)) ? 'granted' : 'refused';
  }
  await refreshInstalled().catch((e) => console.error('[installed plugins]', (e as Error).message));
}

// ── the storage's four calls ──
const folderBucket = () => recordBucket(folderRecords(folder!));
async function listFiles(): Promise<{ name: string; size: number; modified: string }[]> {
  if (storageKind.value === 'folder') {
    if (!(await folderAccess())) return [];
    const out: { name: string; size: number; modified: string }[] = [];
    let cursor: string | undefined;
    do {
      const l = await folderBucket().list({ prefix: '', cursor });
      for (const o of l.objects) if (FILE_NAME.test(o.key)) out.push({ name: o.key, size: o.size, modified: o.uploaded.toISOString() });
      cursor = l.truncated ? l.cursor : undefined;
    } while (cursor);
    return out;
  }
  try { return await api.library(); } catch { return []; }
}
async function readFile(name: string): Promise<string> {
  if (storageKind.value === 'folder') { const o = await folderBucket().get(name); if (!o || !('arrayBuffer' in o)) throw new Error(`no plugin "${name}"`); return new TextDecoder().decode(await o.arrayBuffer()); }
  return api.libraryGet(name);
}
async function writeFile(name: string, code: string): Promise<void> {
  if (storageKind.value === 'folder') { await folderBucket().put(name, code, { httpMetadata: { contentType: 'text/javascript' } }); return; }
  await api.libraryPut(name, code);
}
async function removeFile(name: string): Promise<void> {
  if (storageKind.value === 'folder') { await folderBucket().delete(name); return; }
  await api.libraryDelete(name).catch(() => {});
}

/** a plugin's own files as a module of data (so every storage, made for modules, keeps them) */
const filesModule = (files: Map<string, Uint8Array>) => `// the files of a plugin's package, kept beside it by tramme\nexport const files = ${JSON.stringify(Object.fromEntries([...files].map(([k, v]) => [k, btoa(String.fromCharCode(...v))])))};\n`;
function filesOf(code: string): Map<string, Uint8Array> {
  const m = /export const files = (\{[\s\S]*\});/.exec(code);
  if (!m) return new Map();
  const o = JSON.parse(m[1]) as Record<string, string>;
  return new Map(Object.entries(o).map(([k, b]) => [k, Uint8Array.from(atob(b), (c) => c.charCodeAt(0))]));
}

/** the installed plugins read again from their storage */
export async function refreshInstalled(): Promise<void> {
  const list = await listFiles(), off = prefs.peek().pluginsOff;
  const names = new Set(list.map((f) => f.name));
  const out: Installed[] = [];
  for (const f of list) {
    // the library's components (component-<name>.js) are not plugins
    if (COMPANION.test(f.name) || f.name.startsWith('component-')) continue;
    try {
      const code = await readFile(f.name);
      const files = names.has(companionOf(f.name)) ? filesOf(await readFile(companionOf(f.name))) : new Map();
      out.push({ file: f.name, manifest: manifestOf(code, f.name), size: f.size, modified: f.modified, code, files, enabled: !off.includes(f.name) });
    } catch { /* a file that cannot be read is left out */ }
  }
  installed.value = out.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/** what an import would install, read from its text, before any of its code runs */
export interface Candidate { file: string; code: string; files: Map<string, Uint8Array>; manifest: PluginManifest; replaces: Installed | null; added: PluginManifest['permissions'] }

/** a picked or dropped file as a candidate: a .js module or a .trammeplugin package */
export async function candidateOf(f: File): Promise<Candidate> {
  let code: string, files = new Map<string, Uint8Array>();
  if (/\.trammeplugin$/i.test(f.name)) ({ module: code, files } = readPluginPackage(new Uint8Array(await f.arrayBuffer())));
  else if (/\.m?js$/i.test(f.name)) code = await f.text();
  else throw new Error(`${f.name}: a .js module or a .trammeplugin package is expected`);
  const manifest = manifestOf(code, f.name);
  // the same plugin (its id) installed already: an update, kept under its file name
  const replaces = installed.peek().find((p) => p.manifest.id === manifest.id) ?? null;
  const file = replaces?.file ?? `${manifest.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'plugin'}.js`;
  const none = { network: [], providers: [], files: [] };
  return { file, code, files, manifest, replaces, added: permissionsAdded(replaces?.manifest.permissions ?? none, manifest.permissions) };
}

/** installs a candidate the user said yes to */
export async function install(c: Candidate): Promise<void> {
  if (!FILE_NAME.test(c.file)) throw new Error(`invalid name "${c.file}"`);
  await writeFile(c.file, c.code);
  if (c.files.size) await writeFile(companionOf(c.file), filesModule(c.files));
  else if (c.replaces?.files.size) await removeFile(companionOf(c.file));
  await refreshInstalled();
}

/** a plugin's text kept in the device's storage as it is (the library tools: a project's plugin kept, one brought into a project) */
export async function installFile(file: string, code: string): Promise<void> {
  if (!FILE_NAME.test(file)) throw new Error(`invalid name "${file}"`);
  await writeFile(file, code);
  await refreshInstalled();
}
export const installedCode = (file: string) => readFile(file);

export async function uninstall(p: Installed): Promise<void> {
  await removeFile(p.file);
  if (p.files.size) await removeFile(companionOf(p.file));
  setPrefs({ pluginsOff: prefs.peek().pluginsOff.filter((x) => x !== p.file) });
  await refreshInstalled();
}

export function setEnabled(p: Installed, on: boolean): void {
  const off = prefs.peek().pluginsOff.filter((x) => x !== p.file);
  setPrefs({ pluginsOff: on ? off : [...off, p.file] });
  installed.value = installed.peek().map((x) => (x.file === p.file ? { ...x, enabled: on } : x));
}

/** every installed plugin in one file, to keep or to bring to another device */
export function backup(): Blob {
  const files = new Map<string, Uint8Array>();
  for (const p of installed.peek()) {
    files.set(p.file, new TextEncoder().encode(p.code));
    if (p.files.size) files.set(companionOf(p.file), new TextEncoder().encode(filesModule(p.files)));
  }
  return new Blob([packInstalled(files, { version: 1, disabled: prefs.peek().pluginsOff }) as BlobPart], { type: 'application/zip' });
}

/** a backup put back: its plugins installed (an installed one of a newer version kept), its off ones turned off */
export async function restoreBackup(f: File): Promise<number> {
  const { files, state } = unpackInstalled(new Uint8Array(await f.arrayBuffer()));
  let n = 0;
  for (const [name, data] of files) {
    const code = new TextDecoder().decode(data);
    const have = installed.peek().find((p) => p.file === name);
    if (have && !COMPANION.test(name) && compareVersions(have.manifest.version, manifestOf(code, name).version) > 0) continue;
    await writeFile(name, code);
    if (!COMPANION.test(name)) n++;
  }
  setPrefs({ pluginsOff: [...new Set([...prefs.peek().pluginsOff, ...state.disabled])] });
  await refreshInstalled();
  return n;
}
