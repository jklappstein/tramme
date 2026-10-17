// A project opened for the first time after it was made from words, a video
// or sources. From words (the home's direction box): the assistant starts on
// them at once, making the film they describe. From a video: the speech is
// transcribed, the video is joined to the next message, and with words the
// assistant starts on them; without, it asks what the user wants (format,
// cuts, captions, emphasis) before doing anything. From sources: the sounds
// and videos are transcribed, and the assistant reads everything to propose
// what the video should be (/analyze) — at once with words, after the user's
// go otherwise.

import { srcPath } from '@tramme/project';
import { aiRoute, chat, refreshStatus } from './ai/index.ts';
import { send } from './ai/conversation.ts';
import { listCommands } from './ai/commands.ts';
import { draft, pending } from './attachments.ts';
import { startKey, type Start } from './importer.ts';
import { SOURCES_DIR } from './sources.ts';
import { transcribeAsset } from './speech.ts';
import { S, toast } from './state.ts';
import { t } from './i18n/index.ts';

const VIDEO_GREETING = () => [
  t('start.yourVideoIsOn'),
  '',
  t('start.theFinalFormatLandscape'),
  t('start.whatToCutSilences'),
  t('start.theStyleOfCaptions'),
  t('start.theOverallToneUnderstated'),
  '',
  t('start.iWillShowYou'),
].join('\n');

const SOURCES_GREETING = (n: number, kit: boolean) => [
  t('start.sourcesAreIn', { n }),
  ...(kit ? ['', t('start.kitApplied')] : []),
  '',
  t('start.sourcesReadAll'),
  t('start.sourcesBrief'),
  t('start.sourcesDirections'),
  '',
  t('start.sourcesSend'),
].join('\n');

const transcribe = (asset: string) => transcribeAsset(asset).catch((e) => toast(t('common.couldNotTranscribeError', { error: (e as Error).message }), 'error', 9000));

function greet(text: string) {
  chat.value = [...chat.peek(), { id: `start-${Date.now().toString(36)}`, role: 'assistant', text }];
  // on a phone, the conversation in front
  S.mobileTab.value = 'ai';
}

/** the words the project was made with, sent at once with the workflow that fits; no model to send them to: they wait in the box */
async function begin(words: string, workflow?: string) {
  if (!aiRoute.peek()) await refreshStatus();
  const cmd = workflow ? listCommands(S.registry.peek()).find((c) => c.name === workflow && c.kind === 'prompt') : undefined;
  if (!aiRoute.peek()) { draft.value = cmd ? `/${cmd.name} ${words}` : words; return; }
  send(words, cmd ? { command: { cmd } } : {});
}

export function startProject() {
  const id = S.project.peek().id;
  let start: Start | null = null;
  try {
    start = JSON.parse(sessionStorage.getItem(startKey(id)) ?? 'null');
    sessionStorage.removeItem(startKey(id));
  } catch { return; }
  if (!start) return;
  const doc = S.doc.peek(), words = start.prompt?.trim();
  if (start.sources) {
    // what is said, ready by the time the assistant reads the sources
    for (const [asset, a] of Object.entries(doc.assets)) {
      if ((a.type === 'audio' || a.type === 'video') && srcPath(a.src)?.startsWith(SOURCES_DIR)) transcribe(asset);
    }
    if (words) { begin(words, 'analyze'); return; }
    draft.value = '/analyze ';
    greet(SOURCES_GREETING(start.sources, !!start.kit));
    return;
  }
  const asset = start.asset;
  if (asset && doc.assets[asset]) {
    transcribe(asset);
    pending.value = [{ path: start.path ?? doc.assets[asset].src, name: start.name ?? asset, kind: 'video', size: start.size ?? 0, asset }];
    if (words) { begin(words); return; }
    greet(VIDEO_GREETING());
    return;
  }
  if (words) begin(words, 'film');
}
