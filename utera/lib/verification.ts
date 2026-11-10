export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

export interface VerificationRequest {
  id: string
  businessId: string
  businessName: string
  ownerName: string
  phoneNumber: string
  businessSector: string
  applicationType: string
  notes: string
  hasNib: boolean
  nomorNib?: string
  totalTransactions: number
  skorPRD: number
  status: VerificationStatus
  submittedAt: string
  reviewedAt?: string
  reviewedBy?: string
  rejectionReason?: string
  certificateNumber?: string
}

export const DEFAULT_VERIFICATION_RECORDS: VerificationRequest[] = [
  {
    id: 'verif-konveksi',
    businessId: 'seed-konveksi',
    businessName: 'Konveksi Berkah Makmur',
    ownerName: 'Haji Ahmad',
    phoneNumber: '0821-4455-6677',
    businessSector: 'Konveksi & Fashion',
    applicationType: 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    notes: 'Mohon validasi NIB OSS kami dan catatan kas 15 transaksi untuk rekomendasi pengajuan KUR Mikro ke Bank BRI.',
    hasNib: true,
    nomorNib: '9120001234567',
    totalTransactions: 15,
    skorPRD: 74,
    status: 'pending',
    submittedAt: 'Hari ini, 10 menit lalu',
  },
  {
    id: 'verif-bengkel',
    businessId: 'seed-bengkel',
    businessName: 'Bengkel Motor Sejahtera',
    ownerName: 'Eko Wahyudi',
    phoneNumber: '0878-1122-3344',
    businessSector: 'Jasa & Layanan',
    applicationType: 'Validasi Pembukuan Kas Operasional',
    notes: 'Ingin memeriksa konsistensi pembukuan kas bulanan sebelum mengajukan NIB.',
    hasNib: false,
    totalTransactions: 9,
    skorPRD: 62,
    status: 'unverified',
    submittedAt: '',
  },
  {
    id: 'verif-dewo',
    businessId: 'seed-dewo',
    businessName: 'Kopi Galer',
    ownerName: 'Dewo',
    phoneNumber: '0812-3456-7890',
    businessSector: 'Kuliner & F&B',
    applicationType: 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    notes: 'Pengajuan validasi pembukuan digital dan NIB OSS untuk KUR Mikro.',
    hasNib: true,
    nomorNib: '1234567890123',
    totalTransactions: 18,
    skorPRD: 84,
    status: 'verified',
    submittedAt: '2026-03-01',
    reviewedAt: '2026-03-02',
    reviewedBy: 'Super Administrator UTERA',
    certificateNumber: 'UTERA-VERIF-2026-084',
  },
  {
    id: 'verif-berkah',
    businessId: 'seed-berkah',
    businessName: 'Warung Berkah Jaya',
    ownerName: 'Ibu Siti Aminah',
    phoneNumber: '0857-9876-5432',
    businessSector: 'Perdagangan & Retail',
    applicationType: 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    notes: 'Validasi berkas pembukuan warung kelontong & NIB.',
    hasNib: true,
    nomorNib: '8120009876543',
    totalTransactions: 42,
    skorPRD: 88,
    status: 'verified',
    submittedAt: '2026-02-14',
    reviewedAt: '2026-02-15',
    reviewedBy: 'Super Administrator UTERA',
    certificateNumber: 'UTERA-VERIF-2026-088',
  },
  {
    id: 'verif-nusantara',
    businessId: 'seed-nusantara',
    businessName: 'Kedai Kopi Nusantara',
    ownerName: 'Budi Santoso',
    phoneNumber: '0813-8821-4401',
    businessSector: 'Kuliner & F&B',
    applicationType: 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    notes: 'Audit kas digital dan kelengkapan izin edar / NIB.',
    hasNib: true,
    nomorNib: '3120005544332',
    totalTransactions: 24,
    skorPRD: 82,
    status: 'verified',
    submittedAt: '2026-01-20',
    reviewedAt: '2026-01-21',
    reviewedBy: 'Super Administrator UTERA',
    certificateNumber: 'UTERA-VERIF-2026-082',
  },
]

const STORAGE_KEY = 'utera_verifikasi_records_v1'

export function getStoredVerificationRecords(): VerificationRequest[] {
  if (typeof window === 'undefined') return DEFAULT_VERIFICATION_RECORDS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_VERIFICATION_RECORDS))
      return DEFAULT_VERIFICATION_RECORDS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_VERIFICATION_RECORDS
  } catch (err) {
    console.warn('Error reading verification storage:', err)
    return DEFAULT_VERIFICATION_RECORDS
  }
}

export function saveVerificationRecords(records: VerificationRequest[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    window.dispatchEvent(new CustomEvent('utera_verification_changed', { detail: records }))
  } catch (err) {
    console.error('Error saving verification storage:', err)
  }
}

export function findVerificationByBusiness(
  businessId: string,
  businessName?: string
): VerificationRequest | null {
  const list = getStoredVerificationRecords()
  const found = list.find(
    (item) =>
      item.businessId === businessId ||
      (businessName && item.businessName.toLowerCase() === businessName.toLowerCase())
  )
  return found || null
}

export function submitVerificationRequest(data: {
  businessId: string
  businessName: string
  ownerName: string
  phoneNumber: string
  businessSector: string
  applicationType: string
  notes: string
  hasNib: boolean
  nomorNib?: string
  totalTransactions: number
  skorPRD: number
}): VerificationRequest {
  const current = getStoredVerificationRecords()
  const existingIdx = current.findIndex(
    (c) =>
      c.businessId === data.businessId ||
      c.businessName.toLowerCase() === data.businessName.toLowerCase()
  )

  const newRecord: VerificationRequest = {
    id: existingIdx >= 0 ? current[existingIdx].id : 'verif-' + Date.now(),
    businessId: data.businessId,
    businessName: data.businessName,
    ownerName: data.ownerName || 'Pemilik Usaha',
    phoneNumber: data.phoneNumber || '-',
    businessSector: data.businessSector || 'Kuliner & F&B',
    applicationType: data.applicationType || 'Verifikasi Kredibilitas Lengkap (Siap KUR)',
    notes: data.notes || 'Pengajuan verifikasi kredibilitas pembukuan & legalitas.',
    hasNib: data.hasNib,
    nomorNib: data.nomorNib,
    totalTransactions: data.totalTransactions,
    skorPRD: data.skorPRD,
    status: 'pending',
    submittedAt: 'Hari ini, baru saja',
  }

  let updatedList: VerificationRequest[]
  if (existingIdx >= 0) {
    updatedList = [...current]
    updatedList[existingIdx] = newRecord
  } else {
    updatedList = [newRecord, ...current]
  }

  saveVerificationRecords(updatedList)

  // Dispatch Admin Notification if in browser
  if (typeof window !== 'undefined') {
    try {
      const adminStorageKey = 'utera_notifs_clean_admin123_utera_id'
      const rawAdmin = localStorage.getItem(adminStorageKey)
      const adminNotifs = rawAdmin ? JSON.parse(rawAdmin) : []
      const newAdminNotif = {
        id: 'adm-verif-' + Date.now(),
        title: 'Permohonan Verifikasi Baru: ' + data.businessName,
        desc: `${data.ownerName} mengajukan ${data.applicationType}.`,
        category: 'Verifikasi UMKM',
        fullMessage: `Mitra UMKM "${data.businessName}" (${data.ownerName}) telah mengajukan permohonan audit kredibilitas. Catatan: "${data.notes}". Dokumen NIB: ${data.hasNib ? 'Tersedia' : 'Belum Ada'}, Transaksi: ${data.totalTransactions}, Skor: ${data.skorPRD}/100.`,
        recommendation: 'Buka Direktori & Verifikasi UMKM untuk meninjau data dan mengesahkan status kredibilitas.',
        time: 'Baru saja',
        icon: 'verified',
        iconBg: '#ECFDF5',
        iconColor: '#059669',
        href: '/admin?tab=direktori',
        actionLabel: 'Tinjau Permohonan',
        read: false,
        urgent: true,
      }
      localStorage.setItem(adminStorageKey, JSON.stringify([newAdminNotif, ...adminNotifs]))
      window.dispatchEvent(new Event('utera_notifs_updated'))
    } catch (e) {
      console.warn('Could not dispatch admin notif:', e)
    }
  }

  return newRecord
}

export function updateVerificationStatus(
  businessId: string,
  newStatus: VerificationStatus,
  options?: {
    rejectionReason?: string
    certificateNumber?: string
    reviewedBy?: string
  }
): VerificationRequest | null {
  const current = getStoredVerificationRecords()
  const idx = current.findIndex((c) => c.businessId === businessId || c.id === businessId)
  if (idx < 0) return null

  const target = current[idx]
  const updated: VerificationRequest = {
    ...target,
    status: newStatus,
    reviewedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: options?.reviewedBy || 'Super Administrator UTERA',
    rejectionReason: newStatus === 'rejected' ? (options?.rejectionReason || 'Berkas belum lengkap') : undefined,
    certificateNumber:
      newStatus === 'verified'
        ? (options?.certificateNumber || `UTERA-VERIF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`)
        : target.certificateNumber,
  }

  const updatedList = [...current]
  updatedList[idx] = updated
  saveVerificationRecords(updatedList)

  // Dispatch User Notification if verified or rejected
  if (typeof window !== 'undefined') {
    try {
      const isApproved = newStatus === 'verified'
      const notifItem = {
        id: 'usr-verif-' + Date.now(),
        title: isApproved
          ? 'Selamat! Usaha Anda Terverifikasi Resmi UTERA'
          : 'Pembaruan Permohonan Verifikasi Usaha',
        desc: isApproved
          ? `Status kredibilitas ${target.businessName} telah disahkan resmi oleh Otoritas Pengawas.`
          : `Permohonan verifikasi ${target.businessName} memerlukan revisi: ${options?.rejectionReason || 'Periksa berkas'}.`,
        category: 'Status Verifikasi',
        fullMessage: isApproved
          ? `Selamat! Usaha "${target.businessName}" telah resmi dinyatakan Lolos Verifikasi Kredibilitas oleh Otoritas Pengawas UTERA dengan No. Sertifikat ${updated.certificateNumber}. Pembukuan kas dan legalitas Anda kini diakui bank mitra sebagai siap KUR.`
          : `Permohonan verifikasi untuk "${target.businessName}" ditangguhkan. Catatan pengawas: "${options?.rejectionReason || 'Lengkapi dokumen NIB dan catatan kas harian'}". Anda dapat mengajukan kembali setelah melengkapi data.`,
        recommendation: isApproved
          ? 'Buka Laporan Siap Bank untuk mengunduh berkas pengajuan kredit dengan stempel kredibilitas resmi.'
          : 'Buka Profil Usaha & Legalitas untuk memperbarui data yang diperlukan.',
        time: 'Baru saja',
        icon: isApproved ? 'verified' : 'warning',
        iconBg: isApproved ? '#ECFDF5' : '#FEF3C7',
        iconColor: isApproved ? '#059669' : '#D97706',
        href: '/profil-usaha',
        actionLabel: isApproved ? 'Lihat Status Profil' : 'Perbaiki Berkas Usaha',
        read: false,
        urgent: true,
      }

      // Store in current user's local notification list if available
      const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('utera_notifs_clean_'))
      allKeys.forEach((key) => {
        if (!key.includes('admin')) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]')
            localStorage.setItem(key, JSON.stringify([notifItem, ...list]))
          } catch {
            // ignore
          }
        }
      })
      window.dispatchEvent(new Event('utera_notifs_updated'))
    } catch (e) {
      console.warn('Could not dispatch user notif:', e)
    }
  }

  return updated
}
