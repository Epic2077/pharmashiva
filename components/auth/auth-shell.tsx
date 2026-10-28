import Link from "next/link";
import Logo from "@/components/shared/Logo";

interface AuthShellProps {
  children: React.ReactNode;
}

/**
 * Shared layout for the authentication pages (login / signup).
 *
 * On desktop it is a two-column split: a brand panel on the left and the form
 * on the right. On mobile it collapses to a single centered column. This keeps
 * the form at a comfortable reading width on wide screens instead of stretching
 * the card edge-to-edge or leaving it floating top-left.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-svh w-full lg:grid-cols-2">
      {/* Brand panel — desktop only. */}
      <div className="relative hidden flex-col justify-between gap-8 border-r border-border bg-muted p-10 lg:flex">
        <Link href="/" className="w-fit">
          <Logo size="medium" title subtitle />
        </Link>
        <blockquote className="max-w-md text-lg font-medium leading-relaxed text-foreground/80">
          “Evidence-backed medical information, safety checks, and product
          guidance for pharmacists — in one assistant.”
        </blockquote>
        <p className="text-sm text-muted-foreground">
          Your Pharmacy AI Assistant
        </p>
      </div>

      {/* Form panel. */}
      <div className="flex flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link href="/" className="flex justify-center lg:hidden">
            <Logo size="small" title />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
