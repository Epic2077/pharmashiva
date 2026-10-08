"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Logo from "@/components/shared/Logo";
import Link from "next/link";

export default function Home() {
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingComplete(true);
      setTimeout(() => setShowContent(true), 200);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!loadingComplete) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex w-full items-center justify-between bg-[url('/background.png')] bg-cover bg-no-repeat dark:bg-black sm:items-start">
          <div className="h-screen w-screen bg-muted-foreground/20 flex flex-col justify-between items-center">
            <div
              className="flex flex-col items-center mt-52"
              id="logo"
              aria-label="Logo"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Logo size="large" subtitle title />
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col items-center mb-8"
            >
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
                role="status"
                aria-label="Loading"
              >
                <span className="sr-only">Loading...</span>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="mt-4 text-muted-foreground"
              >
                Loading...
              </motion.p>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full items-center justify-between bg-[url('/background.png')] bg-cover bg-no-repeat dark:bg-black sm:items-start">
        <div className="h-screen w-screen bg-muted-foreground/20 flex flex-col justify-between items-center">
          <div
            className="flex flex-col items-center mt-52"
            id="logo"
            aria-label="Logo"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Logo size="large" subtitle title />
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center mb-8"
          >
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mb-1"
            >
              Better Questions
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mb-8 text-foreground"
            >
              Better Suggestions
            </motion.p>
            <motion.a
              href="/home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Let&apos;s Go
            </motion.a>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="mt-8 text-muted-foreground"
              dir="ltr"
            >
              © 2026 PharmaShiva. All rights reserved.
            </motion.p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
