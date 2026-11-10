export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profil_usaha: {
        Row: {
          id: string
          user_id: string
          nama_usaha: string
          nama_pemilik: string | null
          jenis_usaha: string | null
          tanggal_mulai_usaha: string | null
          alamat_usaha: string | null
          nomor_telepon: string | null
          deskripsi_usaha: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nama_usaha: string
          nama_pemilik?: string | null
          jenis_usaha?: string | null
          tanggal_mulai_usaha?: string | null
          alamat_usaha?: string | null
          nomor_telepon?: string | null
          deskripsi_usaha?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nama_usaha?: string
          nama_pemilik?: string | null
          jenis_usaha?: string | null
          tanggal_mulai_usaha?: string | null
          alamat_usaha?: string | null
          nomor_telepon?: string | null
          deskripsi_usaha?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaksi_kas: {
        Row: {
          id: string
          user_id: string
          profil_id: string | null
          tipe: 'pemasukan' | 'pengeluaran'
          nominal: number
          kategori: string
          tanggal: string
          keterangan: string | null
          metode_pembayaran: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          profil_id?: string | null
          tipe: 'pemasukan' | 'pengeluaran'
          nominal: number
          kategori: string
          tanggal?: string
          keterangan?: string | null
          metode_pembayaran?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profil_id?: string | null
          tipe?: 'pemasukan' | 'pengeluaran'
          nominal?: number
          kategori?: string
          tanggal?: string
          keterangan?: string | null
          metode_pembayaran?: string | null
          created_at?: string
        }
        Relationships: []
      }
      legalitas_dokumen: {
        Row: {
          id: string
          user_id: string
          profil_id: string | null
          kategori: string
          nama_dokumen: string
          nomor_dokumen: string | null
          tanggal_terbit: string | null
          masa_berlaku: string | null
          file_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          profil_id?: string | null
          kategori: string
          nama_dokumen: string
          nomor_dokumen?: string | null
          tanggal_terbit?: string | null
          masa_berlaku?: string | null
          file_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profil_id?: string | null
          kategori?: string
          nama_dokumen?: string
          nomor_dokumen?: string | null
          tanggal_terbit?: string | null
          masa_berlaku?: string | null
          file_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      simulasi_kur: {
        Row: {
          id: string
          user_id: string
          profil_id: string | null
          program: string
          plafon: number
          bunga_tahunan: number
          tenor_bulan: number
          angsuran_bulanan: number
          rasio_kas: number | null
          status_guardrail: string | null
          catatan: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          profil_id?: string | null
          program: string
          plafon: number
          bunga_tahunan: number
          tenor_bulan: number
          angsuran_bulanan: number
          rasio_kas?: number | null
          status_guardrail?: string | null
          catatan?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profil_id?: string | null
          program?: string
          plafon?: number
          bunga_tahunan?: number
          tenor_bulan?: number
          angsuran_bulanan?: number
          rasio_kas?: number | null
          status_guardrail?: string | null
          catatan?: string | null
          created_at?: string
        }
        Relationships: []
      }
      skor_kelayakan: {
        Row: {
          id: string
          user_id: string
          profil_id: string | null
          skor: number
          kategori: string
          omzet_bulanan: number
          laba_bersih: number
          margin_profit: number
          konsistensi_bulan: number
          catatan: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          profil_id?: string | null
          skor: number
          kategori: string
          omzet_bulanan?: number
          laba_bersih?: number
          margin_profit?: number
          konsistensi_bulan?: number
          catatan?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          profil_id?: string | null
          skor?: number
          kategori?: string
          omzet_bulanan?: number
          laba_bersih?: number
          margin_profit?: number
          konsistensi_bulan?: number
          catatan?: string | null
          created_at?: string
        }
        Relationships: []
      }
      verifikasi_usaha: {
        Row: {
          id: string
          user_id: string
          profil_id: string
          nama_usaha: string
          nama_pemilik: string | null
          nomor_telepon: string | null
          jenis_usaha: string | null
          jenis_pengajuan: string
          catatan: string | null
          punya_nib: boolean
          nomor_nib: string | null
          total_transaksi: number
          skor: number
          status: string
          alasan_penolakan: string | null
          catatan_admin: string | null
          nomor_sertifikat: string | null
          ditinjau_oleh: string | null
          ditinjau_pada: string | null
          diajukan_pada: string
        }
        Insert: {
          id?: string
          user_id?: string
          profil_id: string
          nama_usaha: string
          nama_pemilik?: string | null
          nomor_telepon?: string | null
          jenis_usaha?: string | null
          jenis_pengajuan: string
          catatan?: string | null
          punya_nib?: boolean
          nomor_nib?: string | null
          total_transaksi?: number
          skor?: number
          status?: string
          alasan_penolakan?: string | null
          catatan_admin?: string | null
          nomor_sertifikat?: string | null
          ditinjau_oleh?: string | null
          ditinjau_pada?: string | null
          diajukan_pada?: string
        }
        Update: {
          id?: string
          user_id?: string
          profil_id?: string
          nama_usaha?: string
          nama_pemilik?: string | null
          nomor_telepon?: string | null
          jenis_usaha?: string | null
          jenis_pengajuan?: string
          catatan?: string | null
          punya_nib?: boolean
          nomor_nib?: string | null
          total_transaksi?: number
          skor?: number
          status?: string
          alasan_penolakan?: string | null
          catatan_admin?: string | null
          nomor_sertifikat?: string | null
          ditinjau_oleh?: string | null
          ditinjau_pada?: string | null
          diajukan_pada?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

