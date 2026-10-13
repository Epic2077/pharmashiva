import { useEffect, useLayoutEffect } from 'react';

import type {
  PromptBarCommand,
  PromptBarMenu,
  PromptBarModel,
  PromptBarRow,
  PromptBarSource,
} from './types';

export const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const toLength = (value: number | string) =>
  typeof value === 'number' ? `${value}px` : value;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolates two triangle lists (as flat coordinates) into an SVG path. */
export const pathAt = (a: number[], b: number[], t: number) => {
  let d = '';
  for (let i = 0; i < a.length; i += 2) {
    d += `${i ? 'L' : 'M'}${mix(a[i], b[i], t).toFixed(2)} ${mix(a[i + 1], b[i + 1], t).toFixed(2)}`;
  }
  return `${d}Z`;
};

export const buildRows = (
  open: PromptBarMenu | null,
  query: string,
  sources: PromptBarSource[],
  commands: PromptBarCommand[],
  models: PromptBarModel[],
): PromptBarRow[] => {
  if (open === 'at')
    return sources
      .filter((s) => s.name.toLowerCase().includes(query))
      .map((s) => ({ ...s }));
  if (open === 'slash')
    return commands
      .filter((c) =>
        c.name.replace(/^\//, '').toLowerCase().startsWith(query),
      )
      .map((c) => ({ key: c.key, name: c.name, description: c.description }));
  if (open === 'model') return models.map((m) => ({ ...m }));
  return [];
};

interface PromptToken {
  kind: 'at' | 'slash';
  query: string;
  start: number;
}

/** Reads a trailing `@word` or `/word` token out of the draft. */
export const parseToken = (draft: string): PromptToken | null => {
  const m = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!m) return null;
  return {
    kind: m[2] === '@' ? 'at' : 'slash',
    query: m[3].toLowerCase(),
    start: m.index + m[1].length,
  };
};

/** Horizontal position of step `i` on the effort track. */
export const stepAt = (i: number, count: number, edge: number) =>
  `calc(${edge}px + (100% - ${edge * 2}px) * ${i / Math.max(1, count - 1)})`;

/** Width of the filled part of the effort track up to step `i`. */
export const fillAt = (i: number, count: number, edge: number) =>
  i === count - 1 ? '100%' : `calc(${stepAt(i, count, edge)} + 7px)`;

/** Closes menus when a pointer goes down outside `ref`. */
export function useOutsidePointerDown(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [ref, enabled, onOutside]);
}

/** Grows a textarea with its content up to `maxRows`, then scrolls it. */
export function useAutoGrow(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows: number,
  lineHeight: number,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = '0px';
    const max = lineHeight * maxRows;
    element.style.height = `${Math.min(element.scrollHeight, max)}px`;
    element.style.overflowY = element.scrollHeight > max ? 'auto' : 'hidden';
  }, [ref, value, maxRows, lineHeight]);
}
