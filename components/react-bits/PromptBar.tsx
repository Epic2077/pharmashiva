'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Mic01Icon,
  PlusSignIcon,
  SparklesIcon,
} from '@hugeicons/core-free-icons';

import './PromptBar.css';

import { AttachmentChips } from './prompt-bar/AttachmentChips';
import {
  DEFAULT_COMMANDS,
  DEFAULT_EFFORTS,
  DEFAULT_MODELS,
  DEFAULT_SOURCES,
  EDGE,
  LINE,
} from './prompt-bar/constants';
import { PromptMenu } from './prompt-bar/PromptMenu';
import { SendGlyph } from './prompt-bar/SendGlyph';
import { SparkField } from './prompt-bar/SparkField';
import type {
  LatestHandlers,
  PromptBarProps,
  PromptBarRow,
} from './prompt-bar/types';
import {
  buildRows,
  parseToken,
  toLength,
  useAutoGrow,
  useIsomorphicLayoutEffect,
  useOutsidePointerDown,
} from './prompt-bar/utils';

export type {
  PromptBarCommand,
  PromptBarModel,
  PromptBarSendPayload,
  PromptBarSource,
} from './prompt-bar/types';

export default function PromptBar({
  placeholder = 'Ask anything',
  sources = DEFAULT_SOURCES,
  commands = DEFAULT_COMMANDS,
  models = DEFAULT_MODELS,
  defaultModel = '',
  efforts = DEFAULT_EFFORTS,
  defaultEffort = '',
  onEffortChange,
  busy = false,
  onSend,
  onStop,
  onAttach,
  onDictate,
  attachments: attachmentsProp,
  onAttachmentsChange,
  renderLeading,
  background = '#27272a',
  color = '#f5f5f5',
  menuBackground = '#323236',
  sparkColor = '#b39dff',
  sparkBoost = 1,
  width = 400,
  radius = 16,
  maxRows = 5,
  morphDuration = 240,
  squash = 0.12,
  tilt = 8,
  pressScale = 0.96,
  className = '',
}: PromptBarProps) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const dictation = useRef(0);
  const latest = useRef<LatestHandlers>({});

  const [draft, setDraft] = useState('');
  const [strokes, setStrokes] = useState(0);
  const [internalAttachments, setInternalAttachments] = useState<string[]>([]);
  const [modelKey, setModelKey] = useState(defaultModel);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [effortIndex, setEffortIndex] = useState(() => {
    const index = efforts.indexOf(defaultEffort);
    return index >= 0 ? index : Math.max(0, Math.floor((efforts.length - 1) / 2));
  });
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Kept in a ref so handlers always see the current callbacks without the
  // effects below re-subscribing on every render.
  useIsomorphicLayoutEffect(() => {
    latest.current = { onSend, onStop, onAttach, onDictate, onEffortChange };
  });

  const model = models.find((m) => m.key === modelKey) ?? models[0];
  const attachments = attachmentsProp ?? internalAttachments;
  const updateAttachments = (
    update: string[] | ((prev: string[]) => string[]),
  ) => {
    const next = typeof update === 'function' ? update(attachments) : update;
    if (onAttachmentsChange) onAttachmentsChange(next);
    else setInternalAttachments(next);
  };

  const token = dismissed ? null : parseToken(draft);
  // A menu only opens when it has rows to show, so disabling a feature (empty
  // list) also disables its trigger token.
  const open =
    plusOpen && sources.length > 0
      ? 'at'
      : token && (token.kind === 'at' ? sources.length : commands.length) > 0
        ? token.kind
        : modelOpen && models.length > 0
          ? 'model'
          : effortOpen && efforts.length > 0
            ? 'effort'
            : null;
  const query = plusOpen ? '' : (token?.query ?? '');
  const rows: PromptBarRow[] = buildRows(
    open,
    query,
    sources,
    commands,
    models,
  );
  const cursor = Math.min(active, Math.max(0, rows.length - 1));
  const canSend = draft.trim().length > 0 || attachments.length > 0;
  const armed = busy || canSend;
  const level = efforts[effortIndex] ?? '';
  const maxed = efforts.length > 1 && effortIndex === efforts.length - 1;

  const focusInput = () =>
    inputRef.current?.focus({ preventScroll: true });
  const closeMenus = useCallback(() => {
    setPlusOpen(false);
    setModelOpen(false);
    setEffortOpen(false);
  }, [setPlusOpen, setModelOpen, setEffortOpen]);

  useOutsidePointerDown(
    rootRef,
    plusOpen || modelOpen || effortOpen,
    closeMenus,
  );
  useAutoGrow(inputRef, draft, maxRows, LINE);

  // Invalidate any in-flight dictation when the bar unmounts.
  useIsomorphicLayoutEffect(
    () => () => {
      dictation.current += 1;
    },
    [],
  );

  const setEffort = (index: number) => {
    const next = Math.max(0, Math.min(efforts.length - 1, index));
    if (next === effortIndex) return;
    setEffortIndex(next);
    latest.current.onEffortChange?.(efforts[next]);
  };
  const effortFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio =
      (event.clientX - rect.left - EDGE) /
      Math.max(1, rect.width - 2 * EDGE);
    setEffort(Math.round(ratio * (efforts.length - 1)));
  };
  const onEffortKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;
    if (step) {
      event.preventDefault();
      setEffort(effortIndex + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setEffort(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setEffort(efforts.length - 1);
    } else if (event.key === 'Escape') {
      setEffortOpen(false);
      focusInput();
    }
  };

  const pick = (row: PromptBarRow) => {
    if (open === 'model') {
      setModelKey(row.key);
      setModelOpen(false);
      focusInput();
      return;
    }
    const head = token ? draft.slice(0, token.start) : draft;
    if (row.attach) {
      setDraft(head);
      Promise.resolve(latest.current.onAttach?.()).then((files) => {
        if (!files) return;
        updateAttachments((current) => [
          ...current,
          ...(Array.isArray(files) ? files : [files]),
        ]);
      });
    } else if (open === 'at') {
      setDraft(`${head}@${row.name} `);
    } else {
      setDraft(`${head}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    focusInput();
  };

  const send = () => {
    if (!canSend || busy) return;
    latest.current.onSend?.(draft.trim(), {
      attachments,
      model,
      effort: level,
    });
    setDraft('');
    updateAttachments([]);
    setDismissed(false);
    closeMenus();
    focusInput();
  };

  const toggleListen = () => {
    // Clicking while listening always reverts, cancelling any pending result.
    if (listening) {
      dictation.current += 1;
      setListening(false);
      return;
    }
    if (!latest.current.onDictate) {
      setListening(true);
      return;
    }
    const seq = ++dictation.current;
    setListening(true);
    Promise.resolve(latest.current.onDictate()).then(
      (text) => {
        if (seq !== dictation.current) return;
        setListening(false);
        if (text) setDraft((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text));
        focusInput();
      },
      () => {
        if (seq === dictation.current) setListening(false);
      },
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && rows.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(
          (cursor + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) %
            rows.length,
        );
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        pick(rows[cursor]);
        return;
      }
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setDismissed(true);
        closeMenus();
      }
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const holdSend = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !armed) return;
    setPressed(true);
  };
  const releaseSend = () => setPressed(false);

  return (
    <div
      ref={rootRef}
      className={`prompt-bar${className ? ` ${className}` : ''}`}
      data-busy={busy ? '' : undefined}
      data-max={maxed ? '' : undefined}
      style={
        {
          '--pb-bg': background,
          '--pb-ink': color,
          '--pb-menu': menuBackground,
          '--pb-w': toLength(width),
          '--pb-radius': `${radius}px`,
          '--pb-spark': sparkColor,
          '--pb-press': pressScale,
        } as CSSProperties
      }
    >
      <PromptMenu
        open={open}
        rows={rows}
        cursor={cursor}
        query={query}
        efforts={efforts}
        effortIndex={effortIndex}
        level={level}
        selectedModelKey={model?.key}
        onPick={pick}
        onHoverRow={setActive}
        onEffortPointer={effortFromPointer}
        onEffortKey={onEffortKey}
      />

      <div
        className="prompt-bar__field"
        role="presentation"
        data-max={maxed ? '' : undefined}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget || event.target === inputRef.current)
            closeMenus();
        }}
        onClick={focusInput}
      >
        <SparkField
          canvasRef={sparkRef}
          active={maxed && !reduce}
          color={sparkColor}
          sparkBoost={sparkBoost}
          strokes={strokes}
        />
        <AttachmentChips
          attachments={attachments}
          onRemove={(index) =>
            updateAttachments((current) =>
              current.filter((_, i) => i !== index),
            )
          }
        />

        <textarea
          ref={inputRef}
          className="prompt-bar__input"
          rows={1}
          value={draft}
          placeholder={listening ? 'Listening…' : placeholder}
          aria-label="Prompt"
          onChange={(event) => {
            setDraft(event.target.value);
            setStrokes((count) => count + 1);
            setDismissed(false);
            closeMenus();
            setActive(0);
          }}
          onFocus={closeMenus}
          onKeyDown={onKeyDown}
        />

        <div className="prompt-bar__bar">
          {renderLeading ? (
            renderLeading()
          ) : (
            <button
              type="button"
              className="prompt-bar__tool"
              aria-label="Add files and sources"
              aria-expanded={plusOpen}
              data-on={plusOpen ? '' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setModelOpen(false);
                setEffortOpen(false);
                setActive(0);
                setPlusOpen((v) => !v);
                focusInput();
              }}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={2} />
            </button>
          )}
          {models.length > 0 ? (
            <button
              type="button"
              className="prompt-bar__pick"
              aria-label="Choose model"
              aria-expanded={modelOpen}
              data-on={modelOpen ? '' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setPlusOpen(false);
                setEffortOpen(false);
                setActive(
                  Math.max(0, models.findIndex((m) => m.key === model?.key)),
                );
                setModelOpen((v) => !v);
                focusInput();
              }}
            >
              <span>{model.name}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={2.4} />
            </button>
          ) : null}
          {efforts.length > 0 ? (
            <button
              type="button"
              className="prompt-bar__pick"
              aria-label="Choose effort"
              aria-expanded={effortOpen}
              data-on={effortOpen ? '' : undefined}
              data-max={maxed ? '' : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setPlusOpen(false);
                setModelOpen(false);
                setEffortOpen((v) => !v);
                focusInput();
              }}
            >
              <HugeiconsIcon icon={SparklesIcon} size={13} strokeWidth={2} />
              <span>{level}</span>
            </button>
          ) : null}
          <span className="prompt-bar__spacer" />
          <button
            type="button"
            className="prompt-bar__tool"
            aria-label={listening ? 'Stop listening' : 'Dictate'}
            aria-pressed={listening}
            data-on={listening ? '' : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleListen}
          >
            {listening ? (
              // Equaliser bars stand in for the streaming/recording state.
              <span className="prompt-bar__eq" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <HugeiconsIcon icon={Mic01Icon} size={15} strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            className="prompt-bar__send"
            disabled={!armed}
            aria-label={busy ? 'Stop' : 'Send'}
            data-armed={armed ? '' : undefined}
            data-pressed={pressed ? '' : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={holdSend}
            onPointerUp={releaseSend}
            onPointerCancel={releaseSend}
            onPointerLeave={releaseSend}
            onClick={() => {
              if (busy) latest.current.onStop?.();
              else send();
            }}
          >
            <SendGlyph
              busy={busy}
              morphDuration={morphDuration}
              squash={squash}
              tilt={tilt}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
