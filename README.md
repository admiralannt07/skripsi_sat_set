# Skripsi Sat-Set

Proyek web untuk membantu menyusun ide judul, rumusan masalah, dan kerangka Bab 1 menggunakan Gemini API.

## Prasyarat
- Node.js (disarankan versi LTS 18+)
- API Key Gemini

## Instalasi
1. Clone atau download proyek ini.
2. Masuk ke folder proyek.
3. Instal dependency dari `package.json`:
   - `npm install` (atau `npm.cmd install` di PowerShell yang memblokir skrip)

## Konfigurasi Environment
1. Buat file `.env` berdasarkan contoh:
   - Salin `.env.example` menjadi `.env`
   - Isi nilai API key Anda
   
Contoh `.env`:
```
GEMINI_API_KEY=YOUR_REAL_GEMINI_API_KEY
```

## Menjalankan
- Jalankan server lokal:
  - `npm start`
  - Buka `http://localhost:3000`

## Catatan
- Semua request ke Gemini dilakukan via backend (`server.js`) agar API key tetap aman.
- Server menggunakan port 3000. Ubah di `server.js` jika diperlukan.