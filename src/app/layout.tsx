import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "GenPromptly",
    template: "%s | GenPromptly",
  },
  description: "GenPromptly is a B2B prompt operations platform operated by OpsForLocal.",
  icons: {
    icon: "/genpromptly-icon.png",
    apple: "/genpromptly-icon.png",
    shortcut: "/genpromptly-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider>{children}</ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
