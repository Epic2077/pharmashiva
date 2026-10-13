"use client";

import { useState, type FormEvent } from "react";
import { Mail, Phone, User } from "lucide-react";
import SettingProfile from "@/components/setting/SettingProfile";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "./SectionLabel";
import { TextField } from "./TextField";

export function ProfileForm() {
  const [name, setName] = useState("Pharmacist");
  const [email, setEmail] = useState("pharmacist@shiva.app");
  const [phone, setPhone] = useState("+1 (555) 010-2233");
  const [saved, setSaved] = useState(false);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <SettingProfile name={name} email={email} />

      <div className="flex flex-col gap-3">
        <SectionLabel>Personal information</SectionLabel>
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <TextField
            id="profile-name"
            label="Full name"
            icon={User}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            id="profile-email"
            label="Email"
            type="email"
            icon={Mail}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            id="profile-phone"
            label="Phone"
            type="tel"
            icon={Phone}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Button type="submit" className="mt-1 w-full rounded-full">
            {saved ? "Saved" : "Save changes"}
          </Button>
        </form>
      </div>
    </>
  );
}
