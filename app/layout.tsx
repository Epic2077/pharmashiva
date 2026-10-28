import type { Metadata, Viewport } from "next";
import { Manrope, Roboto, Vazirmatn } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
});
// Persian content font: applied to RTL text (e.g. Farsi product details),
// never to the default Latin UI.
const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  // Child pages only supply their own name, this wraps it: "Account · PharmaShiva"
  title: {
    default: "PharmaShiva",
    template: "%s · PharmaShiva",
  },
  description: "Your pharmacy AI assistant",
};

// Resize the layout viewport when the on-screen keyboard opens (iOS Safari
// overlays it by default), so the pinned chat composer stays visible above the
// keyboard and `100dvh` tracks the visible area.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The inline theme script (below) adds/removes the `dark` class on
      // <html> before hydration, so the server HTML and the hydrated DOM can
      // legitimately differ on `className`. Suppress the warning for this
      // element only — the mismatch is intentional and self-correcting.
      suppressHydrationWarning
      className={`${roboto.variable} ${manrope.variable} ${vazirmatn.variable} h-full antialiased roboto`}
    >
      <body className="min-h-full flex flex-col scrollbar-thumb-transparent">
        {/* Applies the saved theme to <html> before the first paint, so the
            page never flashes the wrong theme while hydrating. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
          suppressHydrationWarning
        />
        {children}
      </body>
    </html>
  );
}
