import "~/styles/globals.css";

import { type Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "~/clients/trpc";
import { ThemeProvider } from "~/components/core/theme-provider";

const primary = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const code = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://trustclaw.app"),
  title: {
    default: "TrustClaw by Composio",
    template: "%s | TrustClaw",
  },
  description:
    "Your 24/7 AI assistant with 1000+ integrations via OAuth and sandboxed execution. Built on the ideas behind OpenClaw, rebuilt for security.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    type: "website",
    siteName: "TrustClaw",
    title: "TrustClaw by Composio",
    description:
      "Your 24/7 AI assistant with 1000+ integrations via OAuth and sandboxed execution.",
    url: "https://trustclaw.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrustClaw by Composio",
    description:
      "Your 24/7 AI assistant with 1000+ integrations via OAuth and sandboxed execution.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://trustclaw.app",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${primary.variable} ${code.variable}`} suppressHydrationWarning>
      <body className="bg-background min-h-screen font-sans antialiased">
        <ThemeProvider>
          <TRPCReactProvider>
            {children}
            <Toaster />
            <div id="dialog-portal" />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
