'use client';

import { useLayoutEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';

import type { PromptBarMenu, PromptBarRow } from './types';
import { renderIcon } from './renderIcon';

type MenuKind = Exclude<PromptBarMenu, 'effort'>;

interface MenuRowsProps {
  kind: MenuKind;
  rows: PromptBarRow[];
  cursor: number;
  query: string;
  /** Key of the checked row in the model menu. */
  selectedKey?: string;
  onPick: (row: PromptBarRow) => void;
  onHover: (index: number) => void;
}

/**
 * The row list of a menu, with the highlight that slides between rows as the
 * cursor moves (keyboard, hover or filter).
 */
export function MenuRows({
  kind,
  rows,
  cursor,
  query,
  selectedKey,
  onPick,
  onHover,
}: MenuRowsProps) {
  const glowRef = useRef<HTMLSpanElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastKind = useRef<MenuKind | null>(null);

  useLayoutEffect(() => {
    const glow = glowRef.current;
    if (!glow) return;
    const row = rowRefs.current[cursor];
    if (!row) {
      glow.style.opacity = '0';
      return;
    }
    const fresh = lastKind.current !== kind;
    lastKind.current = kind;
    if (fresh) glow.style.transition = 'none';
    glow.style.top = `${row.offsetTop}px`;
    glow.style.height = `${row.offsetHeight}px`;
    glow.style.opacity = '1';
    if (fresh) {
      void glow.offsetHeight;
      glow.style.transition = '';
    }
  }, [kind, cursor, rows]);

  return (
    <>
      <span ref={glowRef} className="prompt-bar__glow" aria-hidden="true" />
      {rows.map((row, index) => (
        <button
          key={row.key}
          ref={(element) => {
            rowRefs.current[index] = element;
          }}
          type="button"
          role="option"
          aria-selected={index === cursor}
          className="prompt-bar__row"
          onMouseDown={(event) => event.preventDefault()}
          onPointerEnter={() => onHover(index)}
          onClick={() => onPick(row)}
        >
          {kind === 'at' ? (
            <span className="prompt-bar__row-icon">{renderIcon(row.icon, 15)}</span>
          ) : null}
          <span className="prompt-bar__row-name">{row.name}</span>
          {row.description ? (
            <span className="prompt-bar__row-desc">{row.description}</span>
          ) : null}
          {kind === 'model' ? (
            <>
              <span className="prompt-bar__row-tag">{row.tag}</span>
              <span
                className="prompt-bar__row-check"
                data-on={row.key === selectedKey ? '' : undefined}
              >
                <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.5} />
              </span>
            </>
          ) : null}
        </button>
      ))}
      {rows.length === 0 ? (
        <div className="prompt-bar__empty">No matches for &ldquo;{query}&rdquo;</div>
      ) : null}
    </>
  );
}
