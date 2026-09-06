import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReachInbox Scheduler",
  description: "Email Job Scheduler",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
