import {
  Attachment01Icon,
  Calendar03Icon,
  ChartLineData01Icon,
  File02Icon,
  Globe02Icon,
  Mail01Icon,
} from '@hugeicons/core-free-icons';

import type {
  PromptBarCommand,
  PromptBarModel,
  PromptBarSource,
} from './types';

/** Arrow path, morphed into the stop square by the send glyph. */
export const ARROW_UP = [
  12, 4.5, 18.5, 11, 14.25, 11, 14.25, 19.5, 9.75, 19.5, 9.75, 11, 5.5, 11,
];
export const SQUARE = [12, 6, 18, 6, 18, 12, 18, 18, 6, 18, 6, 12, 6, 6];
export const EASE_IN_OUT: [number, number, number, number] = [
  0.77, 0, 0.175, 1,
];

/** Line height of the textarea, used to cap its growth. */
export const LINE = 22;
/** Horizontal inset of the effort slider track. */
export const EDGE = 11;

export const DEFAULT_SOURCES: PromptBarSource[] = [
  {
    key: 'files',
    name: 'Photos & files',
    description: 'Upload from this device',
    icon: Attachment01Icon,
    attach: true,
  },
  {
    key: 'web',
    name: 'Web search',
    description: 'Live results',
    icon: Globe02Icon,
  },
  {
    key: 'sales',
    name: 'Sales data',
    description: 'Revenue and churn',
    icon: ChartLineData01Icon,
  },
  {
    key: 'docs',
    name: 'Documents',
    description: 'Specs, notes, briefs',
    icon: File02Icon,
  },
  { key: 'mail', name: 'Mail', description: 'Read and draft mail', icon: Mail01Icon },
  {
    key: 'calendar',
    name: 'Calendar',
    description: 'Events and availability',
    icon: Calendar03Icon,
  },
];

export const DEFAULT_COMMANDS: PromptBarCommand[] = [
  { key: 'summarize', name: '/summarize', description: 'Digest the thread so far' },
  { key: 'compare', name: '/compare', description: 'Two options side by side' },
  { key: 'draft', name: '/draft', description: 'Write a first version' },
  { key: 'explain', name: '/explain', description: 'A plain-language walkthrough' },
  { key: 'tasks', name: '/tasks', description: 'Turn this into a to-do list' },
];

export const DEFAULT_MODELS: PromptBarModel[] = [
  { key: 'nova-3', name: 'Nova 3', tag: 'Flagship' },
  { key: 'nova-mini', name: 'Nova Mini', tag: 'Fast' },
  { key: 'nova-2', name: 'Nova 2', tag: 'Legacy' },
];

export const DEFAULT_EFFORTS = ['Low', 'Medium', 'High', 'Extra', 'Max'];
