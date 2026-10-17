// The studio, the first time a project opens in it.

import { inStudio, registerTour } from './engine.ts';
import { m } from '../i18n/index.ts';

registerTour({
  id: 'studio',
  title: m('tours.studio.title'),
  summary: m('tours.studio.summary'),
  page: 'editor',
  auto: true,
  order: 5,
  available: inStudio,
  steps: [
    {
      title: m('tours.studio.intro'),
      body: m('tours.studio.introBody'),
    },
    {
      target: 'direct', side: 'top', align: 'center',
      title: m('tours.studio.direct'),
      body: m('tours.studio.directBody'),
    },
    {
      target: 'pin', side: 'top', align: 'start',
      title: m('tours.studio.pin'),
      body: m('tours.studio.pinBody'),
    },
    {
      target: 'storyboard', side: 'top', align: 'center',
      title: m('tours.studio.storyboard'),
      body: m('tours.studio.storyboardBody'),
    },
    {
      target: 'notes', side: 'left', align: 'start',
      title: m('tours.studio.notes'),
      body: m('tours.studio.notesBody'),
    },
    {
      target: 'direction-tab', side: 'bottom', align: 'start',
      title: m('tours.studio.direction'),
      body: m('tours.studio.directionBody'),
    },
    {
      target: 'view-switch', side: 'bottom', align: 'center',
      title: m('tours.studio.atelier'),
      body: m('tours.studio.atelierBody'),
    },
    {
      target: 'export', side: 'bottom', align: 'end',
      title: m('common.export'),
      body: m('tours.editor.mp4WebmWithTransparency'),
    },
  ],
});
