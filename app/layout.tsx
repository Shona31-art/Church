import "./globals.css";

export const metadata = {
  title: "Grace-bound",
  description: "A church operating system for people, not just Sundays.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
