import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Self-hosted so builds don't depend on fetching Google Fonts.
const jetbrainsMono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "OAuth Readiness",
  description: "How long until your users can connect an app, and what will block you. Agent-researched OAuth app setup and approval guides.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply a saved theme before paint so there's no flash; otherwise the system setting applies. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <div className="mx-auto min-h-screen max-w-[1240px] border-x border-line bg-surface">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-sm">
            <div className="flex h-14 items-center justify-between gap-4 px-5 sm:px-8">
              <Link href="/" className="flex items-center gap-2.5 font-medium tracking-tight text-ink">
                <span className="grid h-5 w-5 place-items-center bg-brand text-[10px] font-bold text-white">OR</span>
                OAuth Readiness
              </Link>
              <nav className="flex items-center gap-1 sm:gap-2">
                <Link href="/#library" className="label hidden px-2.5 py-2 text-ink-2 hover:text-ink sm:block">
                  Library
                </Link>
                <Link href="/#method" className="label hidden px-2.5 py-2 text-ink-2 hover:text-ink sm:block">
                  Method
                </Link>
                <ThemeToggle />
                <Link href="/#research" className="label border border-ink bg-ink px-3 py-2 text-on-ink hover:bg-ink-2">
                  Research an app
                </Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
          <footer className="border-t border-line px-5 py-8 sm:px-8">
            <div className="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>Built by Yash Gori for the Composio APM, Integrations take-home. Not affiliated with Composio.</p>
              <p className="label">Research: GPT-5.6 Terra · Page reading: GPT-5.6 Luna</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
