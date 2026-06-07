# GitNews Pro — Template CMS Website Berita Berbasis GitHub

GitNews Pro adalah template portal berita profesional berbasis modul GitCMS. Template ini menggunakan Markdown sebagai sumber konten, GitHub sebagai penyimpanan, dan static site generator bawaan untuk menghasilkan website HTML statis yang ringan.

## Fitur yang Sudah Ditambahkan

- Homepage dengan **Highlight News** di bagian paling atas.
- Layout berita profesional: headline utama, berita samping, berita terbaru, sidebar, dan blok rubrik.
- **Mode terang dan gelap** yang dapat dipilih pengunjung. Pilihan tersimpan di browser menggunakan `localStorage`.
- Blok kategori otomatis berdasarkan `category` pada frontmatter artikel.
- Slot iklan strategis:
  - Header / top banner `970 × 90`
  - Sidebar `300 × 250`
  - Native / tall sidebar `300 × 600`
  - Antar rubrik `728 × 90`
  - Dalam artikel `728 × 90`
  - Arsip kategori/tag
- Mobile friendly.
- SEO-ready: canonical, meta description, Open Graph, Twitter Card, RSS, sitemap, robots.txt, dan JSON-LD `NewsArticle`.
- Admin GitCMS tetap dipertahankan untuk mengelola artikel dari GitHub.

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
```

## Cara Menjalankan Lokal

```bash
npm install
npm run build
npm run serve
```

Hasil build berada di folder `_site/`.

## Cara Mengganti Nama Website

Edit file `config.json`:

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
