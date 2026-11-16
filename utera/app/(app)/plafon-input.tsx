'use client'

import { useState } from 'react'

interface PlafonInputProps {
  id: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

const formatAngka = (n: number) => n.toLocaleString('id-ID')

/**
 * Kotak isian nominal plafon yang bisa diketik langsung (selain digeser lewat slider).
 * Selama mengetik angka tidak dipaksa ke batas, supaya pengguna bisa mengetik bebas.
 * Hasil ketikan dipakai langsung bila masih di dalam batas; bila di luar batas,
 * angka disesuaikan ke batas terdekat saat kotak ditinggalkan atau Enter ditekan.
 */
export default function PlafonInput({ id, value, min, max, onChange }: PlafonInputProps) {
  // null = tidak sedang diketik, tampilkan nilai dari slider
  const [draft, setDraft] = useState<string | null>(null)

  const angkaDraft = draft === null ? value : Number(draft.replace(/\D/g, '')) || 0
  const diLuarBatas = draft !== null && (angkaDraft < min || angkaDraft > max)

  const simpan = () => {
    if (draft === null) return
    onChange(Math.min(max, Math.max(min, angkaDraft)))
    setDraft(null)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      className="live-input-val"
      value={draft ?? formatAngka(value)}
      aria-invalid={diLuarBatas}
      title={`Isi antara Rp ${formatAngka(min)} dan Rp ${formatAngka(max)}`}
      style={diLuarBatas ? { color: 'var(--terracotta)' } : undefined}
      onFocus={(e) => {
        setDraft(formatAngka(value))
        e.target.select()
      }}
      onChange={(e) => {
        const digit = e.target.value.replace(/\D/g, '').slice(0, 12)
        const n = Number(digit)
        setDraft(digit ? formatAngka(n) : '')
        if (digit && n >= min && n <= max) onChange(n)
      }}
      onBlur={simpan}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
