import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WHISPR — Anonymous Group Confessions',
  description: 'Anonymous confessions posted publicly to your group. No gatekeeping. No screenshots.',
  icons: [
    { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'shortcut icon', url: '/favicon.svg' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
