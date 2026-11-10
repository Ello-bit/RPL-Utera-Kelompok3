import { Tables } from './database.types'
import { formatRupiah } from './kas'

export type TransaksiKas = Tables<'transaksi_kas'>

export interface ScoreComponent {
  score: number
  max: number
  ratio: number
  detail: string
}

export interface SkorResult {
  total: number
  category: 'Baik' | 'Cukup' | 'Rendah' | 'Belum Ada Data'
  badgeLabel: string
  badgeColor: string
  badgeBg: string
  k1: ScoreComponent
  k2: ScoreComponent
  k3: ScoreComponent
  k4: ScoreComponent
  /** true bila kurang dari 6 bulan punya transaksi (PRD: tampilkan peringatan data belum cukup) */
  dataKurang: boolean
  monthlyData: Array<{
    bulan: string
    pemasukan: number
    pengeluaran: number
    laba: number
    tercatat: boolean
  }>
  totals: {
    pemasukan: number
    pengeluaran: number
    laba: number
    margin: number
  }
}

function formatShort(num: number): string {
  if (num >= 1_000_000) {
    return 'Rp ' + (num / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  }
  return formatRupiah(num)
}

export function calculateSkorPRD(
  transactions: TransaksiKas[],
  isDemo = false
): SkorResult {
  const totalMonths = 6

  // If no transactions and not demo: score is 0
  if (transactions.length === 0 && !isDemo) {
    const emptyMonthly = [
      'Bulan 1',
      'Bulan 2',
      'Bulan 3',
      'Bulan 4',
      'Bulan 5',
      'Bulan 6',
    ].map((b) => ({
      bulan: b,
      pemasukan: 0,
      pengeluaran: 0,
      laba: 0,
      tercatat: false,
    }))

    return {
      total: 0,
      category: 'Belum Ada Data',
      badgeLabel: 'Belum Ada Data',
      badgeColor: '#6B7E74',
      badgeBg: '#F1F5F3',
      k1: {
        score: 0,
        max: 30,
        ratio: 0,
        detail: '0 dari 6 bulan tercatat',
      },
      k2: {
        score: 0,
        max: 25,
        ratio: 0,
        detail: 'Belum ada data pemasukan',
      },
      k3: {
        score: 0,
        max: 25,
        ratio: 0,
        detail: 'Margin belum dapat dihitung',
      },
      k4: {
        score: 0,
        max: 20,
        ratio: 0,
        detail: '0 dari 6 bulan laba positif',
      },
      dataKurang: true,
      monthlyData: emptyMonthly,
      totals: { pemasukan: 0, pengeluaran: 0, laba: 0, margin: 0 },
    }
  }

  // Group by YYYY-MM
  const map: Record<string, { pemasukan: number; pengeluaran: number; count: number }> = {}
  transactions.forEach((tx) => {
    const key = tx.tanggal ? tx.tanggal.slice(0, 7) : '2026-10'
    if (!map[key]) map[key] = { pemasukan: 0, pengeluaran: 0, count: 0 }
    const nominal = Number(tx.nominal) || 0
    if (tx.tipe === 'pemasukan') {
      map[key].pemasukan += nominal
    } else {
      map[key].pengeluaran += nominal
    }
    map[key].count++
  })

  // PRD: jendela = 6 bulan kalender terakhir sampai bulan berjalan.
  // Bulan tanpa transaksi tetap dihitung (kosong), tidak dilewati.
  const now = new Date()
  const recent6Keys = Array.from({ length: totalMonths }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (totalMonths - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const monthlyData = recent6Keys.map((k) => {
    const m = map[k] ?? { pemasukan: 0, pengeluaran: 0, count: 0 }
    return {
      bulan: k,
      pemasukan: m.pemasukan,
      pengeluaran: m.pengeluaran,
      laba: m.pemasukan - m.pengeluaran,
      tercatat: m.count > 0,
    }
  })

  // K1: Konsistensi Pencatatan (30 pts)
  const bCatat = monthlyData.filter((m) => m.tercatat).length
  const k1Raw = bCatat / totalMonths
  const k1Score = Math.round(30 * k1Raw)

  // K2: Tren Pemasukan (25 pts) — last 3 vs prev 3
  const rLama = monthlyData.slice(0, 3).reduce((s, m) => s + m.pemasukan, 0)
  const rBaru = monthlyData.slice(3, 6).reduce((s, m) => s + m.pemasukan, 0)
  let k2Ratio = 0
  if (rLama === 0 && rBaru > 0) {
    k2Ratio = 1
  } else if (rLama === 0 && rBaru === 0) {
    k2Ratio = 0
  } else {
    k2Ratio = Math.min(1, rBaru / rLama)
  }
  const k2Score = Math.round(25 * k2Ratio)

  // K3: Profitabilitas (25 pts) — net profit margin vs 20%
  const totalPemasukan = monthlyData.reduce((s, m) => s + m.pemasukan, 0)
  const totalPengeluaran = monthlyData.reduce((s, m) => s + m.pengeluaran, 0)
  const totalLaba = totalPemasukan - totalPengeluaran
  const margin =
    totalPemasukan > 0 ? Math.max(0, totalLaba) / totalPemasukan : 0
  const k3Ratio = Math.min(1, margin / 0.2)
  const k3Score = Math.round(25 * k3Ratio)

  // K4: Stabilitas Arus Kas (20 pts) — months with profit > 0
  const bLaba = monthlyData.filter((m) => m.laba > 0).length
  const k4Raw = bLaba / totalMonths
  const k4Score = Math.round(20 * k4Raw)

  const total = k1Score + k2Score + k3Score + k4Score

  let category: 'Baik' | 'Cukup' | 'Rendah'
  let badgeLabel: string
  let badgeColor: string
  let badgeBg: string

  if (total >= 70) {
    category = 'Baik'
    badgeLabel = 'Layak KUR'
    badgeColor = '#1F6B4F'
    badgeBg = '#EAF4EF'
  } else if (total >= 40) {
    category = 'Cukup'
    badgeLabel = 'Perlu Peningkatan'
    badgeColor = '#C98A1B'
    badgeBg = '#FEF3CD'
  } else {
    category = 'Rendah'
    badgeLabel = 'Belum Layak'
    badgeColor = '#DC2626'
    badgeBg = '#FEE2E2'
  }

  return {
    total,
    category,
    badgeLabel,
    badgeColor,
    badgeBg,
    k1: {
      score: k1Score,
      max: 30,
      ratio: k1Raw,
      detail: `${bCatat} dari 6 bulan tercatat`,
    },
    k2: {
      score: k2Score,
      max: 25,
      ratio: k2Ratio,
      detail:
        rBaru >= rLama
          ? `Pemasukan naik: ${formatShort(rBaru)} vs ${formatShort(rLama)}`
          : `Pemasukan turun: ${formatShort(rBaru)} vs ${formatShort(rLama)}`,
    },
    k3: {
      score: k3Score,
      max: 25,
      ratio: k3Ratio,
      detail: `Margin laba bersih ${(margin * 100).toFixed(1)}% (target 20%)`,
    },
    k4: {
      score: k4Score,
      max: 20,
      ratio: k4Raw,
      detail: `${bLaba} dari 6 bulan laba positif`,
    },
    dataKurang: bCatat < totalMonths,
    monthlyData,
    totals: {
      pemasukan: totalPemasukan,
      pengeluaran: totalPengeluaran,
      laba: totalLaba,
      margin,
    },
  }
}


export interface SkorSnapshot {
  skor: number
  kategori: string
  omzet_bulanan: number
  laba_bersih: number
  margin_profit: number
  konsistensi_bulan: number
  catatan: string
}

/** Nilai yang disimpan ke tabel skor_kelayakan (omzet = rata-rata per bulan tercatat, konsistensi = jumlah bulan). */
export function buildSkorSnapshot(r: SkorResult): SkorSnapshot {
  const bulanTercatat = r.monthlyData.filter((m) => m.tercatat).length
  return {
    skor: r.total,
    kategori: r.category,
    omzet_bulanan: Math.round(r.totals.pemasukan / Math.max(1, bulanTercatat)),
    laba_bersih: r.totals.laba,
    margin_profit: Math.round(r.totals.margin * 100),
    konsistensi_bulan: bulanTercatat,
    catatan: `Evaluasi otomatis: ${r.badgeLabel}${r.dataKurang ? ' (data kurang dari 6 bulan)' : ''}`,
  }
}

/**
 * Rata-rata laba bersih per bulan (PRD: dasar batas cicilan 30%).
 * Dibagi jumlah bulan yang punya transaksi di jendela 6 bulan, minimal 1.
 */
export function rataLabaBulanan(r: SkorResult): number {
  const bulan = r.monthlyData.filter((m) => m.tercatat).length
  return bulan === 0 ? 0 : Math.round(r.totals.laba / bulan)
}
