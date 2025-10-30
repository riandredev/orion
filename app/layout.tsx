'use client';

import MainSidebar from "@/components/main-sidebar";
import "./globals.css";
import '@gravity-ui/uikit/styles/fonts.css'
import '@gravity-ui/uikit/styles/styles.css'
import '@/app/gravity-theme.css'
import { usePathname } from 'next/navigation';
import { TimeSelectionProvider } from '@/components/time-selection-provider';
import { SetupProvider } from '@/components/setup-provider';
import { GravityProvider } from '@/components/gravity-provider'
import RightSidebar from '@/components/right-sidebar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Check if this is a special route that doesn't need the main layout
  const isSpecialRoute = pathname.startsWith('/display') ||
                         pathname.startsWith('/clock-display') ||
                         pathname.startsWith('/hymn-display') ||
                         pathname.startsWith('/bible-display') ||
                         pathname.startsWith('/settings');

  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <title>Orion</title>
        <meta name="description" content="Church Presentation Software" />
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
      </head>
      <body className="bg-background text-foreground">
        <SetupProvider>
          <GravityProvider>
            {isSpecialRoute ? (
              children
            ) : (
              <TimeSelectionProvider>
                <div className="flex h-screen relative">
                  <div className="w-64 flex-none z-10">
                    <MainSidebar />
                  </div>
                  <main className="flex-1 overflow-y-auto overflow-x-auto">
                    {children}
                  </main>
                </div>
                {/* Right overlay sidebar (overlapping, fixed) - OUTSIDE flex container */}
                <RightSidebar />
              </TimeSelectionProvider>
            )}
          </GravityProvider>
        </SetupProvider>
      </body>
    </html>
  );
}
