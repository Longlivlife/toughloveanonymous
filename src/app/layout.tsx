import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tough Love Anonymous',
  description: 'A survivor-led platform for documenting experiences in the Troubled Teen Industry.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
