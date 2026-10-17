// The film as a storyboard: its scenes side by side, each a strip of its own
// frames under its name, the sound under them (the music and the voice drawn,
// the effects as ticks), the notes left on the film, and the playhead across.
// A press seeks and a drag scrubs; a click on a scene puts it in focus: the
// notes are about it until the focus goes.

import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audioClips, type AudioClip } from '@tramme/core';
import { comp, S, setTime } from '../state.ts';
import { frames } from '../frames.ts';
import { current, filmDoc, focused, focusScene, notes, scenes, studio } from '../studio.ts';
import { snap, timecode } from '../model.ts';
import type { Scene } from '../scenes.ts';
import { noBrowserMenu } from './controls.tsx';
import { Icon } from './icons.tsx';
import { Wave } from './Timeline.tsx';
import { t } from '../i18n/index.ts';

/** room at each end of the track (px) */
const PAD = 14;
/** height of a scene's frames (px) */
const STRIP = 62;

/** seconds, short: 4.2 s, 12 s */
const secs = (s: number) => `${s < 10 ? (Math.round(s * 10) / 10).toString() : Math.round(s)} s`;

/** a scene: a strip of its frames, its number and its name */
function SceneCard({ s, i, x, w, frameW, compId }: { s: Scene; i: number; x: number; w: number; frameW: number; compId: string }) {
  void frames.tick.value;
  const doc = filmDoc.value, fps = doc.compositions[compId]?.fps ?? 30;
  const n = Math.max(1, Math.min(12, Math.round(w / frameW)));
  const times = Array.from({ length: n }, (_, j) => snap(s.from + ((j + 0.5) * (s.to - s.from)) / n, fps));
  const on = focused.value?.id === s.id, live = current.value?.id === s.id;
  return (
    <div class={`sb-scene${on ? ' on' : ''}${live ? ' live' : ''}`} data-scene={s.id} style={{ left: x, width: Math.max(2, w - 3) }} title={`${s.name} · ${secs(s.to - s.from)}`}>
      <div class="sb-frames">
        {times.map((tt) => { const url = frames.at(doc, compId, tt); return url ? <img key={tt} src={url} alt="" draggable={false} /> : <i key={tt} />; })}
      </div>
      {w > 34 && <div class="sb-label"><b>{String(i + 1).padStart(2, '0')}</b>{w > 90 && <span>{s.name}</span>}</div>}
      {w > 120 && <span class="sb-dur">{secs(s.to - s.from)}</span>}
    </div>
  );
}

/** the sound of the film: the music and the voice drawn, the effects as ticks */
function SoundLane({ clips, X, k }: { clips: AudioClip[]; X: (t: number) => number; k: number }) {
  return (
    <div class="sb-sound">
      {clips.map((c) => {
        const w = c.duration * k;
        if (c.role === 'effect' || w < 10) return <span key={c.layerId} class={`sb-tick${c.weight === 'hero' ? ' hero' : ''}`} style={{ left: X(c.at) }} />;
        return (
          <div key={c.layerId} class={`sb-clip ${c.role}`} style={{ left: X(c.at), width: w }}>
            <Wave asset={c.asset} offset={c.offset} seconds={c.duration} rate={c.rate} width={w} />
          </div>
        );
      })}
    </div>
  );
}

/** the notes left on the film, at their moment: a click goes there and shows the note */
function NotesLane({ X }: { X: (t: number) => number }) {
  const list = notes.value;
  return (
    <div class="sb-notes">
      {list.map(({ n, note }) => (
        <button key={note.id} class={`sb-note${note.pin ? ' pinned' : ''}`} style={{ left: X(note.at!) }} title={note.text}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => { setTime(note.at!); studio.panel.value = 'notes'; studio.flash.value = note.id; }}>{n}</button>
      ))}
    </div>
  );
}

/** the playhead alone follows every frame, without drawing the storyboard again */
function Playhead({ X }: { X: (t: number) => number }) {
  return <div class="sb-playhead" style={{ transform: `translateX(${X(S.time.value)}px)` }} />;
}

/** where the film is: the time, and the scene playing */
function Where() {
  const c = comp.value, s = current.value, list = scenes.value;
  return (
    <span class="sb-where">
      <span class="sb-time mono">{timecode(S.time.value, c.fps)}</span>
      <span class="faint mono">/ {timecode(c.duration, c.fps)}</span>
      {s && list.length > 1 && <span class="sb-now">{t('studio.sceneOf', { i: list.indexOf(s) + 1, n: list.length })} · {s.name}</span>}
    </span>
  );
}

export function Storyboard() {
  const c = comp.value, compId = S.compId.value, list = scenes.value;
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(track.current!);
    return () => ro.disconnect();
  }, []);
  const k = Math.max(1e-3, (width - PAD * 2) / Math.max(0.01, c.duration));
  const X = (time: number) => PAD + time * k;
  const T = (x: number) => (x - PAD) / k;
  const frameW = (STRIP * c.width) / c.height;
  const doc = filmDoc.value;
  const clips = useMemo(() => audioClips(doc, compId), [doc, compId]);

  /** a press seeks, a drag scrubs; released where it was pressed on a scene, that scene is in focus */
  const press = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const el = track.current!, r = el.getBoundingClientRect();
    const at = (ev: PointerEvent) => setTime(snap(T(ev.clientX - r.left), c.fps));
    const x0 = e.clientX, card = (e.target as HTMLElement).closest('.sb-scene') as HTMLElement | null;
    let moved = false;
    S.playing.value = false;
    at(e);
    const move = (ev: PointerEvent) => { if (Math.abs(ev.clientX - x0) > 3) moved = true; at(ev); };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      if (moved) return;
      const s = card ? list.find((x) => x.id === card.dataset.scene) : null;
      if (s) { if (focused.peek()?.id !== s.id) focusScene(s); }
      else focusScene(null);
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  return (
    <section class="storyboard" data-tour="storyboard" onContextMenu={noBrowserMenu}>
      <div class="sb-head">
        <button class="sb-play" title={t('timeline.playSpace')} onClick={() => { S.playing.value = !S.playing.value; }}><Icon name={S.playing.value ? 'pause' : 'play'} /></button>
        <Where />
        <span class="grow" />
        {focused.value && (
          <button class="chip on" title={t('studio.clearFocus')} onClick={() => focusScene(null)}>
            <Icon name="target" />{focused.value.name}<Icon name="x" />
          </button>
        )}
        <button class={`icon-btn sm${S.loop.value ? ' on' : ''}`} title={t('timeline.loop')} onClick={() => { S.loop.value = !S.loop.value; }}><Icon name="loop" /></button>
      </div>
      <div class="sb-track" ref={track} onPointerDown={press}>
        <div class="sb-scenes" style={{ height: STRIP }}>
          {list.map((s, i) => <SceneCard key={s.id} s={s} i={i} x={X(s.from)} w={(s.to - s.from) * k} frameW={frameW} compId={compId} />)}
        </div>
        {clips.length > 0 && <SoundLane clips={clips} X={X} k={k} />}
        <NotesLane X={X} />
        <Playhead X={X} />
      </div>
    </section>
  );
}
