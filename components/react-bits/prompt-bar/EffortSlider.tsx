'use client';

import type React from 'react';
import type { CSSProperties } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { HelpCircleIcon } from '@hugeicons/core-free-icons';

import { EDGE } from './constants';
import { fillAt, stepAt } from './utils';

interface EffortSliderProps {
  efforts: string[];
  effortIndex: number;
  level: string;
  onFromPointer: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

/** Discrete slider over the effort steps, low on the left. */
export function EffortSlider({
  efforts,
  effortIndex,
  level,
  onFromPointer,
  onKeyDown,
}: EffortSliderProps) {
  const count = efforts.length;
  const style = {
    '--pb-effort-x': stepAt(effortIndex, count, EDGE),
    '--pb-effort-fill': fillAt(effortIndex, count, EDGE),
  } as CSSProperties;

  return (
    <>
      <div className="prompt-bar__effort-head">
        <span className="prompt-bar__effort-title">Effort</span>
        <span className="prompt-bar__effort-level">{level}</span>
        <span
          className="prompt-bar__effort-help"
          title="Higher effort thinks longer before answering"
        >
          <HugeiconsIcon icon={HelpCircleIcon} size={14} strokeWidth={1.8} />
        </span>
      </div>

      <div className="prompt-bar__effort-ends">
        <span>Faster</span>
        <span>Smarter</span>
      </div>

      <div
        className="prompt-bar__effort-track"
        role="slider"
        tabIndex={0}
        aria-label="Effort"
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={effortIndex}
        aria-valuetext={level}
        style={style}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is best-effort; ignore unsupported cases.
          }
          event.currentTarget.focus({ preventScroll: true });
          onFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons & 1) onFromPointer(event);
        }}
        onKeyDown={onKeyDown}
      >
        <span className="prompt-bar__effort-fill" />
        {efforts.map((label, index) => (
          <i
            key={label}
            className="prompt-bar__effort-dot"
            style={{ left: stepAt(index, count, EDGE) }}
          />
        ))}
        <span className="prompt-bar__effort-thumb" />
      </div>
    </>
  );
}
