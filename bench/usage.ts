// What the conversations of a project cost, turn by turn: the usage line each
// turn ends with (tool calls, pictures seen, tokens, time), added up.
//
//   node bench/usage.ts <project folder | project.tramme>

import fs from 'node:fs';
import path from 'node:path';
import { CHAT_INDEX, chatPath, unpackProject } from '@tramme/project';

interface Usage { requests: number; input: number; cacheRead: number; cacheWrite: number; output: number; tools: number; images: number; ms: number; model: string }

const target = process.argv[2];
if (!target || !fs.existsSync(target)) { console.log('usage: node bench/usage.ts <project folder | project.tramme>'); process.exit(1); }

/** the project's text files by path, from a folder or an archive */
async function files(): Promise<(p: string) => string | null> {
  if (fs.statSync(target).isDirectory()) return (p) => (fs.existsSync(path.join(target, p)) ? fs.readFileSync(path.join(target, p), 'utf8') : null);
  const all = await unpackProject(new Uint8Array(fs.readFileSync(target)));
  return (p) => { const f = all.get(p); return f ? new TextDecoder().decode(f) : null; };
}

const read = await files();
const index = JSON.parse(read(CHAT_INDEX) ?? '[]') as { id: string; title: string }[];
const total: Usage = { requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, tools: 0, images: 0, ms: 0, model: '' };
const k = (n: number) => `${Math.round(n / 1000)} k`;
for (const chat of index) {
  const c = JSON.parse(read(chatPath(chat.id)) ?? '{"items":[]}') as { items: { usage?: Usage; role: string; text?: string }[] };
  console.log(`\n${chat.title}`);
  let turn = 0;
  for (const it of c.items) {
    if (it.role === 'user') turn++;
    if (!it.usage) continue;
    const u = it.usage;
    console.log(`  turn ${turn}: ${u.tools} tool calls, ${u.images} pictures, ${k(u.input + u.cacheRead + u.cacheWrite)} tokens read (${k(u.cacheRead)} from the cache), ${k(u.output)} written, ${(u.ms / 60000).toFixed(1)} min, ${u.model}`);
    for (const key of ['requests', 'input', 'cacheRead', 'cacheWrite', 'output', 'tools', 'images', 'ms'] as const) total[key] += u[key];
  }
}
console.log(`\nIn all: ${total.tools} tool calls, ${total.images} pictures, ${k(total.input + total.cacheRead + total.cacheWrite)} tokens read (${k(total.cacheRead)} from the cache), ${k(total.output)} written, ${(total.ms / 60000).toFixed(1)} min`);
