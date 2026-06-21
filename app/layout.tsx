import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Silver Age Marvel Comics",
  description: "Browse, price, and sell your Silver Age Marvel comics collection",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="page-header">
          <div>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <div className="page-header-logo">Marvel <span>Silver Age</span></div>
              <div className="page-header-subtitle">Collection Manager</div>
            </Link>
          </div>
          <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Link href="/" className="btn" style={{ fontSize: 13 }}>Collection</Link>
            <Link href="/ebay" className="btn" style={{ fontSize: 13 }}>Sales Tracker</Link>
            <Link href="/next" className="btn" style={{ fontSize: 13 }}>Next</Link>
            <Link href="/tasks" className="btn" style={{ fontSize: 13 }}>Tasks</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
