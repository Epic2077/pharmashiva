'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, File02Icon } from '@hugeicons/core-free-icons';

interface AttachmentChipsProps {
  attachments: string[];
  onRemove: (index: number) => void;
}

/** Chips for picked files, each removable. Renders nothing when empty. */
export function AttachmentChips({
  attachments,
  onRemove,
}: AttachmentChipsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="prompt-bar__chips">
      {attachments.map((file, index) => (
        <span key={`${file}-${index}`} className="prompt-bar__chip">
          <HugeiconsIcon icon={File02Icon} size={12} strokeWidth={2} />
          <span className="prompt-bar__chip-name">{file}</span>
          <button
            type="button"
            className="prompt-bar__chip-x"
            aria-label={`Remove ${file}`}
            onClick={() => onRemove(index)}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={10} strokeWidth={2.5} />
          </button>
        </span>
      ))}
    </div>
  );
}
