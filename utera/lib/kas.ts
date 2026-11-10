import { Tables } from './database.types'

export type TransaksiKas = Tables<'transaksi_kas'>

export const KAS_CATEGORIES = {
  pemasukan: ['Penjualan', 'Pendapatan lain'],
  pengeluaran: [
    'Bahan baku / kulakan',
    'Operasional',
    'Gaji karyawan',
    'Peralatan',
    'Lainnya',
  ],
} as const

export const PAYMENT_METHODS = [
  'Tunai',
  'QRIS',
  'Transfer Bank',
  'Lainnya',
] as const

export interface KasSummary {
  totalIncome: number
  totalExpense: number
  netProfit: number
  saldoKas: number
  marginPct: number
  count: number
}

export function calculateKasSummary(transactions: TransaksiKas[]): KasSummary {
  let totalIncome = 0
  let totalExpense = 0

  transactions.forEach((tx) => {
    const nominal = Number(tx.nominal) || 0
    if (tx.tipe === 'pemasukan') {
      totalIncome += nominal
    } else {
      totalExpense += nominal
    }
  })

  const netProfit = totalIncome - totalExpense
  const saldoKas = netProfit
  const marginPct =
    totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0

  return {
    totalIncome,
    totalExpense,
    netProfit,
    saldoKas,
    marginPct,
    count: transactions.length,
  }
}

export interface MonthData {
  key: string
  label: string
  pemasukan: number
  pengeluaran: number
  labaBersih: number
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

export function getMonthlyBreakdown(
  transactions: TransaksiKas[],
  monthsCount = 4
): MonthData[] {
  // Group by YYYY-MM
  const map = new Map<string, { pemasukan: number; pengeluaran: number }>()

  transactions.forEach((tx) => {
    if (!tx.tanggal) return
    const ym = tx.tanggal.slice(0, 7) // 'YYYY-MM'
    const cur = map.get(ym) || { pemasukan: 0, pengeluaran: 0 }
    const nominal = Number(tx.nominal) || 0
    if (tx.tipe === 'pemasukan') {
      cur.pemasukan += nominal
    } else {
      cur.pengeluaran += nominal
    }
    map.set(ym, cur)
  })

  // Sort chronologically
  const sortedKeys = Array.from(map.keys()).sort()
  const recentKeys = sortedKeys.slice(-monthsCount)

  if (recentKeys.length === 0) {
    return []
  }

  return recentKeys.map((k) => {
    const [year, month] = k.split('-')
    const mIdx = parseInt(month, 10) - 1
    const data = map.get(k)!
    return {
      key: k,
      label: `${MONTH_NAMES[mIdx] || month} ${year}`,
      pemasukan: data.pemasukan,
      pengeluaran: data.pengeluaran,
      labaBersih: data.pemasukan - data.pengeluaran,
    }
  })
}

export interface CategoryBreakdown {
  category: string
  amount: number
  pct: number
}

export function getCategoryDistribution(
  transactions: TransaksiKas[],
  type: 'pemasukan' | 'pengeluaran' = 'pemasukan'
): CategoryBreakdown[] {
  const filtered = transactions.filter((t) => t.tipe === type)
  const total = filtered.reduce((acc, t) => acc + (Number(t.nominal) || 0), 0)

  if (total === 0) return []

  const map = new Map<string, number>()
  filtered.forEach((t) => {
    const cur = map.get(t.kategori) || 0
    map.set(t.kategori, cur + (Number(t.nominal) || 0))
  })

  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      pct: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function formatRupiah(num: number): string {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID')
}
