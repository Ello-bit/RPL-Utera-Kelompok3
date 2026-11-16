'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import CatatKasForm from './catat-kas-form'

interface CatatKasModalProps {
  onClose: () => void
  onSaved: () => void
}

/** Pop-up formulir catat kas, dibuka dari tombol "Catat Kas" di kanan atas (di luar Buku Kas Warung). */
export default function CatatKasModal({ onClose, onSaved }: CatatKasModalProps) {
  useEffect(() => {
    const tutupDenganEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', tutupDenganEsc)
    // Kunci gulir halaman di belakang pop-up
    const overflowLama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Langsung siap mengetik jumlah
    document.getElementById('popup-kas-nominal')?.focus()
    return () => {
      window.removeEventListener('keydown', tutupDenganEsc)
      document.body.style.overflow = overflowLama
    }
  }, [onClose])

  return (
    <div className="catat-kas-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="catat-kas-dialog" role="dialog" aria-modal="true" aria-label="Catat transaksi kas">
        <button type="button" className="catat-kas-close" onClick={onClose} aria-label="Tutup">
          <span className="material-symbols-rounded">close</span>
        </button>
        <CatatKasForm idPrefix="popup-kas" onSaved={onSaved} />
        <p className="catat-kas-hint" style={{ margin: '14px 0 0', textAlign: 'center' }}>
          Ingin melihat semua catatan?{' '}
          <Link href="/buku-kas" onClick={onClose}>
            Buka Buku Kas Warung
          </Link>
        </p>
      </div>
    </div>
  )
}
