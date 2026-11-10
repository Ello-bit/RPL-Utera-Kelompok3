import type { Metadata, Viewport } from 'next'
import './globals.css'
import './responsive.css'

export const metadata: Metadata = {
  title: 'UTERA (UMKM Sejahtera) — Satu Aplikasi Finansial untuk Semua Kebutuhan Usaha',
  description:
    'Sistem tata kelola keuangan, pembukuan kas warung, skor kelayakan kredit perbankan, dan guardrail cicilan 30% untuk UMKM Indonesia.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Google Fonts: Plus Jakarta Sans */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
        />
        {/* Google Icons: Material Symbols Rounded & Outlined */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
