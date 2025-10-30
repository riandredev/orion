import { ThemeProvider } from "@/lib/theme-context";

export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en" className="dark">
      <head>
        <title>Display Clock - Orion</title>
      </head>
      <body className="bg-black m-0 p-0 overflow-hidden">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
