import type { Metadata, Viewport } from 'next';
import { Inter, Merriweather, Noto_Sans_Malayalam } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-merriweather',
  display: 'swap',
});

const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-malayalam',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0b192c',
};

export const metadata: Metadata = {
  title: 'Mudra Publications | Kerala Registration & Land Revenue Digital Library',
  description:
    'Authenticated archival library of Kerala Registration Department LRC orders, IGR circulars, stamp duty notifications, fair value revisions, and service rules.',
  manifest: '/manifest.json',
  icons: {
    icon: '/mudrapublications_logo.jpeg',
    shortcut: '/mudrapublications_logo.jpeg',
    apple: '/mudrapublications_logo.jpeg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mudra Library',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${merriweather.variable} ${notoMalayalam.variable}`}
    >
      <body className="min-h-dvh flex flex-col bg-parchment-50 text-mudra-950 font-sans selection:bg-amber-300 selection:text-mudra-950">
        {children}
      </body>
    </html>
  );
}
