import { BadgeCheck, User } from "lucide-react";

export default function SettingProfile() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[url('/texture/texture-green.png')] bg-cover bg-center p-5 shadow-xl">
      {/* Soft bloom keeps the marble texture from feeling flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur">
          <User className="size-7 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-xl font-bold text-white">
              Pharmacist
            </h2>
            <BadgeCheck className="size-5 shrink-0 text-white/80" />
          </div>
          <p className="truncate text-sm text-white/70">pharmacist@shiva.app</p>
        </div>
      </div>
    </div>
  );
}
