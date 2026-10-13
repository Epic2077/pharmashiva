"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
import { Button } from "@/components/ui/button";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { useChat } from "@/lib/chat/chat-store";
import { getMockPreview } from "@/lib/chat/mock-preview";

interface ChatPreviewDialogProps {
  chatId: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatPreviewDialog({
  chatId,
  title,
  subtitle,
  open,
  onOpenChange,
}: ChatPreviewDialogProps) {
  const router = useRouter();

  // A chat started in this tab wins; otherwise fall back to the mock history.
  const chat = useChat(open ? chatId : null);
  const messages = chat?.messages ?? getMockPreview(chatId);

  // While the dialog is open it owns a history entry, so the browser Back
  // button (and Android/iOS back gesture) closes the dialog instead of
  // navigating away from the page.
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ chatPreview: chatId }, "");
    pushedRef.current = true;

    const handlePopState = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      onOpenChange(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [open, chatId, onOpenChange]);

  const handleClose = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChat = useCallback(() => {
    pushedRef.current = false;
    onOpenChange(false);
    router.replace(`/home/chat/${chatId}`);
  }, [chatId, onOpenChange, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(next);
        else handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] rounded-3xl p-0"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              {subtitle ? (
                <DialogDescription className="truncate text-xs">
                  {subtitle}
                </DialogDescription>
              ) : null}
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              Preview
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close preview"
              className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </DialogHeader>

        {/* ChatMessages owns its own scrolling, so the parent just bounds it. */}
        <div className="min-h-0 flex-1 px-5">
          <ChatMessages messages={messages} isStreaming={false} />
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3">
          <Button className="w-full rounded-full" onClick={handleOpenChat}>
            Open chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
