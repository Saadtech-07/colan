import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import { AppStateProvider } from "@/providers/app-state";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colan — Employee & Project Hub",
  description:
    "Internal dashboard for teams, projects, seating, and gallery at Colan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <AuthSessionProvider>
          <AppStateProvider>{children}</AppStateProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
