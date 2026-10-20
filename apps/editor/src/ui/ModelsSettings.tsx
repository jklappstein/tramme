// The settings' "Models" section (docs/editing-roadmap.md, step 1): one row
// per task the editor runs on this machine, the model it downloads by default
// named with its size and licence, and the models the user can take instead.
// For the tasks that go through a pipeline, a model hub id too, tried on a
// blank input before it is kept. The choice is per computer (preferences).

import { useState } from 'preact/hooks';
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

const size = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`);

/** "Whisper base · about 80 MB · MIT" */
const describe = (e: ModelEntry) => [e.name, e.mb ? t('localModels.aboutSize', { size: size(e.mb) }) : '', e.licence].filter(Boolean).join(' · ');

export const setModel = (task: ModelTask, id: string) => setPrefs({ models: { ...prefs.peek().models, [task]: id } });

function ModelRow({ task }: { task: ModelTask }) {
  const chosen = resolveModel(task, prefs.value.models[task]);
  const list = modelsFor(task);
  const options: [string, string][] = list.map((e, i) => [e.id, i === 0 ? t('localModels.byDefault', { name: e.name }) : e.name]);
  if (!list.includes(chosen)) options.push([chosen.id, chosen.name]);
  const note = NOTE[chosen.id];
  return (
    <Row label={t(TASK[task])} hint={t('localModels.defaultIs', { model: describe(list[0]) })} below={chosen !== list[0] && (
      <div class="set-info">
        <Icon name={chosen.commercial === false ? 'alert' : 'info'} />
        <span>
          {describe(chosen)}
          {chosen.commercial === false && <> · {t('localModels.notCommercial')}</>}
          {chosen.commercial === null && <> · {t('localModels.ownLicence')}</>}
          {!chosen.checked && <> · {t('localModels.notTried')}</>}
          {note && <> · {t(note)}</>}
        </span>
      </div>
    )}>
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

export function LocalModels() {
  return (
    <>
      <Section title={t('localModels.title')} hint={t('localModels.hint')}>
        {MODEL_TASKS.map((task) => <ModelRow key={task} task={task} />)}
      </Section>
      <Section title={t('localModels.advanced')} hint={t('localModels.advancedHint')}>
        {MODEL_TASKS.filter((task) => PIPELINE_OF[task]).map((task) => <HubRow key={task} task={task} />)}
      </Section>
    </>
  );
}
