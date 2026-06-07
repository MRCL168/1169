# GitNews Pro — Template CMS Website Berita Berbasis GitHub


## Catatan v6 — Slug Artikel di Root Domain

Mulai versi ini, URL artikel dibuat langsung di root domain, misalnya:

```txt
https://bisnis.dimensinews.co.id/strategi-umkm-menjaga-arus-kas/
```

Bukan lagi:

```txt
https://bisnis.dimensinews.co.id/posts/strategi-umkm-menjaga-arus-kas/
```

Perubahan ini otomatis diterapkan ke halaman artikel, link internal, canonical, sitemap.xml, news-sitemap.xml, RSS, Open Graph, dan JSON-LD. File sumber artikel tetap berada di folder `content/posts/` agar admin CMS tetap rapi.


GitNews Pro adalah template portal berita profesional berbasis modul GitCMS. Template ini menggunakan Markdown sebagai sumber konten, GitHub sebagai penyimpanan, dan static site generator bawaan untuk menghasilkan website HTML statis yang ringan.

## Fitur Utama

- Homepage dengan **Highlight News** di bagian paling atas.
- Layout berita profesional: headline utama, berita samping, berita terbaru, sidebar, dan blok rubrik.
- **Mode terang dan gelap** yang dapat dipilih pengunjung. Pilihan tersimpan di browser menggunakan `localStorage`.
- **Manajemen kategori dari admin**: tambah, edit, dan hapus kategori melalui menu **Kategori**.
- Dropdown kategori di editor artikel mengikuti daftar kategori dari `config.json`.
- Halaman arsip kategori tetap dibuat walaupun kategori belum memiliki artikel.
- News ticker bagian paling atas sudah dikunci dengan `text-overflow: ellipsis` agar judul panjang tidak membuat layar melebar.
- Slot iklan strategis:
  - Header / top banner `970 × 90`
  - Sidebar `300 × 250`
  - Native / tall sidebar `300 × 600`
  - Antar rubrik `728 × 90`
  - Dalam artikel `728 × 90`
  - Arsip kategori/tag
- Mobile friendly.
- SEO-ready: canonical, meta description, Open Graph, Twitter Card, RSS, sitemap, robots.txt, dan JSON-LD `NewsArticle`.
- Admin GitCMS tetap dipertahankan untuk mengelola artikel, media, kategori, dan pengaturan situs dari GitHub.

## Struktur Folder Penting

```txt
content/posts/       Artikel berita Markdown
content/pages/       Halaman statis
public/images/       Gambar/media
build/build.js       Static site generator
build/templates.js   Template HTML publik
theme/style.css      CSS tampilan website
theme/site.js        Toggle dark/light mode
admin/               Panel CMS berbasis GitHub API
config.json          Identitas situs, navigasi, kategori, dan pengaturan umum
```

## Cara Menjalankan Lokal

```bash
npm install
npm run build
npm run serve
```

Hasil build berada di folder `_site/`.

## Cara Mengelola Kategori dari Admin

1. Buka halaman `/admin/`.
2. Login menggunakan GitHub Personal Access Token yang punya izin `Contents: Read and write`.
3. Masuk ke menu **Kategori**.
4. Isi **Nama Kategori**, **Slug URL**, dan deskripsi kategori.
5. Klik **Simpan Kategori**.

Kategori disimpan ke bagian `categories` di `config.json`. Setelah tersimpan, GitHub Actions akan membangun ulang situs secara otomatis.

Catatan: jika kategori dihapus, artikel yang sudah memakai kategori tersebut tidak ikut diubah otomatis. Ubah kategori artikel dari editor jika diperlukan.

## Cara Mengganti Nama Website

Edit file `config.json` atau gunakan menu **Pengaturan Situs** di admin:

```json
{
  "title": "Nama Media Anda",
  "tagline": "Tagline media Anda",
  "baseUrl": "https://username.github.io/nama-repo",
  "basePath": "/nama-repo"
}
```

Jika website dipasang di root domain custom, gunakan:

```json
"baseUrl": "https://domainanda.com",
"basePath": ""
```

## Format Artikel

Contoh frontmatter artikel:

```md
---
title: "Judul Berita"
slug: "judul-berita"
date: "2026-06-07"
author: "Redaksi"
category: "Nasional"
tags: [nasional, ekonomi]
featured_image: "/public/images/news-nasional.svg"
excerpt: "Ringkasan singkat berita."
status: "published"
---

Isi artikel ditulis di sini menggunakan Markdown.
```

## Catatan Iklan

Slot iklan saat ini berupa placeholder HTML/CSS. Untuk memasang Google AdSense atau script iklan lain, cari fungsi `adSlot()` di `build/templates.js`, lalu ganti isi markup placeholder sesuai kebutuhan.

## Update v3 — Pengaturan Menu & Iklan HTML

Versi ini menambahkan dua panel baru di admin:

### 1. Menu
Admin dapat menambah, mengedit, menghapus, dan mengatur urutan menu navigasi utama. Data disimpan pada `config.json` bagian `nav`.

Format data menu:

```json
{
  "label": "Nasional",
  "url": "/category/nasional/",
  "order": 2,
  "newTab": false
}
```

### 2. Iklan HTML
Admin dapat mengisi kode iklan HTML pada beberapa slot strategis:

- Header Atas `970×90`
- Sidebar `300×250`
- Native / Sidebar Panjang `300×600`
- Antar Rubrik `728×90`
- Atas Artikel `970×90`
- Dalam Artikel `728×90`
- Arsip / Kategori `970×90`

Data disimpan pada `config.json` bagian `ads`. Jika kode HTML kosong, template akan tetap menampilkan placeholder slot iklan. Jika slot dimatikan, slot tersebut tidak dirender di halaman publik.

Contoh kode iklan manual:

```html
<a href="https://contoh.com" target="_blank" rel="sponsored noopener">
  <img src="/public/images/banner-iklan.jpg" alt="Iklan" style="max-width:100%;height:auto;">
</a>
```

Gunakan hanya kode iklan dari sumber yang dipercaya karena HTML akan dirender apa adanya di halaman publik.

## SEO & Google News

Versi ini sudah menambahkan optimasi teknis untuk indeks Google News:

- `NewsArticle` JSON-LD pada setiap halaman artikel.
- `BreadcrumbList` pada halaman artikel.
- `NewsMediaOrganization`, `WebSite`, dan `ItemList` pada homepage.
- Meta artikel: `article:published_time`, `article:modified_time`, `article:author`, `article:section`, dan `article:tag`.
- `sitemap.xml` reguler untuk semua URL penting.
- `news-sitemap.xml` khusus Google News, otomatis berisi artikel yang diterbitkan dalam 2 hari terakhir.
- `robots.txt` mengarah ke `sitemap.xml` dan `news-sitemap.xml`.
- RSS feed di `rss.xml`.
- Canonical URL, Open Graph, Twitter Card, dan `max-image-preview:large`.

### Pengaturan Google News di Admin

Buka **Admin → Pengaturan Situs → Google News & SEO** untuk mengatur:

- Nama Publikasi Google News.
- Bahasa News Sitemap, contoh `id`.
- Zona waktu artikel, contoh `+07:00`.

Pastikan `Base URL` di admin sudah sesuai domain asli. Jika menggunakan domain sendiri, kosongkan `Base Path`. Jika menggunakan GitHub Pages project seperti `username.github.io/nama-repo`, isi `Base Path` dengan `/nama-repo`.

### Catatan penting

Google News tetap menentukan kelayakan indeks berdasarkan kualitas konten, reputasi situs, akses crawling, dan kepatuhan kebijakan. Template ini menyiapkan fondasi teknis, tetapi tidak menjamin otomatis masuk Google News.

Untuk hasil terbaik, gunakan gambar artikel format JPG/WebP/PNG berukuran besar, bukan hanya placeholder SVG. Google merekomendasikan gambar representatif yang dapat di-crawl dan diindeks.