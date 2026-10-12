'use client';

import type React from 'react';

import { EffortSlider } from './EffortSlider';
import { MenuRows } from './MenuRows';
import type { PromptBarMenu, PromptBarRow } from './types';

const MENU_LABELS: Record<PromptBarMenu, string> = {
  at: 'Sources',
  slash: 'Commands',
  model: 'Models',
  effort: 'Effort',
};

interface PromptMenuProps {
  /** Which menu is open, or null to render nothing. */
  open: PromptBarMenu | null;
  rows: PromptBarRow[];
  cursor: number;
  query: string;
  efforts: string[];
  effortIndex: number;
  level: string;
  selectedModelKey?: string;
  onPick: (row: PromptBarRow) => void;
  onHoverRow: (index: number) => void;
  onEffortPointer: (event: React.PointerEvent<HTMLDivElement>) => void;
  onEffortKey: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

/** The popover above the field: either the effort slider or a row list. */
export function PromptMenu({
  open,
  rows,
  cursor,
  query,
  efforts,
  effortIndex,
  level,
  selectedModelKey,
  onPick,
  onHoverRow,
  onEffortPointer,
  onEffortKey,
}: PromptMenuProps) {
  if (!open) return null;

  return (
    <div
      className="prompt-bar__menu"
      role={open === 'effort' ? 'dialog' : 'listbox'}
      aria-label={MENU_LABELS[open]}
      data-kind={open}
    >
      {open === 'effort' ? (
        <EffortSlider
          efforts={efforts}
          effortIndex={effortIndex}
          level={level}
          onFromPointer={onEffortPointer}
          onKeyDown={onEffortKey}
        />
      ) : (
        <MenuRows
          kind={open}
          rows={rows}
          cursor={cursor}
          query={query}
          selectedKey={selectedModelKey}
          onPick={onPick}
          onHover={onHoverRow}
        />
      )}
    </div>
  );
}
