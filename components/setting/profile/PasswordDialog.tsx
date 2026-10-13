"use client";

import { KeyRound, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
import { TextField } from "./TextField";

export function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-5 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Choose a new password for your account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <TextField
            id="current-password"
            label="Current password"
            type="password"
            icon={Lock}
            placeholder="••••••••"
          />
          <TextField
            id="new-password"
            label="New password"
            type="password"
            icon={KeyRound}
            placeholder="••••••••"
          />
          <TextField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            icon={KeyRound}
            placeholder="••••••••"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>Update password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
