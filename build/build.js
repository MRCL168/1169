/* ============================================================
   build.js — Static Site Generator untuk GitCMS Blog
   Membaca Markdown di content/, merender ke HTML statis lengkap
   dengan SEO, lalu menulis hasil ke folder _site/.

   Dijalankan oleh GitHub Actions setiap ada perubahan konten.
   Jalankan lokal:  npm install && npm run build
   ============================================================ */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");
const T = require("./templates");

/* ---------- Path dasar ---------- */
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_site");
const POSTS_DIR = path.join(ROOT, "content", "posts");
const PAGES_DIR = path.join(ROOT, "content", "pages");

/* ---------- Konfigurasi situs ---------- */
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const U = T.makeUrlHelpers(config);

/* ---------- Setup marked (GitHub Flavored Markdown) ---------- */
marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false });

/* ============================================================
   Util
   ============================================================ */

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writePage(relPath, html) {
  // relPath seperti "posts/slug/" → tulis index.html di dalamnya
  const dir = path.join(OUT, relPath);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

function writeRaw(relFile, content) {
  const full = path.join(OUT, relFile);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, "utf8");
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    fs.readdirSync(src).forEach((item) => {
      copyRecursive(path.join(src, item), path.join(dest, item));
    });
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readingTime(md) {
  const words = stripMarkdown(md).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function makeExcerpt(meta, body) {
  if (meta.excerpt) return meta.excerpt;
  const text = stripMarkdown(body);
  const words = text.split(/\s+/).slice(0, 32).join(" ");
  return words + (text.split(/\s+/).length > 32 ? "…" : "");
}

// YAML/gray-matter mengubah tanggal tanpa kutip (2026-06-05) menjadi objek Date.
// Normalkan kembali ke string ISO "YYYY-MM-DD" agar pengurutan & JSON-LD benar.
function normalizeDate(d) {
  if (!d) return "";
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

// Perbaiki path absolut-root pada HTML hasil render agar sesuai basePath.
// Mengubah src="/..." & href="/..." (bukan "//...") menjadi src="{basePath}/...".
function fixContentUrls(html) {
  const bp = U.basePath;
  if (!bp) return html; // situs di root domain, tidak perlu diubah
  return html.replace(/(\s(?:src|href))="\/(?!\/)/g, `$1="${bp}/`);
}

/* ============================================================
   Baca konten
   ============================================================ */

function readMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(md|markdown)$/i.test(f))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = matter(raw);
      const meta = parsed.data || {};
      const body = parsed.content || "";

      // Normalisasi tags → array
      if (typeof meta.tags === "string") {
        meta.tags = meta.tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
      if (!Array.isArray(meta.tags)) meta.tags = meta.tags ? [meta.tags] : [];

      // Normalisasi tanggal ke string ISO (hindari objek Date dari YAML)
      meta.date = normalizeDate(meta.date);

      const slug = meta.slug || file.replace(/\.(md|markdown)$/i, "");
      const featuredImage = meta.featured_image || "";
      const ogImage = featuredImage ? U.abs(featuredImage) : (config.defaultOgImage ? U.abs(config.defaultOgImage) : "");

      return {
        file,
        slug,
        meta,
        body,
        html: fixContentUrls(marked.parse(body)),
        excerpt: makeExcerpt(meta, body),
        readingTime: readingTime(body),
        featuredImage,
        ogImage,
      };
    });
}

/* ============================================================
   Build
   ============================================================ */

function build() {
  const start = Date.now();
  console.log("→ Membersihkan _site/…");
  fs.rmSync(OUT, { recursive: true, force: true });
  ensureDir(OUT);

  /* ---- Baca posts ---- */
  let posts = readMarkdownFiles(POSTS_DIR);

  // Hanya tampilkan yang published
  posts = posts.filter((p) => String(p.meta.status || "published").toLowerCase() !== "draft");

  // Permalink
  posts.forEach((p) => { p.permalink = "/posts/" + p.slug + "/"; });

  // Urutkan terbaru dulu
  posts.sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));

  console.log(`→ ${posts.length} artikel published ditemukan`);

  /* ---- Halaman artikel ---- */
  posts.forEach((post) => {
    // Artikel terkait: kategori sama, lalu terbaru lainnya
    const related = posts
      .filter((p) => p.slug !== post.slug)
      .sort((a, b) => {
        const sameA = a.meta.category && a.meta.category === post.meta.category ? -1 : 0;
        const sameB = b.meta.category && b.meta.category === post.meta.category ? -1 : 0;
        return sameA - sameB;
      })
      .slice(0, 3);

    writePage("posts/" + post.slug + "/", T.postTemplate({ post, config, U, related, allPosts: posts }));
  });

  /* ---- Beranda + paginasi ---- */
  const perPage = config.postsPerPage || 6;
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));
  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const slice = posts.slice(i * perPage, (i + 1) * perPage);
    const html = T.homeTemplate({ posts: slice, allPosts: posts, pageNum, totalPages, config, U });
    if (pageNum === 1) {
      writePage("", html); // _site/index.html
    } else {
      writePage("page/" + pageNum + "/", html);
    }
  }

  /* ---- Arsip kategori ---- */
  const categories = {};
  posts.forEach((p) => {
    if (p.meta.category) {
      const key = p.meta.category;
      (categories[key] = categories[key] || []).push(p);
    }
  });
  Object.entries(categories).forEach(([term, list]) => {
    writePage("category/" + T.slugify(term) + "/", T.archiveTemplate({ kind: "category", term, posts: list, config, U, allPosts: posts }));
  });
  console.log(`→ ${Object.keys(categories).length} kategori`);

  /* ---- Arsip tag ---- */
  const tags = {};
  posts.forEach((p) => {
    (p.meta.tags || []).forEach((t) => {
      (tags[t] = tags[t] || []).push(p);
    });
  });
  Object.entries(tags).forEach(([term, list]) => {
    writePage("tag/" + T.slugify(term) + "/", T.archiveTemplate({ kind: "tag", term, posts: list, config, U, allPosts: posts }));
  });
  console.log(`→ ${Object.keys(tags).length} tag`);

  /* ---- Halaman statis ---- */
  const pages = readMarkdownFiles(PAGES_DIR);
  pages.forEach((page) => {
    page.permalink = "/" + page.slug + "/";
    writePage(page.slug + "/", T.pageTemplate({ page, config, U, allPosts: posts }));
  });
  console.log(`→ ${pages.length} halaman statis`);

  /* ---- 404 ---- */
  writeRaw("404.html", T.notFoundTemplate({ config, U, allPosts: posts }));

  /* ---- sitemap.xml ---- */
  buildSitemap(posts, pages, categories, tags);

  /* ---- rss.xml ---- */
  buildRss(posts);

  /* ---- robots.txt ---- */
  writeRaw("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${U.abs("/sitemap.xml")}\n`);

  /* ---- Salin aset statis ---- */
  console.log("→ Menyalin aset (theme, admin, media)…");
  copyRecursive(path.join(ROOT, "theme"), path.join(OUT, "theme"));
  copyRecursive(path.join(ROOT, "admin"), path.join(OUT, "admin"));
  copyRecursive(path.join(ROOT, "public"), path.join(OUT, "public"));
  // .nojekyll agar GitHub Pages tidak memproses ulang dengan Jekyll
  writeRaw(".nojekyll", "");

  const secs = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n✓ Build selesai dalam ${secs}s → ${OUT}`);
}

/* ============================================================
   Sitemap & RSS
   ============================================================ */

function buildSitemap(posts, pages, categories, tags) {
  const urls = [];
  const add = (loc, lastmod, priority) => {
    urls.push(
      `  <url>\n    <loc>${T.esc(loc)}</loc>` +
      (lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "") +
      `\n    <priority>${priority}</priority>\n  </url>`
    );
  };

  add(U.abs("/"), null, "1.0");
  posts.forEach((p) => add(U.abs(p.permalink), p.meta.date || null, "0.8"));
  pages.forEach((p) => add(U.abs(p.permalink), null, "0.5"));
  Object.keys(categories).forEach((c) => add(U.abs("/category/" + T.slugify(c) + "/"), null, "0.5"));
  Object.keys(tags).forEach((t) => add(U.abs("/tag/" + T.slugify(t) + "/"), null, "0.4"));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
  writeRaw("sitemap.xml", xml);
}

function buildRss(posts) {
  const items = posts
    .slice(0, 20)
    .map((p) => {
      const pubDate = p.meta.date ? new Date(p.meta.date).toUTCString() : new Date().toUTCString();
      return `    <item>
      <title>${T.esc(p.meta.title)}</title>
      <link>${T.esc(U.abs(p.permalink))}</link>
      <guid>${T.esc(U.abs(p.permalink))}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${T.esc(p.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${T.esc(config.title)}</title>
    <link>${T.esc(U.baseUrl)}/</link>
    <description>${T.esc(config.description)}</description>
    <language>${T.esc(config.language || "id")}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
  writeRaw("rss.xml", xml);
}

/* ---------- Jalankan ---------- */
try {
  build();
} catch (err) {
  console.error("\n✗ Build gagal:", err);
  process.exit(1);
}
