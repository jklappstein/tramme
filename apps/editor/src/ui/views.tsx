// The two ways to work on a project: the studio (the film in front, directed
// by notes the assistant carries out) and the atelier (the layers, the
// timeline, the curves and the inspector, for the detail). One segmented
// control, in the top bar and in the settings.

import { prefs, setPrefs, VIEWS, type View } from '../settings.ts';
import { Seg } from './controls.tsx';
import type { SegOpt } from './controls.tsx';
import { m, t } from '../i18n/index.ts';

export const VIEW_LABEL: Record<View, string> = { studio: m('views.studio'), atelier: m('views.atelier') };
const VIEW_HINT: Record<View, string> = { studio: m('views.studioHint'), atelier: m('views.atelierHint') };
const VIEW_ICON: Record<View, string> = { studio: 'mark', atelier: 'sliders' };

export const setView = (view: View) => setPrefs({ view });

export function ViewSwitch({ size, showLabels = true }: { size?: 'sm' | 'md' | 'lg'; showLabels?: boolean }) {
  const v = prefs.value.view;
  const options: SegOpt[] = VIEWS.map((id) => ({ value: id, label: showLabels ? t(VIEW_LABEL[id]) : '', icon: VIEW_ICON[id], tour: id === 'studio' ? 'view-switch' : undefined }));
  return <Seg value={v} options={options} onChange={(id) => setView(id as View)} size={size} role="tablist" ariaLabel={t('settings.view')} />;
}
