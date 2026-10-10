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

interface ChatComposerProps {
  placeholder: string;
  isStreaming: boolean;
  onSubmit: (prompt: string) => void;
  onStop: () => void;
}

/**
 * Chat composer built on the React Bits PromptBar. The affordances that have
 * nothing to hook up yet are switched off — each is one prop away in PromptBar:
 *   sources / commands → the @ and / menus, onSend gains the picked row
 *   models            → model picker
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
        onSend={(text) => onSubmit(text)}
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
        // The plus opens the app's dropdown instead of the built-in sources.
        renderLeading={() => (
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
        )}
        className="[&_.prompt-bar__field]:border [&_.prompt-bar__field]:border-border [&_.prompt-bar__field]:shadow-sm"
      />
    </>
  );
}
