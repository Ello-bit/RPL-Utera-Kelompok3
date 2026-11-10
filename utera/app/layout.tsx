import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UTERA (UMKM Sejahtera) — Satu Aplikasi Finansial untuk Semua Kebutuhan Usaha',
  description:
    'Sistem tata kelola keuangan, pembukuan kas warung, skor kelayakan kredit perbankan, dan guardrail cicilan 30% untuk UMKM Indonesia.',
}

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
      </head>
      <body>{children}</body>
    </html>
  )
}
