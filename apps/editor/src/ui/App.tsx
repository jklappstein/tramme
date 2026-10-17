// A project open: the studio (the film directed in notes, by default) or the
// atelier. The atelier's layout: top bar; layers | viewport over transport
// and timeline | inspector over assistant. Under 760 px its panels become
// tabs below the viewport.

import { S } from '../state.ts';
import { prefs } from '../settings.ts';
import { Assistant } from './Assistant.tsx';
import { useSize } from './controls.tsx';
import { Icon } from './icons.tsx';
import { Inspector } from './Inspector.tsx';
import { LeftPanel } from './LeftPanel.tsx';
import { Overlays, useShortcuts } from './shell.tsx';
import { Studio } from './Studio.tsx';
import { Bottom, Transport } from './Timeline.tsx';
import { TopBar } from './TopBar.tsx';
import { Viewport } from './Viewport.tsx';
import { t } from '../i18n/index.ts';

const TABS: [typeof S.mobileTab.value, string, string][] = [
  ['viewport', t('common.image'), 'image'], ['layers', t('common.layers'), 'layers'], ['timeline', t('common.timeline'), 'timeline'], ['inspector', t('app.properties'), 'sliders'], ['ai', t('common.assistant'), 'chat'],
];

function Atelier() {
  useShortcuts();
  const [leftW, leftHandle] = useSize('left', 248, 180, 440);
  const [rightW, rightHandle] = useSize('right', 320, 260, 520);
  const [bottomH, bottomHandle] = useSize('bottom', 300, 140, 640);
  const [aiH, aiHandle] = useSize('ai', 340, 160, 900);
  return (
    <div class="app" data-tab={S.mobileTab.value}>
      <TopBar />
      <div class="workspace" style={{ gridTemplateColumns: `${leftW}px 1px minmax(0, 1fr) 1px ${rightW}px` }}>
        <aside class="col left" data-tour="left-panel"><LeftPanel /></aside>
        <div class="resizer v" {...leftHandle('x', 1)} />
        <main class="center">
          <Viewport />
          <div class="resizer h" {...bottomHandle('y', -1)} />
          <section class="bottom" style={{ height: bottomH }}>
            <Transport />
            <div class="timeline-wrap" style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}><Bottom /></div>
          </section>
        </main>
        <div class="resizer v" {...rightHandle('x', -1)} />
        <aside class="col right">
          <div class="inspector-wrap panel-body" data-tour="inspector" style={{ flex: 1 }}><Inspector /></div>
          <div class="resizer h" {...aiHandle('y', -1)} />
          <Assistant style={{ height: aiH, flex: 'none' }} />
        </aside>
      </div>
      <nav class="mobile-tabs">
        {TABS.map(([id, label, icon]) => (
          <button key={id} class={S.mobileTab.value === id ? 'on' : ''} onClick={() => { S.mobileTab.value = id; }}><Icon name={icon} />{label}</button>
        ))}
      </nav>
      <Overlays />
    </div>
  );
}

export function App() {
  return prefs.value.view === 'studio' ? <Studio /> : <Atelier />;
}
