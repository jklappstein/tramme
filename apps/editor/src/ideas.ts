// Films to start from, the same on the home screen and in an empty studio:
// a name, and the words to finish in the direction box.

import { m } from './i18n/index.ts';

export const IDEAS: { label: string; words: string }[] = [
  { label: m('ideas.launch'), words: m('ideas.launchWords') },
  { label: m('ideas.explainer'), words: m('ideas.explainerWords') },
  { label: m('ideas.social'), words: m('ideas.socialWords') },
  { label: m('ideas.data'), words: m('ideas.dataWords') },
  { label: m('ideas.event'), words: m('ideas.eventWords') },
];
