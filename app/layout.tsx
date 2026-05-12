import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TikShankz',
  description: 'Dashboard mobile TikShankz para TikTok Live'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
