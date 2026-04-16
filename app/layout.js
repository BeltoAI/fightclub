import "./globals.css";

export const metadata = {
  title: "IDLE FIGHT CLUB",
  description:
    "The hyper-local apartment complex idle fight club. AI-powered drama.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
