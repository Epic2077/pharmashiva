"use client";

import { useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PromptBar from "@/components/react-bits/PromptBar";

export interface ChatComposerSubmitOptions {
  /** Deep-thinking mode: answer with the Pro model. */
  thinking?: boolean;
}

interface ChatComposerProps {
  placeholder: string;
  isStreaming: boolean;
  onSubmit: (prompt: string, options?: ChatComposerSubmitOptions) => void;
  onStop: () => void;
}

/**
 * Chat composer built on the React Bits PromptBar. The affordances that have
 * nothing to hook up yet are switched off — each is one prop away in PromptBar:
 *   sources / commands → the @ and / menus, onSend gains the picked row
 *   models            → model picker (replaced here by the Think toggle)
 *   efforts           → effort slider, sparks light up at the top step
 *   onDictate         → replaces the local mic toggle with a real transcript
 */
export function ChatComposer({
  placeholder,
  isStreaming,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const [attachments, setAttachments] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    const names = Array.from(files ?? []).map((file) => file.name);
    if (names.length > 0) {
      setAttachments((current) => [...current, ...names]);
    }
  }

  return (
    <>
      {/* Native pickers: "Import file" and "Camera" both feed real files in. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <PromptBar
        placeholder={placeholder}
        busy={isStreaming}
        onSend={(text) => onSubmit(text, { thinking })}
        onStop={onStop}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        sources={[]}
        commands={[]}
        models={[]}
        efforts={[]}
        background="var(--card)"
        color="var(--foreground)"
        menuBackground="var(--popover)"
        sparkColor="var(--primary)"
        radius={24}
        width="100%"
        // The leading slot holds the attach menu plus the Think toggle.
        renderLeading={() => (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="prompt-bar__tool flex items-center justify-center"
                aria-label="Attach a file or photo"
              >
                <Camera className="size-4" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={12}
                className="min-w-44 rounded-xl p-1.5"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Add to the case</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="gap-3 py-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4 text-primary" />
                    <span>Import file</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-3 py-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="size-4 text-primary" />
                    <span>Use camera</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Switches the answer from the fast model to the deep-thinking one. */}
            <button
              type="button"
              className="prompt-bar__pick"
              aria-label={
                thinking ? "Deep thinking is on" : "Turn on deep thinking"
              }
              aria-pressed={thinking}
              title={
                thinking
                  ? "Deep thinking on — slower, more careful answers"
                  : "Deep thinking off"
              }
              data-think={thinking ? "" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setThinking((value) => !value)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
                aria-hidden="true"
              >
                <path d="M12 3a6 6 0 0 0-6 6c0 1.6.6 3 1.6 4.1.6.7 1 1.5 1.1 2.4l.1 1.5h6.4l.1-1.5c.1-.9.5-1.7 1.1-2.4A6 6 0 0 0 12 3Z" />
                <path d="M9 20h6" />
              </svg>
              <span>Think</span>
            </button>
          </>
        )}
        className="[&_.prompt-bar__field]:border [&_.prompt-bar__field]:border-border [&_.prompt-bar__field]:shadow-sm"
      />
    </>
  );
}
