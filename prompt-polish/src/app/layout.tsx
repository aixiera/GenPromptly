import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Kairui Bi",
    template: "%s",
  },
  description: "Kairui Bi builds practical AI tools, automation systems, and digital products for real use cases.",
  icons: {
    icon: "/site/site-monogram.svg",
    apple: "/site/site-monogram.svg",
    shortcut: "/site/site-monogram.svg",
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
      </body>
    </html>
  );
}
