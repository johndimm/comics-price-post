import type { Metadata } from "next";
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
            <div className="page-header-logo">
              Marvel <span>Silver Age</span>
            </div>
            <div className="page-header-subtitle">Collection Manager</div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
