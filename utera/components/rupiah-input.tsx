'use client'

import { useRef, type InputHTMLAttributes } from 'react'
import { formatRibuan, olahKetikanRupiah, posisiKursorRupiah } from '@/lib/input'

interface RupiahInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Angka tanpa titik, misalnya "1500000" */
  value: string
  /** Dipanggil dengan angka tanpa titik setiap kali isi berubah */
  onValueChange: (digits: string) => void
  maksDigit?: number
}

/**
 * Kolom nominal rupiah yang otomatis memberi titik ribuan saat diketik
 * ("1500000" tampil "1.500.000") supaya mudah dibaca dan mengurangi salah ketik.
 * Nilai yang dikirim ke induk tetap angka tanpa titik.
 */
export default function RupiahInput({ value, onValueChange, maksDigit = 13, ...rest }: RupiahInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatRibuan(value)}
      onChange={(e) => {
        const el = e.target
        const jenis = (e.nativeEvent as InputEvent).inputType
        const { digits, digitDiKiriKursor } = olahKetikanRupiah(
          el.value,
          el.selectionStart ?? el.value.length,
          value,
          jenis,
          maksDigit
        )
        onValueChange(digits)
        // Titik bisa bertambah/berkurang, jadi kursor ditaruh lagi setelah digit yang sama
        requestAnimationFrame(() => {
          const node = ref.current
          if (!node || document.activeElement !== node) return
          const pos = posisiKursorRupiah(node.value, digitDiKiriKursor)
          node.setSelectionRange(pos, pos)
        })
      }}
    />
  )
}
