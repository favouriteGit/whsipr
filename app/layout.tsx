import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "whsipr | anonymous confessions",
  description: "share your secrets safely",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* The Glow Effect */}
        <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/20 rounded-full blur-[120px] pointer-events-none -z-10" />
        
        <main className="relative z-10 max-w-2xl mx-auto px-6 py-12">
          {children}
        </main>
      </body>
    </html>
  );
}