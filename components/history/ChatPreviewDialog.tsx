"use client";

import { useRouter } from "next/navigation";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          </div>
        </DialogHeader>

        {/* ChatMessages owns its own scrolling, so the parent just bounds it. */}
        <div className="min-h-0 flex-1 px-5">
          <ChatMessages messages={messages} isStreaming={false} />
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3">
          <Button
            className="w-full rounded-full"
            onClick={() => {
              onOpenChange(false);
              router.push(`/home/chat/${chatId}`);
            }}
          >
            Open chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
