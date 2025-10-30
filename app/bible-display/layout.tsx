'use client';

import { ThemeProvider } from "@/lib/theme-context";

export default function BibleDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en" className="dark">
      <body className="bg-black m-0 p-0 overflow-hidden">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
