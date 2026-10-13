"use client";

import { useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { ProfileForm } from "@/components/setting/profile/ProfileForm";
import { ActionRow } from "@/components/setting/profile/ActionRow";
import { SectionLabel } from "@/components/setting/profile/SectionLabel";
import { PasswordDialog } from "@/components/setting/profile/PasswordDialog";
import { DeleteAccountDialog } from "@/components/setting/profile/DeleteAccountDialog";

export default function ProfilePage() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <ProfileForm />

      <div className="flex flex-col gap-3">
        <SectionLabel>Security</SectionLabel>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <ActionRow
            icon={<KeyRound className="size-5" />}
            title="Change password"
            description="Use a strong password you don't reuse elsewhere"
            onClick={() => setPasswordOpen(true)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Danger zone</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-destructive/30 bg-destructive/5">
          <ActionRow
            destructive
            icon={<Trash2 className="size-5" />}
            title="Delete account"
            description="Permanently remove your account, cases, and history"
            onClick={() => setDeleteOpen(true)}
          />
        </div>
      </div>

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
