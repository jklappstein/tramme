// The messages between the editor and the plugin sandbox: one browser worker
// per project, where the plugins' tools and checks run with no page rights
// (docs/plugin-isolation.md, stage 1). The worker imports the plugin modules,
// answers with what they declare, and runs their authoring-time code against
// a context bridged over these messages. Everything that crosses is plain
// data: live objects (elements, Path2D, functions) stay on their own side.

import type { CheckType, NodeType, EffectType, PluginMeta, ToolType } from '@tramme/core';

/** a plugin as the sandbox sees it: its declarations, without any function */
export interface PluginDecl {
  id: string;
  meta?: PluginMeta;
  /** the tools, without their `run` (the page wraps them) */
  tools: Omit<ToolType, 'run'>[];
  /** the checks, without their `run` */
  checks: Omit<CheckType, 'run'>[];
  /** the nodes' schemas, for the tools that read the vocabulary */
  nodes: SchemaNode[];
  effects: SchemaEffect[];
  modifiers: SchemaModifier[];
}

/** a node without its code: what a tool inside the sandbox may still read */
export interface SchemaNode {
  type: string;
  title: string;
  category: string;
  description?: string;
  ai?: NodeType['ai'];
  props: NodeType['props'];
  container?: boolean;
}

export interface SchemaEffect {
  type: string;
  title: string;
  category: string;
  description?: string;
  ai?: EffectType['ai'];
  props: EffectType['props'];
  stage: EffectType['stage'];
}

export interface SchemaModifier {
  type: string;
  title: string;
  params?: Record<string, unknown>;
}

/** what a tool run ships across: the document and its moment, the project's base */
export interface ToolCtxData {
  doc: unknown;
  compId: string;
  time: number;
  selection: string[];
  docUrl: string;
}

/** what a check run ships across: the sampled composition as plain data */
export interface CheckCtxData {
  doc: unknown;
  compId: string;
  comp: unknown;
  step: number;
  /** each placed layer with its node's schema in place of the node itself */
  samples: unknown[];
}

// ── the messages ──────────────────────────────────────────────

/** the page asks, the sandbox answers or asks back */
export type ToWorker =
  | { kind: 'load'; plugins: { id: string; url: string }[] }
  | { kind: 'tool'; name: string; input: unknown; ctx: ToolCtxData; call: number }
  | { kind: 'check'; name: string; ctx: CheckCtxData; call: number }
  | { kind: 'abort'; call: number }
  | { kind: 'answer'; id: number; ok?: unknown; err?: string };

/** the sandbox speaks */
export type FromWorker =
  | { kind: 'loaded'; plugins: PluginDecl[] }
  | { kind: 'loadFailed'; id: string; message: string }
  | { kind: 'result'; call: number; ok?: unknown; err?: string }
  | { kind: 'ask'; id: number; call: number; q: Ask }
  | { kind: 'progress'; call: number; done: number; total: number; step?: string };

/** what a running tool or check needs from the page */
export type Ask =
  | { kind: 'readText'; path: string }
  | { kind: 'files' }
  | { kind: 'writeFile'; path: string; data: { text: string } | { bytes: ArrayBuffer } }
  | { kind: 'renderStill'; t: number; compId?: string }
  | { kind: 'transcript'; assetId: string; ask: boolean }
  | { kind: 'data'; assetId: string };
