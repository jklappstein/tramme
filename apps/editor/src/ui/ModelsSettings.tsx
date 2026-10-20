// The settings' "Models" section (docs/editing-roadmap.md, step 1): one row
// per task the editor runs on this machine, the model it downloads by default
// named with its size and licence, and the models the user can take instead.
// For the tasks that go through a pipeline, a model hub id too, tried on a
// blank input before it is kept. The choice is per computer (preferences).
// Each row says whether its model is in this browser and how much it weighs,
// downloads it ahead of its tool, or deletes it to free the space.

import { useEffect, useState } from 'preact/hooks';
import { cachedFiles, cachedOf, deleteCached, downloadModel, groupCache, type CachedFile } from '../model-cache.ts';
import { HUB_PREFIX, isHubId, MODEL_TASKS, modelsFor, PIPELINE_OF, resolveModel, type ModelEntry, type ModelTask } from '../models.ts';
import { tryPipeline } from '../perception.ts';
import { prefs, setPrefs } from '../settings.ts';
import { toast } from '../state.ts';
import { m, t } from '../i18n/index.ts';
import { Select } from './controls.tsx';
import { Icon } from './icons.tsx';
import { Row, Section } from './SettingsRows.tsx';

const TASK: Record<ModelTask, string> = {
  'cutout-person': m('localModels.cutoutPerson'),
  'cutout-any': m('localModels.cutoutAny'),
  detection: m('localModels.detection'),
  depth: m('localModels.depth'),
  transcription: m('localModels.transcription'),
  vad: m('localModels.vad'),
};

/** what to know before choosing a model, by its id */
const NOTE: Record<string, string> = {
  'u2netp-person': m('localModels.noteU2netpPerson'),
  u2net: m('localModels.noteU2net'),
  'isnet-general': m('localModels.noteIsnet'),
  'yolos-small': m('localModels.noteYolosSmall'),
  'depth-anything-v2-base': m('localModels.noteNonCommercial'),
  'whisper-base': m('localModels.noteWhisperBase'),
  'whisper-tiny': m('localModels.noteWhisperTiny'),
  'whisper-large-v3-turbo': m('localModels.noteWhisperLarge'),
};

const bytes = (n: number) => size(n / 1e6);
const size = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`);

/** "Whisper base · about 80 MB · MIT" */
const describe = (e: ModelEntry) => [e.name, e.mb ? t('localModels.aboutSize', { size: size(e.mb) }) : '', e.licence].filter(Boolean).join(' · ');

export const setModel = (task: ModelTask, id: string) => setPrefs({ models: { ...prefs.peek().models, [task]: id } });

/** the cache's files, read again after a download or a deletion */
const useCache = (): [CachedFile[], () => void] => {
  const [files, setFiles] = useState<CachedFile[]>([]);
  const [round, setRound] = useState(0);
  useEffect(() => { let live = true; void cachedFiles().then((f) => { if (live) setFiles(f); }); return () => { live = false; }; }, [round]);
  return [files, () => setRound((r) => r + 1)];
};

/** where the chosen model stands in this browser: its weight and a delete, or a download with its progress */
function InCache({ model, files, changed }: { model: ModelEntry; files: CachedFile[]; changed: () => void }) {
  const [progress, setProgress] = useState<number | null>(null);
  const here = cachedOf(model, files);
  const download = async () => {
    setProgress(0);
    try { await downloadModel(model, (loaded, total) => setProgress(total ? loaded / total : 0)); }
    catch (e) { toast(t('localModels.downloadFailed', { name: model.name, error: (e as Error).message }), 'error'); }
    finally { setProgress(null); changed(); }
  };
  const remove = async () => { await deleteCached(here.urls); changed(); };
  return (
    <div class="set-info">
      <Icon name={here.bytes ? 'check' : progress !== null ? 'spinner' : 'download'} />
      <span class="grow">
        {here.bytes ? t('localModels.inThisBrowser', { size: bytes(here.bytes) })
          : progress !== null ? t('localModels.downloading', { percent: Math.round(progress * 100) })
          : t('localModels.notDownloaded')}
      </span>
      {here.bytes
        ? <button class="btn ghost sm" onClick={remove}><Icon name="trash" />{t('common.delete')}</button>
        : <button class="btn ghost sm" disabled={progress !== null} onClick={download}><Icon name="download" />{t('localModels.download')}</button>}
    </div>
  );
}

function ModelRow({ task, files, changed }: { task: ModelTask; files: CachedFile[]; changed: () => void }) {
  const chosen = resolveModel(task, prefs.value.models[task]);
  const list = modelsFor(task);
  const options: [string, string][] = list.map((e, i) => [e.id, i === 0 ? t('localModels.byDefault', { name: e.name }) : e.name]);
  if (!list.includes(chosen)) options.push([chosen.id, chosen.name]);
  const note = NOTE[chosen.id];
  return (
    <Row label={t(TASK[task])} hint={t('localModels.defaultIs', { model: describe(list[0]) })} below={<>
      {chosen !== list[0] && <div class="set-info">
        <Icon name={chosen.commercial === false ? 'alert' : 'info'} />
        <span>
          {describe(chosen)}
          {chosen.commercial === false && <> · {t('localModels.notCommercial')}</>}
          {chosen.commercial === null && <> · {t('localModels.ownLicence')}</>}
          {!chosen.checked && <> · {t('localModels.notTried')}</>}
          {note && <> · {t(note)}</>}
        </span>
      </div>}
      {task === 'transcription' && <div class="set-info"><Icon name="info" /><span>{t('localModels.transcriptionPaths')}</span></div>}
      <InCache model={chosen} files={files} changed={changed} />
    </>}>
      <Select value={chosen.id} options={options} onChange={(id) => setModel(task, id)} />
    </Row>
  );
}

/** a model hub id for a pipeline task: kept once it loaded and answered a blank input */
function HubRow({ task }: { task: ModelTask }) {
  const [id, setId] = useState('');
  const [trying, setTrying] = useState(false);
  const run = async () => {
    const hubId = id.trim();
    if (!isHubId(hubId)) { toast(t('localModels.notAHubId', { id: hubId }), 'error'); return; }
    setTrying(true);
    try {
      await tryPipeline(resolveModel(task, HUB_PREFIX + hubId));
      setModel(task, HUB_PREFIX + hubId);
      setId('');
      toast(t('localModels.hubModelKept', { id: hubId, task: t(TASK[task]) }), 'info');
    } catch (e) {
      toast(t('localModels.hubModelFailed', { id: hubId, error: (e as Error).message }), 'error');
    } finally { setTrying(false); }
  };
  return (
    <Row label={t('localModels.hubModel', { task: t(TASK[task]) })} hint={t('localModels.hubModelHint')}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div class="field"><input value={id} placeholder="owner/model" spellcheck={false} onInput={(e) => setId((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') void run(); }} /></div>
        <button class="btn sm" disabled={trying || !id.trim()} onClick={run}><Icon name={trying ? 'spinner' : 'check'} />{t('localModels.tryAndUse')}</button>
      </div>
    </Row>
  );
}

/** what else the cache holds: models the user named, older versions; each can be deleted */
function Others({ files, changed }: { files: CachedFile[]; changed: () => void }) {
  const used = new Set(MODEL_TASKS.flatMap((task) => cachedOf(resolveModel(task, prefs.value.models[task]), files).urls));
  const others = groupCache(files.filter((f) => !used.has(f.url)));
  const total = files.reduce((n, f) => n + f.bytes, 0);
  return (
    <Section title={t('localModels.cacheTitle')} hint={t('localModels.cacheHint', { size: bytes(total) })}>
      {others.length ? others.map((g) => (
        <Row key={g.id} label={g.name} hint={bytes(g.bytes)}>
          <button class="btn ghost sm" onClick={async () => { await deleteCached(g.urls); changed(); }}><Icon name="trash" />{t('common.delete')}</button>
        </Row>
      )) : <div class="set-info"><Icon name="info" /><span>{t('localModels.nothingElse')}</span></div>}
    </Section>
  );
}

export function LocalModels() {
  const [files, changed] = useCache();
  return (
    <>
      <Section title={t('localModels.title')} hint={t('localModels.hint')}>
        {MODEL_TASKS.map((task) => <ModelRow key={task} task={task} files={files} changed={changed} />)}
      </Section>
      <Section title={t('localModels.advanced')} hint={t('localModels.advancedHint')}>
        {MODEL_TASKS.filter((task) => PIPELINE_OF[task]).map((task) => <HubRow key={task} task={task} />)}
      </Section>
      <Others files={files} changed={changed} />
    </>
  );
}
