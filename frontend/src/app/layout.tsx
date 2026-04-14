import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sitepilot',
  description: 'SaaS platform for website automation, SEO and AI tools',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
