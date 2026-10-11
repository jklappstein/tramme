// The desktop storage against the reference suite: the same contract the R2
// bucket and the IndexedDB bucket pass, run on the folders the app writes to
// (through the little HTTP mirror of the Rust store).

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { accessSync, constants, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe } from 'vitest';
import { storageContract } from '../../../packages/api/test/contract.ts';
import { httpBucket } from './http-bucket.ts';

// where the storage example would be built from
const TAURI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri');
// the editor's build, which tauri.conf.json's frontendDist names: the crate does not compile
// without the folder, and the storage server does not need what is in it
const EDITOR_DIST = path.join(TAURI, '..', '..', 'editor', 'dist');
const EXE = path.join(TAURI, 'target', 'debug', 'examples', process.platform === 'win32' ? 'tramme-storage-server.exe' : 'tramme-storage-server');

// is cargo on the PATH, or in the default ~/.cargo/bin install?
const findCargo = (): string | undefined => {
  const exe = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const p = path.join(dir, exe);
    try {
      accessSync(p, constants.X_OK);
      return p;
    } catch { /* keep looking */ }
  }
  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (home) {
    const p = path.join(home, '.cargo', 'bin', exe);
    try {
      accessSync(p, constants.X_OK);
      return p;
    } catch { /* no local install */ }
  }
  return undefined;
};

// contributors without Rust skip these; CI sets the variable so it never
// skips there without saying so
const REQUIRE_DESKTOP = process.env.TRAMME_REQUIRE_DESKTOP_TESTS === '1';
const hasCargo = findCargo() !== undefined;
if (!hasCargo && !REQUIRE_DESKTOP) {
  console.warn('cargo not found: skipping the desktop storage tests. Install Rust (https://rustup.rs) to run them.');
}

let server: ChildProcess | undefined;
let base = '';
let home = '';

describe.skipIf(!hasCargo && !REQUIRE_DESKTOP)('desktop storage', () => {
  beforeAll(async () => {
    if (!hasCargo) throw new Error('cargo is required (TRAMME_REQUIRE_DESKTOP_TESTS=1) but not on the PATH');
    const cargo = (...args: string[]) => {
      try {
        return execFileSync('cargo', args, { cwd: TAURI, stdio: 'pipe' });
      } catch (e) {
        if ((e as { code?: string }).code !== 'ENOENT') throw e;
        const fallback = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin', 'cargo');
        return execFileSync(fallback, args, { cwd: TAURI, stdio: 'pipe' });
      }
    };
    mkdirSync(EDITOR_DIST, { recursive: true });
    cargo('build', '--example', 'tramme-storage-server');

    home = mkdtempSync(path.join(tmpdir(), 'tramme-contract-'));
    // its own home, never the machine's Documents (which a CI runner may not have)
    server = spawn(EXE, { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, TRAMME_HOME: home } });
    const port = await new Promise<number>((ok, err) => {
      let out = '';
      server!.stdout!.on('data', (c: Buffer) => {
        out += c.toString();
        const m = /PORT=(\d+)/.exec(out);
        if (m) ok(Number(m[1]));
      });
      server!.on('exit', (code) => err(new Error(`the storage server exited (${code})`)));
      setTimeout(() => err(new Error('the storage server printed no port')), 20000);
    });
    base = `http://127.0.0.1:${port}`;
    await fetch(`${base}/health`, { method: 'POST' });
  }, 300000);

  afterAll(() => {
    server?.kill();
    if (home) rmSync(home, { recursive: true, force: true });
  });

  // each bucket its own fresh root, as each visitor's browser has its own
  let n = 0;
  storageContract('folders (desktop)', () => httpBucket(base, path.join(home, `bucket-${++n}`)));
});
