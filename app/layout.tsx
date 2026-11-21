import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit — Sprint planning",
  description: "Plan projects, sprints, and tasks.",
};

export const viewport: Viewport = {
  themeColor: "#0f0e15",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before first paint: dark is the default; switch to light only if the user chose it.
const themeScript = `try{if(localStorage.getItem("theme")==="light"){document.documentElement.classList.remove("dark");document.querySelector('meta[name="theme-color"]')?.setAttribute("content","#f7f6fa")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
