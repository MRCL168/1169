---
title: "Tentang GitNews Pro"
slug: "about"
excerpt: "Informasi singkat tentang template CMS berita profesional berbasis GitHub."
---

GitNews Pro adalah template website berita profesional berbasis GitHub CMS. Template ini dirancang untuk kebutuhan portal berita, media komunitas, majalah online, blog editorial, hingga publikasi perusahaan yang ingin mengelola konten tanpa database dan tanpa panel server yang rumit.

Konten ditulis dalam format Markdown di folder `content/posts`, kemudian diproses menjadi halaman HTML statis melalui proses build. Karena hasil akhirnya berupa file statis, website menjadi ringan, mudah di-host di GitHub Pages, dan lebih sederhana untuk dirawat.

## Fitur Utama

- Homepage dengan highlight news di bagian paling atas.
- Blok kategori otomatis berdasarkan kategori artikel.
- Mode terang dan gelap yang dapat dipilih oleh pengunjung.
- Slot iklan strategis pada header, sidebar, antar rubrik, arsip, dan halaman artikel.
- Tampilan responsif untuk desktop, tablet, dan mobile.
- Struktur SEO dasar: canonical, meta description, Open Graph, Twitter Card, sitemap, RSS, dan JSON-LD NewsArticle.
- Admin GitCMS untuk menulis, mengedit, menghapus artikel, dan mengelola media melalui GitHub API.

## Cara Mengelola Konten

Masuk ke halaman `/admin/`, hubungkan Personal Access Token GitHub, lalu tentukan repository dan folder konten. Secara default, artikel disimpan pada folder `content/posts`. Setiap artikel memiliki metadata seperti judul, slug, tanggal, kategori, tag, penulis, excerpt, status, dan featured image.

Template ini bisa dikembangkan lagi menjadi portal berita dengan rubrik khusus, halaman redaksi, halaman pedoman media siber, halaman kontak, hingga integrasi iklan pihak ketiga.
