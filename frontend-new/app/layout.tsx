import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css'; // ✅ BẮT BUỘC PHẢI CÓ

export const metadata: Metadata = {
  title: 'Restaurant System',
  description: 'Restaurant management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        
        {children}
      </body>
    </html>
  );
}
