import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Whispr — Anonymous Group Confessions',
  description: 'Anonymous confessions, posted publicly to your group board. No gatekeeping. No selective screenshots.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}