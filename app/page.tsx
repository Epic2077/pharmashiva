"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, BookOpen, Lock, ShieldCheck } from "lucide-react";
import Logo from "@/components/shared/Logo";

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Pharmacist-grade guidance" },
  { icon: BookOpen, label: "Evidence-based answers" },
  { icon: Lock, label: "Private & secure" },
];

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* Ambient brand glow, works in both light and dark. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-104 w-104 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-96 w-96 rounded-full bg-ring/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex w-full max-w-xl flex-col items-center text-center"
      >
        <Logo size="large" />

        <h1 className="manrope mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
          Trusted medication decisions.
        </h1>

        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          PharmaShiva helps pharmacists check interactions, side effects, and
          supplements with clear, evidence-based guidance.
        </p>

        <ul className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
          {TRUST_POINTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Icon className="size-4 text-primary" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>

        <Link
          href="/home/chat"
          className="group mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] sm:w-auto"
        >
          Start a consultation
          <ArrowRight
            className="size-5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>

        <p className="mt-10 text-xs text-muted-foreground">
          © 2026 PharmaShiva · Always verify medical information
        </p>
      </motion.div>
    </main>
  );
}
