// The two ways to work on a project: the studio (the film in front, directed
// by notes the assistant carries out) and the atelier (the layers, the
// timeline, the curves and the inspector, for the detail). One switch, in the
// top bar and in the settings.

import { prefs, setPrefs, VIEWS, type View } from '../settings.ts';
import { Icon, type IconName } from './icons.tsx';
import { m, t } from '../i18n/index.ts';

export const VIEW_LABEL: Record<View, string> = { studio: m('views.studio'), atelier: m('views.atelier') };
const VIEW_HINT: Record<View, string> = { studio: m('views.studioHint'), atelier: m('views.atelierHint') };
const VIEW_ICON: Record<View, IconName> = { studio: 'spark', atelier: 'sliders' };

export const setView = (view: View) => setPrefs({ view });

export function ViewSwitch() {
  const v = prefs.value.view;
  return (
    <div class="view-switch" role="tablist" data-tour="view-switch">
      {VIEWS.map((id) => (
        <button key={id} role="tab" aria-selected={v === id} class={v === id ? 'on' : ''} title={t(VIEW_HINT[id])} onClick={() => setView(id)}>
          <Icon name={VIEW_ICON[id]} /><span>{t(VIEW_LABEL[id])}</span>
        </button>
      ))}
    </div>
  );
}
