import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "UNWITNESSED",
  description: "Nothing witnessed. No identity. No history. Conversations without traces.",
  keywords: ["encrypted", "chat", "anonymous", "private", "e2e", "temporary"],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexMono.variable}`}>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="referrer" content="no-referrer" />
        <link
          href="https://fonts.googleapis.com/css2?family=Special+Elite&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-black text-white antialiased"
        style={{ fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", "Courier New", monospace' }}
      >
        {children}
      </body>
    </html>
  );
}
