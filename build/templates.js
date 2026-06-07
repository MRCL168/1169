/* ============================================================
   templates.js — Tema berita profesional untuk GitCMS News
   Fitur: highlight news, blok kategori, slot iklan, mode terang/gelap,
   SEO meta, Open Graph, Twitter Card, JSON-LD, RSS, kategori & tag.
   ============================================================ */

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function attr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function makeUrlHelpers(config) {
  const basePath = (config.basePath || "").replace(/\/+$/, "");
  const baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
  return {
    url: (p) => {
      const clean = "/" + String(p || "").replace(/^\/+/, "");
      return (basePath + clean).replace(/\/{2,}/g, "/").replace(":/", "://");
    },
    abs: (p) => {
      const clean = "/" + String(p || "").replace(/^\/+/, "");
      return baseUrl + clean.replace(/\/{2,}/g, "/");
    },
    basePath,
    baseUrl,
  };
}

function isExternalAsset(path) {
  return /^(https?:)?\/\//i.test(String(path || "")) || String(path || "").startsWith("data:");
}

function assetUrl(path, U) {
  if (!path) return "";
  return isExternalAsset(path) ? String(path) : U.url(path);
}

function assetAbs(path, U) {
  if (!path) return "";
  return isExternalAsset(path) ? String(path) : U.abs(path);
}

function safeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function renderJsonLd(jsonLd) {
  if (!jsonLd) return "";
  const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  return items
    .filter(Boolean)
    .map((item) => {
      const content = typeof item === "string" ? item : safeJsonLd(item);
      return `\n  <script type="application/ld+json">${content}</script>`;
    })
    .join("");
}

function siteIdentity(config = {}, U) {
  const publisher = {
    "@type": "NewsMediaOrganization",
    "@id": U.abs("/#organization"),
    name: config.title,
    url: U.baseUrl + "/",
  };
  if (config.logo) {
    publisher.logo = {
      "@type": "ImageObject",
      url: assetAbs(config.logo, U),
    };
  }
  return publisher;
}

function isoDateTime(dateValue, config = {}) {
  if (!dateValue) return "";
  const raw = String(dateValue);
  if (/T\d{2}:\d{2}/.test(raw)) return raw;
  const offset = config.timezoneOffset || "+07:00";
  return raw.slice(0, 10) + "T00:00:00" + offset;
}

function siteNav(config, U) {
  return (config.nav || [])
    .filter((n) => n && n.label && n.url)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((n) => {
      const isExternal = /^https?:\/\//i.test(String(n.url));
      const href = isExternal ? n.url : U.url(n.url);
      const target = n.newTab ? ' target="_blank" rel="noopener sponsored"' : '';
      return `<a href="${attr(href)}"${target}>${esc(n.label)}</a>`;
    })
    .join("");
}

function normalizeCategories(config = {}, posts = []) {
  const seen = new Set();
  const list = [];
  const add = (item) => {
    const name = typeof item === "string" ? item : (item && item.name);
    if (!name) return;
    const cleanName = String(name).trim();
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const rawSlug = typeof item === "object" && item && item.slug ? item.slug : cleanName;
    list.push({
      name: cleanName,
      slug: slugify(rawSlug),
      description: typeof item === "object" && item && item.description ? String(item.description) : "",
    });
  };

  (config.categories || []).forEach(add);

  // Fallback: jika config lama belum punya categories, ambil dari artikel.
  if (!list.length) {
    posts.forEach((p) => p.meta && p.meta.category && add(p.meta.category));
  }

  return list;
}

function categorySlug(name, config = {}) {
  const target = String(name || "").trim().toLowerCase();
  const found = normalizeCategories(config).find((c) => c.name.toLowerCase() === target);
  return found ? found.slug : slugify(name);
}

function categoryUrl(name, U, config = {}) {
  return U.url('/category/' + categorySlug(name, config) + '/');
}

function categoryDescription(name, config = {}) {
  const target = String(name || "").trim().toLowerCase();
  const found = normalizeCategories(config).find((c) => c.name.toLowerCase() === target);
  return found ? found.description : "";
}

function categoryNav(posts, U, limit = 7, config = {}) {
  const counts = {};
  posts.forEach((p) => {
    if (p.meta.category) counts[p.meta.category] = (counts[p.meta.category] || 0) + 1;
  });

  let cats = normalizeCategories(config, posts);
  if (!cats.length) {
    cats = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
      .map((name) => ({ name, slug: slugify(name), description: "" }));
  }

  return cats
    .slice(0, limit)
    .map((cat) => `<a href="${attr(U.url('/category/' + cat.slug + '/'))}">${esc(cat.name)}</a>`)
    .join("");
}

function socialLinks(config) {
  const s = config.social || {};
  const items = [];
  if (s.twitter) items.push(`<a href="https://twitter.com/${attr(s.twitter)}" aria-label="Twitter" rel="me noopener">X</a>`);
  if (s.github) items.push(`<a href="https://github.com/${attr(s.github)}" aria-label="GitHub" rel="me noopener">GitHub</a>`);
  if (s.instagram) items.push(`<a href="https://instagram.com/${attr(s.instagram)}" aria-label="Instagram" rel="me noopener">Instagram</a>`);
  if (s.linkedin) items.push(`<a href="https://linkedin.com/in/${attr(s.linkedin)}" aria-label="LinkedIn" rel="me noopener">LinkedIn</a>`);
  if (s.email) items.push(`<a href="mailto:${attr(s.email)}" aria-label="Email">Email</a>`);
  return items.length ? `<div class="social-links">${items.join("")}</div>` : "";
}

function header(config, U, posts = []) {
  const latest = posts && posts.length ? posts[0] : null;
  const ticker = latest
    ? `<a class="ticker-link" href="${attr(U.url(latest.permalink))}">${esc(latest.meta.title)}</a>`
    : `<span class="ticker-link">Update berita terbaru hari ini</span>`;
  const logoImg = config.logo
    ? `<img class="site-logo-img" src="${attr(assetUrl(config.logo, U))}" alt="${attr(config.title)}">`
    : `<span class="site-logo-mark">${esc((config.title || 'G').trim().charAt(0).toUpperCase())}</span>`;
  return `
  <header class="site-header">
    <div class="top-strip">
      <div class="container top-strip-inner">
        <div class="breaking"><span class="breaking-label">Terbaru</span>${ticker}</div>
        <div class="top-actions">
          <a href="${attr(U.url('/rss.xml'))}">RSS</a>
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Ganti mode terang atau gelap" aria-pressed="false"><span class="toggle-icon">◐</span><span class="toggle-text">Mode</span></button>
        </div>
      </div>
    </div>
    <div class="main-header">
      <div class="container header-inner">
        <a href="${attr(U.url('/'))}" class="site-logo" aria-label="${attr(config.title)}">
          ${logoImg}
          <span class="site-logo-text"><strong>${esc(config.title)}</strong><small>${esc(config.tagline || '')}</small></span>
        </a>
        <nav class="site-nav" aria-label="Navigasi utama">${siteNav(config, U)}</nav>
      </div>
    </div>
    <div class="category-bar">
      <div class="container category-bar-inner">
        ${categoryNav(posts, U, 12, config) || `<a href="${attr(U.url('/'))}">Berita Utama</a>`}
      </div>
    </div>
  </header>`;
}

function renderFooterCopyright(config = {}) {
  const year = String(new Date().getFullYear());
  const footer = config.footer && typeof config.footer === "object" ? config.footer : {};
  const fallback = config.footerText || `© {year} {title}. Semua hak cipta dilindungi.`;
  return String(footer.copyright || fallback)
    .replace(/\{year\}/g, year)
    .replace(/\{title\}/g, config.title || "")
    .replace(/\{author\}/g, config.author || config.title || "");
}

function footer(config, U, posts = []) {
  const footerCfg = config.footer && typeof config.footer === "object" ? config.footer : {};
  const footerLogo = footerCfg.logo || config.footerLogo || config.logo || "";
  const footerDesc = footerCfg.description || config.footerDescription || config.description || config.tagline || "";
  const logoMarkup = footerLogo
    ? `<img class="footer-logo-img" src="${attr(assetUrl(footerLogo, U))}" alt="${attr(config.title)}">`
    : `<span class="footer-logo-mark">${esc((config.title || 'G').trim().charAt(0).toUpperCase())}</span>`;
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <a href="${attr(U.url('/'))}" class="footer-brand" aria-label="${attr(config.title)}">
          ${logoMarkup}
          <span class="footer-title">${esc(config.title)}</span>
        </a>
        <p class="footer-desc">${esc(footerDesc)}</p>
        ${socialLinks(config)}
      </div>
      <div>
        <h3>Rubrik</h3>
        <div class="footer-links">${categoryNav(posts, U, 10, config) || siteNav(config, U)}</div>
      </div>
      <div>
        <h3>Redaksi</h3>
        <div class="footer-links">
          <a href="${attr(U.url('/about/'))}">Tentang Kami</a>
          <a href="${attr(U.url('/admin/'))}">Kelola Konten</a>
          <a href="${attr(U.url('/sitemap.xml'))}">Sitemap</a>
        </div>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>${esc(renderFooterCopyright(config))}</span>
      <span>Powered by GitCMS News</span>
    </div>
  </footer>`;
}

function baseLayout(opts) {
  const { config, U } = opts;
  const posts = opts.allPosts || [];
  const siteName = esc(config.title);
  const title = opts.title ? `${esc(opts.title)} — ${siteName}` : siteName;
  const desc = attr(opts.description || config.description || "");
  const canonical = attr(opts.canonical || U.baseUrl + "/");
  const ogType = opts.ogType || "website";
  const ogImage = opts.ogImage ? attr(opts.ogImage) : (config.defaultOgImage ? attr(assetAbs(config.defaultOgImage, U)) : "");
  const faviconTag = config.favicon ? `
  <link rel="icon" href="${attr(assetUrl(config.favicon, U))}">
  <link rel="shortcut icon" href="${attr(assetUrl(config.favicon, U))}">` : "";
  const jsonLd = renderJsonLd(opts.jsonLd);
  const ogImageAlt = attr(opts.ogImageAlt || opts.title || config.title);
  const ogImageTags = ogImage
    ? `\n  <meta property="og:image" content="${ogImage}">\n  <meta property="og:image:alt" content="${ogImageAlt}">\n  <meta name="twitter:image" content="${ogImage}">\n  <meta name="twitter:image:alt" content="${ogImageAlt}">`
    : "";
  const articleMeta = opts.articleMeta || null;
  const articleMetaTags = articleMeta ? `
  <meta property="article:published_time" content="${attr(articleMeta.publishedTime || '')}">
  <meta property="article:modified_time" content="${attr(articleMeta.modifiedTime || articleMeta.publishedTime || '')}">
  <meta property="article:author" content="${attr(articleMeta.author || config.author || '')}">
  ${articleMeta.section ? `<meta property="article:section" content="${attr(articleMeta.section)}">` : ''}
  ${(articleMeta.tags || []).map((tag) => `<meta property="article:tag" content="${attr(tag)}">`).join("\n  ")}` : "";

  return `<!DOCTYPE html>
<html lang="${attr(config.language || 'id')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="theme-color" content="#0f172a">${faviconTag}${articleMetaTags}

  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${attr(opts.title || config.title)}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="${attr((config.language || 'id') === 'id' ? 'id_ID' : config.language)}">${ogImageTags}

  <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${attr(opts.title || config.title)}">
  <meta name="twitter:description" content="${desc}">

  <link rel="alternate" type="application/rss+xml" title="${siteName}" href="${attr(U.abs('/rss.xml'))}">
  <link rel="sitemap" type="application/xml" title="Sitemap" href="${attr(U.abs('/sitemap.xml'))}">
  <link rel="sitemap" type="application/xml" title="Google News Sitemap" href="${attr(U.abs('/news-sitemap.xml'))}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap" rel="stylesheet">
  <script>(function(){try{var t=localStorage.getItem('gitcms-news-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();</script>
  <link rel="stylesheet" href="${attr(U.url('/theme/style.css'))}">${jsonLd}
</head>
<body>
${header(config, U, posts)}
  <main class="site-main">
${opts.content}
  </main>
${footer(config, U, posts)}
<script src="${attr(U.url('/theme/site.js'))}" defer></script>
</body>
</html>`;
}

function getAdSlotConfig(config = {}, key, fallbackName, fallbackSize) {
  const ads = config.ads || {};
  const slots = ads.slots || {};
  const slot = slots[key] || {};
  return {
    globalEnabled: ads.enabled !== false,
    enabled: slot.enabled !== false,
    label: slot.label || fallbackName,
    size: slot.size || fallbackSize,
    html: typeof slot.html === "string" ? slot.html.trim() : "",
  };
}

function adSlot(key, name, size = "970 × 90", extraClass = "", config = {}) {
  const slot = getAdSlotConfig(config, key, name, size);
  if (!slot.globalEnabled || !slot.enabled) return "";
  if (slot.html) {
    return `<aside class="ad-slot ad-custom ${extraClass}" aria-label="Slot iklan ${attr(slot.label)}"><div class="ad-slot-inner">${slot.html}</div></aside>`;
  }
  return `<aside class="ad-slot ${extraClass}" aria-label="Slot iklan ${attr(slot.label)}"><span>Advertisement</span><strong>${esc(slot.label)}</strong><small>${esc(slot.size)}</small></aside>`;
}

function truthy(value) {
  if (value === true) return true;
  const v = String(value == null ? "" : value).trim().toLowerCase();
  return ["true", "1", "yes", "y", "on"].includes(v);
}

function postImage(post, U, className = "") {
  if (post.featuredImage) {
    return `<img src="${attr(assetUrl(post.featuredImage, U))}" alt="${attr(post.meta.title)}" loading="lazy">`;
  }
  const letter = (post.meta.category || post.meta.title || "N").trim().charAt(0).toUpperCase();
  return `<div class="thumb-placeholder ${className}"><span>${esc(letter)}</span></div>`;
}

function metaLine(post, config, withRead = true) {
  return `<div class="meta-line"><time datetime="${attr(post.meta.date)}">${esc(formatDate(post.meta.date, config.language))}</time>${withRead ? `<span>•</span><span>${post.readingTime} menit baca</span>` : ""}</div>`;
}

function categoryPill(post, U, config = {}, className = "") {
  if (!post.meta.category) return "";
  return `<a class="category-pill ${className}" href="${attr(categoryUrl(post.meta.category, U, config))}">${esc(post.meta.category)}</a>`;
}

function featureCard(post, config, U) {
  if (!post) return "";
  return `<article class="feature-card feature-card-premium">
    <a class="feature-image" href="${attr(U.url(post.permalink))}" aria-label="${attr(post.meta.title)}">${postImage(post, U)}</a>
    <div class="feature-shade"></div>
    <div class="feature-content">
      <div class="feature-label-row">${categoryPill(post, U, config)}<span>Headline Utama</span></div>
      <h1><a href="${attr(U.url(post.permalink))}">${esc(post.meta.title)}</a></h1>
      <p>${esc(post.excerpt)}</p>
      ${metaLine(post, config)}
    </div>
  </article>`;
}

function compactHeadline(post, config, U) {
  if (!post) return "";
  return `<article class="compact-headline">
    <a class="compact-thumb" href="${attr(U.url(post.permalink))}">${postImage(post, U)}</a>
    <div>
      ${categoryPill(post, U, config, 'tiny')}
      <h2><a href="${attr(U.url(post.permalink))}">${esc(post.meta.title)}</a></h2>
      ${metaLine(post, config, false)}
    </div>
  </article>`;
}

function postCard(post, config, U, style = "") {
  return `<article class="post-card ${style}">
    <a class="card-thumb" href="${attr(U.url(post.permalink))}">${postImage(post, U)}</a>
    <div class="card-body">
      ${categoryPill(post, U, config)}
      <h2 class="card-title"><a href="${attr(U.url(post.permalink))}">${esc(post.meta.title)}</a></h2>
      <p class="card-excerpt">${esc(post.excerpt)}</p>
      ${metaLine(post, config)}
    </div>
  </article>`;
}

function textList(posts, config, U, title = "Berita Terbaru") {
  if (!posts.length) return "";
  return `<section class="sidebar-box">
    <h2>${esc(title)}</h2>
    <div class="text-news-list">
      ${posts.map((p) => `<a href="${attr(U.url(p.permalink))}"><span>${esc(p.meta.title)}</span><small>${esc(formatDate(p.meta.date, config.language))}</small></a>`).join("")}
    </div>
  </section>`;
}

function normalizeHomepageCategoryBlocks(config = {}, posts = []) {
  const homepage = config.homepage && typeof config.homepage === "object" ? config.homepage : {};
  const rawBlocks = Array.isArray(homepage.categoryBlocks) ? homepage.categoryBlocks : [];
  const cats = normalizeCategories(config, posts);
  const byName = new Map(cats.map((cat) => [cat.name.toLowerCase(), cat]));
  const bySlug = new Map(cats.map((cat) => [cat.slug, cat]));

  const normalizeBlock = (item, index) => {
    if (!item || typeof item !== "object") return null;
    const rawCategory = String(item.category || item.name || item.slug || "").trim();
    if (!rawCategory) return null;
    const found = byName.get(rawCategory.toLowerCase()) || bySlug.get(slugify(rawCategory));
    const categoryName = found ? found.name : rawCategory;
    return {
      category: categoryName,
      slug: found ? found.slug : slugify(rawCategory),
      title: String(item.title || "").trim() || categoryName,
      enabled: item.enabled !== false,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      limit: Math.min(12, Math.max(1, parseInt(item.limit, 10) || 5)),
    };
  };

  if (rawBlocks.length) {
    return rawBlocks.map(normalizeBlock).filter(Boolean).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  return cats.slice(0, 6).map((cat, index) => ({
    category: cat.name,
    slug: cat.slug,
    title: cat.name,
    enabled: true,
    order: index + 1,
    limit: 5,
  }));
}

function getCategoryGroups(posts, limit = 6, config = {}) {
  const map = new Map();
  posts.forEach((post) => {
    const catName = post.meta.category || "Berita";
    const catSlug = categorySlug(catName, config);
    const keys = [catName.toLowerCase(), catSlug];
    keys.forEach((key) => {
      if (!map.has(key)) map.set(key, { name: catName, slug: catSlug, list: [] });
      map.get(key).list.push(post);
    });
  });

  const configuredBlocks = normalizeHomepageCategoryBlocks(config, posts).filter((block) => block.enabled !== false);
  if (configuredBlocks.length) {
    return configuredBlocks
      .map((block) => {
        const found = map.get(String(block.category || "").toLowerCase()) || map.get(block.slug);
        const list = found ? found.list.slice(0, block.limit || 5) : [];
        return { name: block.category, title: block.title || block.category, slug: block.slug, list, limit: block.limit || 5 };
      })
      .filter((group) => group.list.length)
      .slice(0, limit);
  }

  const ordered = [];
  const seen = new Set();
  normalizeCategories(config, posts).forEach((cat) => {
    const found = map.get(cat.name.toLowerCase()) || map.get(cat.slug);
    if (found && !seen.has(cat.slug)) {
      seen.add(cat.slug);
      ordered.push({ name: cat.name, title: cat.name, slug: cat.slug, list: found.list });
    }
  });

  Array.from(map.values())
    .filter((entry) => !seen.has(entry.slug))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name))
    .forEach((entry) => ordered.push({ name: entry.name, title: entry.name, slug: entry.slug, list: entry.list }));

  return ordered.slice(0, limit);
}

function categoryBlock(group, config, U, index) {
  const [lead, ...rest] = group.list;
  if (!lead) return "";
  return `<section class="category-section">
    <div class="section-heading">
      <div><span>Rubrik</span><h2>${esc(group.title || group.name)}</h2></div>
      <a href="${attr(U.url('/category/' + (group.slug || categorySlug(group.name, config)) + '/'))}">Lihat semua</a>
    </div>
    <div class="category-layout">
      ${postCard(lead, config, U, 'category-lead')}
      <div class="category-list">
        ${rest.slice(0, 4).map((p) => compactHeadline(p, config, U)).join("")}
        ${rest.length === 0 ? `<p class="empty-note">Tambahkan artikel lain pada kategori ini melalui admin GitCMS.</p>` : ""}
      </div>
    </div>
    ${index === 1 ? adSlot('betweenCategories', 'Slot Iklan Antar Rubrik', '728 × 90', 'ad-between', config) : ''}
  </section>`;
}

function homeTemplate({ posts, allPosts, pageNum, totalPages, config, U }) {
  const fullList = allPosts && allPosts.length ? allPosts : posts;
  const isFirst = pageNum === 1;

  if (!isFirst) {
    const cards = posts.map((p) => postCard(p, config, U)).join("");
    return baseLayout({
      config, U, allPosts: fullList,
      title: `Berita — Halaman ${pageNum}`,
      description: `Kumpulan berita halaman ${pageNum}.`,
      canonical: U.abs('/page/' + pageNum + '/'),
      content: `
      <section class="page-head"><div class="container"><span>Arsip Berita</span><h1>Halaman ${pageNum}</h1></div></section>
      <section class="container archive-grid-wrap"><div class="post-grid">${cards}</div>${pagination(pageNum, totalPages, U)}</section>`,
    });
  }

  const highlightList = fullList.filter((post) => truthy(post.meta.highlight));
  const featured = highlightList[0] || null;
  const secondary = highlightList.slice(1, 4);
  const latest = fullList.slice(0, 8);
  const groups = getCategoryGroups(fullList, 12, config);

  const content = `
    ${adSlot('header', 'Slot Iklan Header', '970 × 90', 'ad-top', config)}
    ${featured ? `<section class="container home-hero">
      <div class="hero-kicker">
        <div><span>Highlight News</span><h2>Berita Pilihan Redaksi</h2></div>
        <p>Hanya artikel yang dicentang sebagai Berita Pilihan dari admin yang tampil di area ini.</p>
      </div>
      <div class="highlight-grid">
        ${featureCard(featured, config, U)}
        <div class="highlight-side">
          <div class="highlight-side-title">Pilihan Lainnya</div>
          ${secondary.length ? secondary.map((p) => compactHeadline(p, config, U)).join("") : `<p class="empty-note">Tambahkan artikel pilihan lain dengan mencentang Highlight News di editor artikel.</p>`}
        </div>
      </div>
    </section>` : ""}

    <section class="container content-layout">
      <div class="main-column">
        <div class="section-heading"><div><span>Update</span><h2>Berita Terbaru</h2></div><a href="${attr(U.url('/page/2/'))}">Arsip</a></div>
        <div class="latest-grid">${latest.map((p) => postCard(p, config, U)).join("")}</div>
        ${pagination(pageNum, totalPages, U)}
      </div>
      <aside class="sidebar-column">
        ${adSlot('sidebar', 'Slot Iklan Sidebar', '300 × 250', 'ad-sidebar', config)}
        ${textList(fullList.slice(0, 6), config, U, 'Terpopuler')}
        ${adSlot('native', 'Slot Iklan Native', '300 × 600', 'ad-sidebar tall', config)}
      </aside>
    </section>

    <section class="container category-blocks">
      ${groups.map((g, i) => categoryBlock(g, config, U, i)).join("")}
    </section>`;

  const publisher = siteIdentity(config, U);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      ...publisher,
      description: config.description,
      inLanguage: config.language || "id",
      sameAs: Object.values(config.social || {}).filter((v) => typeof v === "string" && /^https?:\/\//i.test(v)),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": U.abs("/#website"),
      name: config.title,
      url: U.baseUrl + "/",
      inLanguage: config.language || "id",
      publisher: { "@id": U.abs("/#organization") },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": U.abs("/#latest-news"),
      name: "Berita terbaru",
      itemListElement: fullList.slice(0, 10).map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: U.abs(post.permalink),
        name: post.meta.title,
      })),
    },
  ];

  return baseLayout({
    config, U, allPosts: fullList,
    title: "",
    description: config.description,
    canonical: U.baseUrl + "/",
    ogType: "website",
    jsonLd,
    content,
  });
}

function pagination(pageNum, totalPages, U) {
  if (totalPages <= 1) return "";
  const prev = pageNum > 1
    ? `<a class="page-link" href="${attr(U.url(pageNum === 2 ? '/' : '/page/' + (pageNum - 1) + '/'))}">← Sebelumnya</a>`
    : `<span class="page-link disabled">← Sebelumnya</span>`;
  const next = pageNum < totalPages
    ? `<a class="page-link" href="${attr(U.url('/page/' + (pageNum + 1) + '/'))}">Berikutnya →</a>`
    : `<span class="page-link disabled">Berikutnya →</span>`;
  return `<nav class="pagination">${prev}<span>Halaman ${pageNum} dari ${totalPages}</span>${next}</nav>`;
}

function injectAd(html, config = {}) {
  let count = 0;
  return html.replace(/<\/p>/g, (m) => {
    count += 1;
    if (count === 3) return m + adSlot('postContent', 'Slot Iklan Dalam Artikel', '728 × 90', 'ad-in-content', config);
    return m;
  });
}

function postTemplate({ post, config, U, related, allPosts }) {
  const tags = Array.isArray(post.meta.tags) && post.meta.tags.length
    ? `<div class="post-tags">${post.meta.tags.map((t) => `<a href="${attr(U.url('/tag/' + slugify(t) + '/'))}">#${esc(t)}</a>`).join("")}</div>`
    : "";

  const relatedHtml = related && related.length
    ? `<section class="related-section"><div class="container"><div class="section-heading"><div><span>Baca Juga</span><h2>Artikel Terkait</h2></div></div><div class="related-grid">${related.map((p) => postCard(p, config, U)).join("")}</div></div></section>`
    : "";

  const content = `
    ${adSlot('postTop', 'Slot Iklan Atas Artikel', '970 × 90', 'ad-top', config)}
    <article class="post-detail">
      <div class="container post-head-wrap">
        <header class="post-header">
          ${categoryPill(post, U, config)}
          <h1>${esc(post.meta.title)}</h1>
          <p>${esc(post.excerpt)}</p>
          <div class="post-byline">
            ${post.meta.author ? `<span>Oleh <strong>${esc(post.meta.author)}</strong></span><span>•</span>` : ""}
            <time datetime="${attr(post.meta.date)}">${esc(formatDate(post.meta.date, config.language))}</time><span>•</span><span>${post.readingTime} menit baca</span>
          </div>
        </header>
      </div>
      <figure class="post-cover">${postImage(post, U)}</figure>
      <div class="container article-layout">
        <div class="article-main">
          <div class="post-content">${injectAd(post.html, config)}</div>
          ${tags}
        </div>
        <aside class="article-sidebar">
          ${adSlot('sidebar', 'Slot Iklan Artikel', '300 × 250', 'ad-sidebar', config)}
          ${textList((allPosts || []).filter((p) => p.slug !== post.slug).slice(0, 5), config, U, 'Berita Pilihan')}
        </aside>
      </div>
    </article>
    ${relatedHtml}`;

  const postTags = Array.isArray(post.meta.tags) ? post.meta.tags.filter(Boolean) : [];
  const keywordSeen = new Set();
  const keywordList = [post.meta.category, ...postTags].filter(Boolean).filter((item) => {
    const key = String(item).toLowerCase();
    if (keywordSeen.has(key)) return false;
    keywordSeen.add(key);
    return true;
  });
  const publisher = siteIdentity(config, U);
  const articleImage = post.ogImage ? [post.ogImage] : [];
  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": U.abs(post.permalink) + "#article",
    headline: post.meta.title,
    alternativeHeadline: post.meta.subtitle || undefined,
    description: post.excerpt,
    url: U.abs(post.permalink),
    mainEntityOfPage: { "@type": "WebPage", "@id": U.abs(post.permalink) },
    isPartOf: { "@id": U.abs("/#website") },
    datePublished: isoDateTime(post.meta.date, config),
    dateModified: isoDateTime(post.meta.updated || post.meta.date, config),
    author: [{ "@type": "Person", name: post.meta.author || config.author || "Redaksi" }],
    publisher,
    articleSection: post.meta.category || undefined,
    keywords: keywordList.length ? keywordList.join(", ") : undefined,
    wordCount: post.wordCount || undefined,
    inLanguage: config.language || "id",
    ...(articleImage.length ? { image: articleImage, thumbnailUrl: articleImage[0] } : {}),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: U.baseUrl + "/" },
      ...(post.meta.category ? [{ "@type": "ListItem", position: 2, name: post.meta.category, item: U.abs('/category/' + categorySlug(post.meta.category, config) + '/') }] : []),
      { "@type": "ListItem", position: post.meta.category ? 3 : 2, name: post.meta.title, item: U.abs(post.permalink) },
    ],
  };
  const jsonLd = [blogPosting, breadcrumb];

  return baseLayout({
    config, U, allPosts: allPosts || [],
    title: post.meta.title,
    description: post.excerpt,
    canonical: U.abs(post.permalink),
    ogType: "article",
    ogImage: post.ogImage || "",
    ogImageAlt: post.meta.title,
    articleMeta: {
      publishedTime: isoDateTime(post.meta.date, config),
      modifiedTime: isoDateTime(post.meta.updated || post.meta.date, config),
      author: post.meta.author || config.author || "Redaksi",
      section: post.meta.category || "",
      tags: postTags,
    },
    jsonLd,
    content,
  });
}

function archiveTemplate({ kind, term, posts, config, U, allPosts }) {
  const label = kind === "category" ? "Kategori" : "Tag";
  const cards = posts.map((p) => postCard(p, config, U)).join("");
  const content = `
    <section class="page-head">
      <div class="container"><span>${esc(label)}</span><h1>${esc(term)}</h1><p>${posts.length} artikel tersedia.</p></div>
    </section>
    ${adSlot('archiveTop', 'Slot Iklan Arsip', '970 × 90', 'ad-top', config)}
    <section class="container content-layout archive-layout">
      <div class="main-column"><div class="post-grid">${cards}</div></div>
      <aside class="sidebar-column">${adSlot('sidebar', 'Slot Iklan Sidebar Arsip', '300 × 250', 'ad-sidebar', config)}${textList((allPosts || posts).slice(0, 6), config, U, 'Terbaru')}</aside>
    </section>`;

  return baseLayout({
    config, U, allPosts: allPosts || posts,
    title: `${label}: ${term}`,
    description: kind === "category" && categoryDescription(term, config) ? categoryDescription(term, config) : `Kumpulan artikel dalam ${label.toLowerCase()} ${term}.`,
    canonical: U.abs('/' + kind + '/' + (kind === 'category' ? categorySlug(term, config) : slugify(term)) + '/'),
    ogType: "website",
    content,
  });
}

function pageTemplate({ page, config, U, allPosts }) {
  const content = `
    <article class="page-detail">
      <div class="container post-head-wrap">
        <header class="post-header page-only"><h1>${esc(page.meta.title)}</h1></header>
      </div>
      <div class="container post-narrow"><div class="post-content">${page.html}</div></div>
    </article>`;

  return baseLayout({
    config, U, allPosts: allPosts || [],
    title: page.meta.title,
    description: page.meta.excerpt || page.meta.title,
    canonical: U.abs(page.permalink),
    ogType: "website",
    content,
  });
}

function notFoundTemplate({ config, U, allPosts }) {
  const content = `<section class="error-page container"><h1>404</h1><p>Halaman yang Anda cari tidak ditemukan.</p><a href="${attr(U.url('/'))}" class="btn-home">Kembali ke Beranda</a></section>`;
  return baseLayout({ config, U, allPosts: allPosts || [], title: "404", description: "Halaman tidak ditemukan", content });
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(dateStr, lang) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = (lang || "id") === "id"
    ? ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

module.exports = {
  makeUrlHelpers,
  baseLayout,
  homeTemplate,
  postTemplate,
  archiveTemplate,
  pageTemplate,
  notFoundTemplate,
  slugify,
  categorySlug,
  normalizeCategories,
  normalizeHomepageCategoryBlocks,
  formatDate,
  esc,
  attr,
  assetUrl,
  assetAbs,
};
