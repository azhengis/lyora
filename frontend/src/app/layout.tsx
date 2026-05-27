import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lyora — AI Infrastructure Monitor",
  description: "Adaptive AI platform for real-time anomaly detection and infrastructure monitoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f1117] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
