import type { Metadata } from 'next'
import './globals.css'
import GDPRSettings from '@/components/GDPRSettings';

export const metadata: Metadata = {
  title: 'Chaos Music Player',
  description: 'Democratic, gamified collaborative music player for social gatherings',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-dark-bg text-gray-100">
        {children}
        <GDPRSettings />
      </body>
    </html>
  )
}
