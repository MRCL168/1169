/* ============================================================
   app.js — Logika utama aplikasi
   Mengatur: routing antar-view, render daftar artikel,
   editor, media, serta seluruh event handler.
   ============================================================ */

const App = (() => {
  /* ---------- State ---------- */
  const state = {
    articles: [],        // cache daftar artikel { name, path, sha, meta, ... }
    categories: [],      // daftar kategori dari config.json
    editing: null,       // file yang sedang diedit (null = artikel baru)
    editingCategoryIndex: null,
    editingMenuIndex: null,
    siteConfig: null,
    confirmCallback: null,
  };

  const AD_SLOTS = [
    { key: "header", label: "Header Atas", size: "970 × 90" },
    { key: "sidebar", label: "Sidebar", size: "300 × 250" },
    { key: "native", label: "Native / Sidebar Panjang", size: "300 × 600" },
    { key: "betweenCategories", label: "Antar Rubrik", size: "728 × 90" },
    { key: "postTop", label: "Atas Artikel", size: "970 × 90" },
    { key: "postContent", label: "Dalam Artikel", size: "728 × 90" },
    { key: "archiveTop", label: "Arsip / Kategori", size: "970 × 90" },
  ];

  /* ---------- Shortcut DOM ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---------- UI helpers ---------- */

  function showLoader(text = "Memuat…") {
    $("#loader-text").textContent = text;
    $("#loader").classList.remove("hidden");
  }
  function hideLoader() {
    $("#loader").classList.add("hidden");
  }

  function toast(message, type = "info") {
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${escapeHtml(message)}</span>`;
    $("#toast-container").appendChild(el);
    setTimeout(() => {
      el.classList.add("toast-out");
      setTimeout(() => el.remove(), 240);
    }, 3400);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function confirmModal(title, message, confirmText, callback) {
    $("#modal-title").textContent = title;
    $("#modal-message").textContent = message;
    $("#modal-confirm-btn").textContent = confirmText || "Hapus";
    state.confirmCallback = callback;
    $("#modal-confirm").classList.remove("hidden");
  }

  /* ---------- View routing ---------- */

  function showView(name) {
    ["login", "setup", "app"].forEach((v) => {
      $(`#view-${v}`).classList.toggle("hidden", v !== name);
    });
  }

  function showPanel(name) {
    ["list", "editor", "categories", "menus", "ads", "media", "settings"].forEach((p) => {
      $(`#panel-${p}`).classList.toggle("hidden", p !== name);
    });
    // Sinkronkan highlight navigasi
    $$(".nav-item[data-nav]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nav === name);
    });
  }

  /* ============================================================
     INIT — tentukan layar awal berdasarkan konfigurasi
     ============================================================ */
  async function init() {
    bindGlobalEvents();

    if (!Config.hasToken()) {
      showView("login");
      return;
    }

    // Verifikasi token tersimpan
    showLoader("Memverifikasi token…");
    const result = await Auth.validateToken(Config.getToken());
    hideLoader();

    if (!result.ok) {
      Config.clearToken();
      showView("login");
      toast(result.error || "Sesi berakhir, silakan login kembali.", "error");
      return;
    }

    // Token valid → cek konfigurasi repo
    if (!Config.hasRepoConfig()) {
      prefillSetup(result.user);
      showView("setup");
      return;
    }

    enterApp();
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  async function handleLogin() {
    const token = $("#input-token").value.trim();
    if (!token) {
      toast("Masukkan Personal Access Token terlebih dahulu.", "error");
      return;
    }

    showLoader("Menghubungkan…");
    const result = await Auth.validateToken(token);
    hideLoader();

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }

    Config.setToken(token);
    toast(`Berhasil masuk sebagai ${result.user.login}`, "success");

    if (!Config.hasRepoConfig()) {
      prefillSetup(result.user);
      showView("setup");
    } else {
      enterApp();
    }
  }

  function prefillSetup(user) {
    if (user) {
      $("#input-owner").value = user.login;
      $("#setup-user-pill").innerHTML =
        `<img src="${escapeHtml(user.avatar_url)}" alt="" /> Masuk sebagai <strong>${escapeHtml(user.login)}</strong>`;
    }
    const cfg = Config.getAll();
    if (cfg.repo) $("#input-repo").value = cfg.repo;
    if (cfg.branch) $("#input-branch").value = cfg.branch;
    if (cfg.path) $("#input-path").value = cfg.path;
  }

  /* ============================================================
     SETUP REPO
     ============================================================ */
  async function handleSaveConfig() {
    const owner = $("#input-owner").value.trim();
    const repo = $("#input-repo").value.trim();
    const branch = $("#input-branch").value.trim() || "main";
    const path = $("#input-path").value.trim() || "content/posts";

    if (!owner || !repo) {
      toast("Owner dan nama repository wajib diisi.", "error");
      return;
    }

    Config.setRepoConfig({ owner, repo, branch, path });

    showLoader("Memverifikasi repository…");
    const check = await API.verifyRepo();
    hideLoader();

    if (!check.ok) {
      toast(check.error, "error");
      return;
    }

    toast("Repository terhubung!", "success");
    enterApp();
  }

  /* ============================================================
     MASUK APLIKASI
     ============================================================ */
  async function enterApp() {
    const cfg = Config.getAll();
    $("#repo-badge").textContent = `${cfg.owner}/${cfg.repo} · ${cfg.branch}`;
    showView("app");
    showPanel("list");
    Editor.initMDE();
    await loadSiteConfig({ silent: true });
    loadArticles();
  }

  /* ============================================================
     DAFTAR ARTIKEL
     ============================================================ */
  async function loadArticles() {
    const cfg = Config.getAll();
    const listEl = $("#article-list");
    listEl.innerHTML = '<div class="skeleton-card"></div>'.repeat(3);
    $("#list-count").textContent = "Memuat…";

    try {
      const files = await API.listFiles(cfg.path);
      const mdFiles = files.filter(
        (f) => f.type === "file" && /\.(md|markdown)$/i.test(f.name)
      );

      // Ambil isi tiap file untuk membaca frontmatter (paralel)
      const articles = await Promise.all(
        mdFiles.map(async (f) => {
          try {
            const file = await API.getFile(f.path);
            const { meta } = Editor.parse(file.content);
            return {
              name: f.name,
              path: f.path,
              sha: file.sha,
              meta,
              content: file.content,
            };
          } catch (_) {
            return { name: f.name, path: f.path, sha: f.sha, meta: {}, content: "" };
          }
        })
      );

      // Urutkan: terbaru di atas (berdasarkan tanggal, fallback nama)
      articles.sort((a, b) => {
        const da = a.meta.date || "";
        const db = b.meta.date || "";
        if (da && db) return db.localeCompare(da);
        return a.name.localeCompare(b.name);
      });

      state.articles = articles;
      renderArticles(articles);
      populateCategorySuggestions(articles);
    } catch (err) {
      listEl.innerHTML = "";
      $("#list-count").textContent = "Gagal memuat";
      toast(`Gagal memuat artikel: ${err.message}`, "error");
    }
  }

  function renderArticles(articles) {
    const listEl = $("#article-list");
    $("#list-count").textContent =
      articles.length === 0 ? "Belum ada artikel" : `${articles.length} artikel`;

    if (articles.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✎</div>
          <h3>Belum ada artikel</h3>
          <p>Mulai tulis artikel pertama Anda. File akan disimpan langsung ke repository GitHub.</p>
          <button class="btn btn-primary" onclick="App.newArticle()">+ Tulis Artikel Pertama</button>
        </div>`;
      return;
    }

    listEl.innerHTML = articles
      .map((a, i) => {
        const title = a.meta.title || a.name.replace(/\.(md|markdown)$/i, "");
        const status = (a.meta.status || "published").toLowerCase();
        const date = a.meta.date || "—";
        const statusClass = status === "draft" ? "status-draft" : "status-published";
        return `
        <article class="article-card">
          <div class="article-info" onclick="App.editArticle(${i})">
            <h3>${escapeHtml(title)}</h3>
            <div class="article-meta">
              <span class="status-tag ${statusClass}">${escapeHtml(status)}</span>
              <span>${escapeHtml(date)}</span>
              ${a.meta.category ? `<span>${escapeHtml(a.meta.category)}</span>` : ""}
              <span class="mono">${escapeHtml(a.name)}</span>
            </div>
          </div>
          <div class="article-card-actions">
            <button class="btn btn-ghost" onclick="App.editArticle(${i})">Edit</button>
            <button class="btn btn-ghost btn-icon" onclick="App.askDelete(${i})" title="Hapus">🗑</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function filterArticles(query) {
    const q = query.toLowerCase().trim();
    if (!q) return renderArticles(state.articles);
    const filtered = state.articles.filter((a) => {
      const title = (a.meta.title || a.name).toLowerCase();
      const category = (a.meta.category || "").toLowerCase();
      return title.includes(q) || category.includes(q) || a.name.toLowerCase().includes(q);
    });
    renderArticles(filtered);
  }

  /* ============================================================
     EDITOR — buat / edit
     ============================================================ */
  function newArticle() {
    state.editing = null;
    $("#editor-title").textContent = "Tulis Artikel Baru";
    $("#editor-sub").textContent = "Markdown akan disimpan sebagai file .md di repo Anda";
    $("#editor-filename").textContent = "Akan dibuat dari slug saat disimpan";

    // Reset form
    $("#meta-title").value = "";
    $("#meta-slug").value = "";
    $("#meta-slug").dataset.touched = "";
    $("#meta-status").value = "published";
    $("#meta-category").value = "";
    $("#meta-date").value = new Date().toISOString().slice(0, 10);
    $("#meta-author").value = "";
    $("#meta-tags").value = "";
    $("#meta-excerpt").value = "";
    $("#meta-image").value = "";
    updateFeaturedImagePreview();
    Editor.setValue("");

    showPanel("editor");
  }

  function editArticle(index) {
    const article = state.articles[index];
    if (!article) return;

    state.editing = article;
    const { meta } = Editor.parse(article.content);
    const body = Editor.parse(article.content).body;

    $("#editor-title").textContent = "Edit Artikel";
    $("#editor-sub").textContent = "Perubahan akan di-commit ke repository";
    $("#editor-filename").textContent = article.path;

    $("#meta-title").value = meta.title || "";
    $("#meta-slug").value = meta.slug || article.name.replace(/\.(md|markdown)$/i, "");
    $("#meta-status").value = (meta.status || "published").toLowerCase();
    ensureCategoryOption(meta.category || "");
    $("#meta-category").value = meta.category || "";
    $("#meta-date").value = meta.date || "";
    $("#meta-author").value = meta.author || "";
    $("#meta-tags").value = Array.isArray(meta.tags) ? meta.tags.join(", ") : (meta.tags || "");
    $("#meta-excerpt").value = meta.excerpt || "";
    $("#meta-image").value = meta.featured_image || "";
    updateFeaturedImagePreview();
    Editor.setValue(body);

    showPanel("editor");
  }

  async function saveArticle() {
    const cfg = Config.getAll();
    const title = $("#meta-title").value.trim();

    if (!title) {
      toast("Judul artikel wajib diisi.", "error");
      return;
    }

    // Slug otomatis dari judul bila kosong
    let slug = $("#meta-slug").value.trim();
    if (!slug) {
      slug = Editor.slugify(title);
      $("#meta-slug").value = slug;
    }

    const tags = $("#meta-tags").value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const meta = {
      title,
      slug,
      date: $("#meta-date").value || new Date().toISOString().slice(0, 10),
      status: $("#meta-status").value,
      category: $("#meta-category").value.trim(),
      author: $("#meta-author").value.trim(),
      tags,
      excerpt: $("#meta-excerpt").value.trim(),
      featured_image: $("#meta-image").value.trim(),
    };

    const body = Editor.getValue();
    const fileContent = Editor.serialize(meta, body);

    // Tentukan path file
    let path, sha, message;
    if (state.editing) {
      path = state.editing.path;
      sha = state.editing.sha;
      message = `Update artikel: ${title}`;
    } else {
      path = `${cfg.path}/${slug}.md`;
      sha = null;
      message = `Tambah artikel: ${title}`;
    }

    showLoader(state.editing ? "Menyimpan perubahan…" : "Membuat artikel…");
    try {
      await API.saveFile(path, fileContent, message, sha);
      hideLoader();
      toast(state.editing ? "Artikel diperbarui!" : "Artikel dibuat!", "success");
      showPanel("list");
      loadArticles();
    } catch (err) {
      hideLoader();
      // Konflik SHA umumnya berarti file berubah / sudah ada
      if (/sha/i.test(err.message) || /already exists/i.test(err.message)) {
        toast("File dengan slug ini sudah ada. Ganti slug atau muat ulang daftar.", "error");
      } else {
        toast(`Gagal menyimpan: ${err.message}`, "error");
      }
    }
  }

  /* ============================================================
     HAPUS ARTIKEL
     ============================================================ */
  function askDelete(index) {
    const article = state.articles[index];
    if (!article) return;
    const title = article.meta.title || article.name;
    confirmModal(
      "Hapus artikel?",
      `Artikel "${title}" akan dihapus permanen dari repository. Tindakan ini tercatat sebagai commit.`,
      "Hapus",
      () => doDelete(article)
    );
  }

  async function doDelete(article) {
    showLoader("Menghapus…");
    try {
      await API.deleteFile(article.path, article.sha, `Hapus artikel: ${article.meta.title || article.name}`);
      hideLoader();
      toast("Artikel dihapus.", "success");
      loadArticles();
    } catch (err) {
      hideLoader();
      toast(`Gagal menghapus: ${err.message}`, "error");
    }
  }

  /* ============================================================
     MEDIA
     ============================================================ */
  const MEDIA_PATH = "public/images";

  async function loadMedia() {
    const grid = $("#media-grid");
    grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(4);

    try {
      const files = await API.listFiles(MEDIA_PATH);
      const images = files.filter(
        (f) => f.type === "file" && /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name)
      );
      renderMedia(images);
    } catch (err) {
      grid.innerHTML = "";
      toast(`Gagal memuat media: ${err.message}`, "error");
    }
  }

  function renderMedia(images) {
    const grid = $("#media-grid");
    if (images.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-icon">▣</div>
          <h3>Belum ada gambar</h3>
          <p>Upload gambar untuk dipakai di artikel. Tersimpan di folder <code>${MEDIA_PATH}/</code>.</p>
        </div>`;
      return;
    }

    grid.innerHTML = images
      .map((img) => {
        // download_url = URL raw langsung dari GitHub
        const url = img.download_url || "";
        const relPath = img.path;
        return `
        <div class="media-item">
          <img class="media-thumb" src="${escapeHtml(url)}" alt="${escapeHtml(img.name)}" loading="lazy" />
          <div class="media-body">
            <div class="media-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</div>
            <div class="media-actions">
              <button onclick="App.insertImage('${escapeHtml(relPath)}', '${escapeHtml(img.name)}')">Sisipkan</button>
              <button onclick="App.setFeaturedImage('${escapeHtml(relPath)}')">Jadikan Featured</button>
              <button onclick="App.copyText('${escapeHtml(relPath)}')">Salin path</button>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  async function handleUpload(file, options = {}) {
    if (!file) return null;

    const uploadTarget = options.target || "media";
    const shouldSetFeatured = uploadTarget === "featured" || options.setFeatured === true;

    const allowedByMime = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.type || "");
    const allowedByExt = /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || "");
    if (!allowedByMime && !allowedByExt) {
      toast("File harus berupa gambar PNG, JPG, GIF, WebP, atau SVG.", "error");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Ukuran gambar maksimal 5 MB.", "error");
      return null;
    }

    showLoader(shouldSetFeatured ? "Mengunggah featured image…" : "Mengunggah gambar…");
    try {
      const base64 = await fileToBase64(file);
      const safeName = sanitizeFileName(file.name);
      const path = `${MEDIA_PATH}/${Date.now()}-${safeName}`;
      const res = await API.uploadBinary(path, base64, `Upload gambar: ${safeName}`);

      if (!res || res.notFound) {
        throw new Error("Upload tidak berhasil. Periksa owner, repository, branch, dan permission token GitHub.");
      }

      const publicPath = normalizeImagePath(path);
      hideLoader();

      if (shouldSetFeatured) {
        setFeaturedImage(publicPath);
        toast("Featured image berhasil diunggah dan dipasang.", "success");
      } else {
        toast("Gambar berhasil diunggah ke repository.", "success");

        // Jika upload dilakukan saat panel editor sedang terbuka dan field masih kosong,
        // langsung isi agar gambar yang baru diupload bisa dipakai sebagai cover.
        const imageField = $("#meta-image");
        const editorOpen = $("#panel-editor") && !$("#panel-editor").classList.contains("hidden");
        if (editorOpen && imageField && !imageField.value.trim()) setFeaturedImage(publicPath, { silent: true, noSwitch: true });
      }

      loadMedia();
      return publicPath;
    } catch (err) {
      hideLoader();
      toast(`Gagal mengunggah: ${humanizeUploadError(err.message)}`, "error");
      return null;
    }
  }

  function sanitizeFileName(name) {
    const original = String(name || "gambar");
    const extMatch = original.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
    const base = original
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "gambar";
    return `${base}${ext}`;
  }

  function humanizeUploadError(message) {
    const msg = String(message || "");
    if (/bad credentials|401/i.test(msg)) {
      return "token GitHub tidak valid atau sudah kedaluwarsa.";
    }
    if (/resource not accessible|403/i.test(msg)) {
      return "token belum punya akses Contents: Read and write ke repository ini.";
    }
    if (/not found|404/i.test(msg)) {
      return "repository atau branch tidak ditemukan. Periksa konfigurasi owner, repo, dan branch.";
    }
    if (/sha|already exists/i.test(msg)) {
      return "file dengan nama yang sama sudah ada. Coba upload ulang.";
    }
    return msg || "terjadi kesalahan tidak diketahui.";
  }

  /** File → base64 (tanpa prefix data URI) */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const bytes = new Uint8Array(reader.result);
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          resolve(btoa(binary));
        } catch (_) {
          reject(new Error("Gagal mengubah file menjadi Base64."));
        }
      };
      reader.onerror = () => reject(new Error("Gagal membaca file."));
      reader.readAsArrayBuffer(file);
    });
  }

  function normalizeImagePath(path) {
    const clean = String(path || "").trim();
    if (!clean) return "";
    if (/^(https?:)?\/\//i.test(clean) || clean.startsWith("data:")) return clean;
    return `/${clean.replace(/^\/+/, "")}`;
  }

  function imagePreviewUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;

    const cfg = Config.getAll();
    const relPath = value.replace(/^\/+/, "");
    if (cfg.owner && cfg.repo && cfg.branch && relPath) {
      return `https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(cfg.branch)}/${relPath}`;
    }
    return normalizeImagePath(value);
  }

  function updateFeaturedImagePreview() {
    const field = $("#meta-image");
    const img = $("#featured-image-preview");
    const empty = $("#featured-image-empty");
    if (!field || !img || !empty) return;

    const value = field.value.trim();
    if (!value) {
      img.classList.add("hidden");
      img.removeAttribute("src");
      empty.classList.remove("hidden");
      return;
    }

    img.src = imagePreviewUrl(value);
    img.classList.remove("hidden");
    empty.classList.add("hidden");
  }

  function setFeaturedImage(path, options = {}) {
    const field = $("#meta-image");
    if (!field) return;
    field.value = normalizeImagePath(path);
    updateFeaturedImagePreview();
    if (!options.noSwitch) showPanel("editor");
    if (!options.silent) toast("Featured image dipasang ke artikel.", "success");
  }

  function clearFeaturedImage() {
    const field = $("#meta-image");
    if (!field) return;
    field.value = "";
    updateFeaturedImagePreview();
    toast("Featured image dikosongkan.", "info");
  }

  function insertImage(path, name) {
    Editor.insert(`![${name}](${normalizeImagePath(path)})`);
    showPanel("editor");
    toast("Gambar disisipkan ke editor.", "success");
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(
      () => toast("Path disalin ke clipboard.", "success"),
      () => toast("Gagal menyalin.", "error")
    );
  }

  /* ============================================================
     KATEGORI + PENGATURAN SITUS (config.json)
     ============================================================ */
  const CONFIG_PATH = "config.json";
  let siteConfigSha = null;

  function slugifyText(text) {
    if (Editor && typeof Editor.slugify === "function") return Editor.slugify(text);
    return String(text || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeCategory(item) {
    const name = typeof item === "string" ? item : (item && item.name);
    const cleanName = String(name || "").trim();
    if (!cleanName) return null;
    const rawSlug = typeof item === "object" && item && item.slug ? item.slug : cleanName;
    return {
      name: cleanName,
      slug: slugifyText(rawSlug),
      description: typeof item === "object" && item && item.description ? String(item.description).trim() : "",
    };
  }

  function normalizeCategories(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .map(normalizeCategory)
      .filter(Boolean)
      .filter((cat) => {
        const key = cat.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function inferCategoriesFromArticles() {
    const seen = new Set();
    return state.articles
      .map((a) => a.meta && a.meta.category)
      .filter(Boolean)
      .map((name) => normalizeCategory(name))
      .filter((cat) => {
        const key = cat.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function normalizeMenuItem(item, index = 0) {
    if (!item || typeof item !== "object") return null;
    const label = String(item.label || "").trim();
    const url = String(item.url || "").trim();
    if (!label || !url) return null;
    return {
      label,
      url,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      newTab: Boolean(item.newTab),
    };
  }

  function normalizeMenuItems(list) {
    return (Array.isArray(list) ? list : [])
      .map(normalizeMenuItem)
      .filter(Boolean)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function normalizeAds(ads) {
    const next = { enabled: true, slots: {} };
    if (ads && typeof ads === "object") {
      next.enabled = ads.enabled !== false;
    }
    const sourceSlots = ads && ads.slots && typeof ads.slots === "object" ? ads.slots : {};
    AD_SLOTS.forEach((slot) => {
      const current = sourceSlots[slot.key] || {};
      next.slots[slot.key] = {
        label: current.label || slot.label,
        size: current.size || slot.size,
        enabled: current.enabled !== false,
        html: typeof current.html === "string" ? current.html : "",
      };
    });
    return next;
  }

  async function loadSiteConfig(options = {}) {
    try {
      const file = await API.getFile(CONFIG_PATH);
      if (!file) {
        if (!options.silent) toast("File config.json tidak ditemukan di repo.", "error");
        return null;
      }
      siteConfigSha = file.sha;
      let cfg;
      try {
        cfg = JSON.parse(file.content);
      } catch (_) {
        if (!options.silent) toast("config.json tidak valid (gagal di-parse).", "error");
        return null;
      }
      cfg.categories = normalizeCategories(cfg.categories);
      cfg.nav = normalizeMenuItems(cfg.nav);
      cfg.ads = normalizeAds(cfg.ads);
      if (!cfg.categories.length && state.articles.length) {
        cfg.categories = inferCategoriesFromArticles();
      }
      state.siteConfig = cfg;
      state.categories = cfg.categories;
      populateCategorySuggestions(state.articles);
      return cfg;
    } catch (err) {
      if (!options.silent) toast(`Gagal memuat config.json: ${err.message}`, "error");
      return null;
    }
  }

  async function ensureSiteConfigLoaded() {
    if (state.siteConfig && siteConfigSha) return state.siteConfig;
    return loadSiteConfig({ silent: true });
  }

  function getCategoryCounts() {
    const counts = {};
    state.articles.forEach((a) => {
      const cat = a.meta && a.meta.category;
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }

  function ensureCategoryOption(value) {
    const select = $("#meta-category");
    const name = String(value || "").trim();
    if (!select || !name) return;
    const exists = Array.from(select.options).some((opt) => opt.value === name);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${name} (belum terdaftar)`;
      select.appendChild(opt);
    }
  }

  function populateCategorySuggestions(articles = []) {
    const select = $("#meta-category");
    if (!select) return;
    const current = select.value;
    let cats = state.categories && state.categories.length ? state.categories : inferCategoriesFromArticles();
    select.innerHTML = `<option value="">Pilih kategori</option>` + cats
      .map((cat) => `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`)
      .join("");
    ensureCategoryOption(current);
    select.value = current || "";
  }

  async function loadCategories() {
    showLoader("Memuat kategori…");
    await loadSiteConfig({ silent: true });
    hideLoader();
    renderCategoryList();
    populateCategorySuggestions(state.articles);
  }

  function renderCategoryList() {
    const wrap = $("#category-list");
    if (!wrap) return;
    const cats = state.categories || [];
    const counts = getCategoryCounts();

    if (!cats.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◇</div>
          <h3>Belum ada kategori</h3>
          <p>Tambahkan kategori pertama agar pilihan rubrik muncul di editor artikel.</p>
        </div>`;
      return;
    }

    wrap.innerHTML = cats.map((cat, index) => {
      const count = counts[cat.name] || 0;
      return `
        <article class="category-admin-item">
          <div>
            <div class="category-admin-title">${escapeHtml(cat.name)}</div>
            <div class="category-admin-meta">
              <span class="mono">/${escapeHtml(cat.slug)}/</span>
              <span class="category-count-pill">${count} artikel</span>
            </div>
            ${cat.description ? `<div class="category-admin-desc">${escapeHtml(cat.description)}</div>` : ""}
          </div>
          <div class="category-admin-actions">
            <button class="btn btn-ghost btn-small" onclick="App.editCategory(${index})">Edit</button>
            <button class="btn btn-danger btn-small" onclick="App.askDeleteCategory(${index})">Hapus</button>
          </div>
        </article>`;
    }).join("");
  }

  function resetCategoryForm() {
    state.editingCategoryIndex = null;
    $("#category-form-title").textContent = "Tambah Kategori";
    $("#cat-name").value = "";
    $("#cat-slug").value = "";
    $("#cat-slug").dataset.touched = "";
    $("#cat-description").value = "";
    $("#btn-save-category").textContent = "Simpan Kategori";
  }

  function editCategory(index) {
    const cat = state.categories[index];
    if (!cat) return;
    state.editingCategoryIndex = index;
    $("#category-form-title").textContent = "Edit Kategori";
    $("#cat-name").value = cat.name || "";
    $("#cat-slug").value = cat.slug || "";
    $("#cat-slug").dataset.touched = "1";
    $("#cat-description").value = cat.description || "";
    $("#btn-save-category").textContent = "Update Kategori";
  }

  async function saveCategory() {
    await ensureSiteConfigLoaded();
    const name = $("#cat-name").value.trim();
    const slug = slugifyText($("#cat-slug").value.trim() || name);
    const description = $("#cat-description").value.trim();
    const index = state.editingCategoryIndex;

    if (!name) {
      toast("Nama kategori wajib diisi.", "error");
      return;
    }
    if (!slug) {
      toast("Slug kategori tidak valid.", "error");
      return;
    }

    const duplicate = state.categories.find((cat, i) =>
      i !== index && (cat.name.toLowerCase() === name.toLowerCase() || cat.slug === slug)
    );
    if (duplicate) {
      toast("Nama atau slug kategori sudah digunakan.", "error");
      return;
    }

    const next = { name, slug, description };
    const action = index == null || index < 0 ? "Tambah" : "Update";
    const previous = state.categories.slice();
    if (index == null || index < 0) state.categories.push(next);
    else state.categories[index] = next;

    try {
      await persistCategories(`${action} kategori: ${name}`);
      toast(action === "Tambah" ? "Kategori ditambahkan." : "Kategori diperbarui.", "success");
      resetCategoryForm();
      renderCategoryList();
      populateCategorySuggestions(state.articles);
    } catch (err) {
      state.categories = previous;
      toast(`Gagal menyimpan kategori: ${err.message}`, "error");
    }
  }

  function askDeleteCategory(index) {
    const cat = state.categories[index];
    if (!cat) return;
    const count = getCategoryCounts()[cat.name] || 0;
    const extra = count ? ` Ada ${count} artikel yang masih memakai kategori ini; artikel tersebut tidak ikut diubah otomatis.` : "";
    confirmModal(
      "Hapus kategori?",
      `Kategori "${cat.name}" akan dihapus dari config.json.${extra}`,
      "Hapus",
      () => deleteCategory(index)
    );
  }

  async function deleteCategory(index) {
    await ensureSiteConfigLoaded();
    const cat = state.categories[index];
    if (!cat) return;
    const previous = state.categories.slice();
    state.categories.splice(index, 1);
    showLoader("Menghapus kategori…");
    try {
      await persistCategories(`Hapus kategori: ${cat.name}`);
      hideLoader();
      toast("Kategori dihapus.", "success");
      resetCategoryForm();
      renderCategoryList();
      populateCategorySuggestions(state.articles);
    } catch (err) {
      state.categories = previous;
      hideLoader();
      toast(`Gagal menghapus kategori: ${err.message}`, "error");
    }
  }

  async function persistCategories(message) {
    const cfg = await ensureSiteConfigLoaded();
    if (!cfg) throw new Error("config.json belum bisa dimuat.");
    cfg.categories = normalizeCategories(state.categories);
    state.siteConfig = cfg;
    const json = JSON.stringify(cfg, null, 2) + "\n";
    const res = await API.saveFile(CONFIG_PATH, json, message || "Update kategori via CMS", siteConfigSha);
    siteConfigSha = res.content ? res.content.sha : siteConfigSha;
  }

  /* ============================================================
     MENU MANAGER
     ============================================================ */
  async function loadMenus() {
    showLoader("Memuat menu…");
    await loadSiteConfig({ silent: true });
    hideLoader();
    resetMenuForm();
    renderMenuList();
  }

  function renderMenuList() {
    const wrap = $("#menu-list");
    if (!wrap) return;
    const menus = normalizeMenuItems((state.siteConfig && state.siteConfig.nav) || []);

    if (!menus.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">☰</div>
          <h3>Belum ada menu</h3>
          <p>Tambahkan menu pertama agar navigasi utama tampil di website.</p>
        </div>`;
      return;
    }

    wrap.innerHTML = menus.map((item, index) => `
      <article class="category-admin-item menu-admin-item">
        <div>
          <div class="category-admin-title">${escapeHtml(item.label)}</div>
          <div class="category-admin-meta">
            <span class="mono">${escapeHtml(item.url)}</span>
            <span class="category-count-pill">Urutan ${escapeHtml(item.order || index + 1)}</span>
            ${item.newTab ? '<span class="category-count-pill">Tab baru</span>' : ''}
          </div>
        </div>
        <div class="category-admin-actions">
          <button class="btn btn-ghost btn-small" onclick="App.editMenu(${index})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="App.askDeleteMenu(${index})">Hapus</button>
        </div>
      </article>`).join("");
  }

  function resetMenuForm() {
    state.editingMenuIndex = null;
    const title = $("#menu-form-title");
    if (!title) return;
    title.textContent = "Tambah Menu";
    $("#menu-label").value = "";
    $("#menu-url").value = "";
    $("#menu-order").value = "";
    $("#menu-newtab").checked = false;
    $("#btn-save-menu").textContent = "Simpan Menu";
  }

  function editMenu(index) {
    const cfg = state.siteConfig || {};
    const menus = normalizeMenuItems(cfg.nav || []);
    const item = menus[index];
    if (!item) return;
    state.editingMenuIndex = index;
    $("#menu-form-title").textContent = "Edit Menu";
    $("#menu-label").value = item.label || "";
    $("#menu-url").value = item.url || "";
    $("#menu-order").value = item.order || index + 1;
    $("#menu-newtab").checked = Boolean(item.newTab);
    $("#btn-save-menu").textContent = "Update Menu";
  }

  async function saveMenu() {
    const cfg = await ensureSiteConfigLoaded();
    if (!cfg) {
      toast("config.json belum bisa dimuat.", "error");
      return;
    }

    const label = $("#menu-label").value.trim();
    const url = $("#menu-url").value.trim();
    const order = parseInt($("#menu-order").value, 10) || ((cfg.nav || []).length + 1);
    const newTab = $("#menu-newtab").checked;
    const index = state.editingMenuIndex;

    if (!label) {
      toast("Label menu wajib diisi.", "error");
      return;
    }
    if (!url) {
      toast("URL menu wajib diisi.", "error");
      return;
    }

    const menus = normalizeMenuItems(cfg.nav || []);
    const next = { label, url, order, newTab };
    const action = index == null || index < 0 ? "Tambah" : "Update";
    if (index == null || index < 0) menus.push(next);
    else menus[index] = next;
    cfg.nav = normalizeMenuItems(menus).map((item, i) => ({
      label: item.label,
      url: item.url,
      order: item.order || i + 1,
      newTab: Boolean(item.newTab),
    }));

    showLoader("Menyimpan menu…");
    try {
      const json = JSON.stringify(cfg, null, 2) + "\n";
      const res = await API.saveFile(CONFIG_PATH, json, `${action} menu: ${label}`, siteConfigSha);
      hideLoader();
      siteConfigSha = res.content ? res.content.sha : siteConfigSha;
      state.siteConfig = cfg;
      toast(action === "Tambah" ? "Menu ditambahkan." : "Menu diperbarui.", "success");
      resetMenuForm();
      renderMenuList();
    } catch (err) {
      hideLoader();
      toast(`Gagal menyimpan menu: ${err.message}`, "error");
    }
  }

  function askDeleteMenu(index) {
    const cfg = state.siteConfig || {};
    const item = normalizeMenuItems(cfg.nav || [])[index];
    if (!item) return;
    confirmModal(
      "Hapus menu?",
      `Menu "${item.label}" akan dihapus dari navigasi utama.`,
      "Hapus",
      () => deleteMenu(index)
    );
  }

  async function deleteMenu(index) {
    const cfg = await ensureSiteConfigLoaded();
    if (!cfg) return;
    const menus = normalizeMenuItems(cfg.nav || []);
    const item = menus[index];
    if (!item) return;
    menus.splice(index, 1);
    cfg.nav = menus.map((menu, i) => ({ ...menu, order: menu.order || i + 1 }));
    showLoader("Menghapus menu…");
    try {
      const json = JSON.stringify(cfg, null, 2) + "\n";
      const res = await API.saveFile(CONFIG_PATH, json, `Hapus menu: ${item.label}`, siteConfigSha);
      hideLoader();
      siteConfigSha = res.content ? res.content.sha : siteConfigSha;
      state.siteConfig = cfg;
      toast("Menu dihapus.", "success");
      resetMenuForm();
      renderMenuList();
    } catch (err) {
      hideLoader();
      toast(`Gagal menghapus menu: ${err.message}`, "error");
    }
  }

  /* ============================================================
     ADS SETTINGS
     ============================================================ */
  async function loadAds() {
    showLoader("Memuat pengaturan iklan…");
    const cfg = await loadSiteConfig({ silent: true });
    hideLoader();
    if (!cfg) {
      toast("File config.json tidak ditemukan atau tidak valid.", "error");
      return;
    }
    const ads = normalizeAds(cfg.ads);
    $("#ads-enabled").checked = ads.enabled !== false;
    AD_SLOTS.forEach((slot) => {
      const item = ads.slots[slot.key] || { enabled: true, html: "" };
      const enabled = $(`#ad-${slot.key}-enabled`);
      const html = $(`#ad-${slot.key}-html`);
      if (enabled) enabled.checked = item.enabled !== false;
      if (html) html.value = item.html || "";
    });
  }

  async function saveAds() {
    const cfg = await ensureSiteConfigLoaded();
    if (!cfg) {
      toast("config.json belum bisa dimuat.", "error");
      return;
    }

    cfg.ads = {
      enabled: $("#ads-enabled").checked,
      slots: {},
    };
    AD_SLOTS.forEach((slot) => {
      cfg.ads.slots[slot.key] = {
        label: slot.label,
        size: slot.size,
        enabled: $(`#ad-${slot.key}-enabled`) ? $(`#ad-${slot.key}-enabled`).checked : true,
        html: $(`#ad-${slot.key}-html`) ? $(`#ad-${slot.key}-html`).value : "",
      };
    });

    showLoader("Menyimpan pengaturan iklan…");
    try {
      const json = JSON.stringify(cfg, null, 2) + "\n";
      const res = await API.saveFile(CONFIG_PATH, json, "Update pengaturan iklan HTML via CMS", siteConfigSha);
      hideLoader();
      siteConfigSha = res.content ? res.content.sha : siteConfigSha;
      state.siteConfig = cfg;
      toast("Pengaturan iklan disimpan! Situs akan dibangun ulang otomatis.", "success");
    } catch (err) {
      hideLoader();
      toast(`Gagal menyimpan iklan: ${err.message}`, "error");
    }
  }

  async function loadSettings() {
    showLoader("Memuat pengaturan…");
    try {
      const cfg = await loadSiteConfig({ silent: true });
      hideLoader();
      if (!cfg) {
        toast("File config.json tidak ditemukan atau tidak valid.", "error");
        return;
      }
      const s = cfg.social || {};
      $("#set-title").value = cfg.title || "";
      $("#set-tagline").value = cfg.tagline || "";
      $("#set-description").value = cfg.description || "";
      $("#set-author").value = cfg.author || "";
      $("#set-baseurl").value = cfg.baseUrl || "";
      $("#set-basepath").value = cfg.basePath || "";
      $("#set-perpage").value = cfg.postsPerPage || 6;
      $("#set-github").value = s.github || "";
      $("#set-twitter").value = s.twitter || "";
      $("#set-instagram").value = s.instagram || "";
      $("#set-linkedin").value = s.linkedin || "";
      $("#set-email").value = s.email || "";
    } catch (err) {
      hideLoader();
      toast(`Gagal memuat pengaturan: ${err.message}`, "error");
    }
  }

  async function saveSettings() {
    const cfg = Object.assign({}, state.siteConfig || {});
    cfg.title = $("#set-title").value.trim();
    cfg.tagline = $("#set-tagline").value.trim();
    cfg.description = $("#set-description").value.trim();
    cfg.author = $("#set-author").value.trim();
    cfg.baseUrl = $("#set-baseurl").value.trim().replace(/\/+$/, "");
    cfg.basePath = $("#set-basepath").value.trim().replace(/\/+$/, "");
    cfg.postsPerPage = parseInt($("#set-perpage").value, 10) || 6;
    cfg.social = Object.assign({}, cfg.social, {
      github: $("#set-github").value.trim(),
      twitter: $("#set-twitter").value.trim(),
      instagram: $("#set-instagram").value.trim(),
      linkedin: $("#set-linkedin").value.trim(),
      email: $("#set-email").value.trim(),
    });

    const json = JSON.stringify(cfg, null, 2) + "\n";

    showLoader("Menyimpan pengaturan…");
    try {
      const res = await API.saveFile(CONFIG_PATH, json, "Update pengaturan situs via CMS", siteConfigSha);
      hideLoader();
      siteConfigSha = res.content ? res.content.sha : siteConfigSha;
      state.siteConfig = cfg;
      toast("Pengaturan disimpan! Situs akan dibangun ulang otomatis.", "success");
    } catch (err) {
      hideLoader();
      toast(`Gagal menyimpan: ${err.message}`, "error");
    }
  }

  /* ============================================================
     LOGOUT
     ============================================================ */
  function logout() {
    confirmModal(
      "Keluar dari GitCMS?",
      "Token akan dihapus dari browser ini. Konfigurasi repository tetap tersimpan.",
      "Keluar",
      () => {
        Config.clearToken();
        showView("login");
        $("#input-token").value = "";
        toast("Anda telah keluar.", "info");
      }
    );
  }

  /* ============================================================
     EVENT BINDING
     ============================================================ */
  function bindGlobalEvents() {
    // Login
    $("#btn-login").addEventListener("click", handleLogin);
    $("#input-token").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });

    // Setup
    $("#btn-save-config").addEventListener("click", handleSaveConfig);
    $("#btn-logout-setup").addEventListener("click", () => {
      Config.clearToken();
      showView("login");
    });

    // Navigasi sidebar
    $$(".nav-item[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nav = btn.dataset.nav;
        if (nav === "editor") {
          newArticle();
        } else {
          showPanel(nav);
          if (nav === "categories") loadCategories();
          if (nav === "menus") loadMenus();
          if (nav === "ads") loadAds();
          if (nav === "media") loadMedia();
          if (nav === "settings") loadSettings();
        }
      });
    });

    // Tombol-tombol panel
    $("#btn-new-article").addEventListener("click", newArticle);
    $("#btn-refresh").addEventListener("click", loadArticles);
    $("#btn-cancel-edit").addEventListener("click", () => showPanel("list"));
    $("#btn-save-article").addEventListener("click", saveArticle);
    $("#btn-refresh-media").addEventListener("click", loadMedia);
    $("#btn-refresh-categories").addEventListener("click", loadCategories);
    $("#btn-save-category").addEventListener("click", saveCategory);
    $("#btn-reset-category").addEventListener("click", resetCategoryForm);
    $("#btn-refresh-menus").addEventListener("click", loadMenus);
    $("#btn-save-menu").addEventListener("click", saveMenu);
    $("#btn-reset-menu").addEventListener("click", resetMenuForm);
    $("#btn-refresh-ads").addEventListener("click", loadAds);
    $("#btn-save-ads").addEventListener("click", saveAds);
    $("#btn-save-settings").addEventListener("click", saveSettings);
    $("#btn-settings").addEventListener("click", () => {
      prefillSetup(null);
      const cfg = Config.getAll();
      $("#input-owner").value = cfg.owner;
      showView("setup");
    });
    $("#btn-logout").addEventListener("click", logout);

    // Auto-slug saat mengetik judul (hanya untuk artikel baru)
    $("#meta-title").addEventListener("input", (e) => {
      if (!state.editing && !$("#meta-slug").dataset.touched) {
        $("#meta-slug").value = Editor.slugify(e.target.value);
      }
    });
    $("#meta-slug").addEventListener("input", () => {
      $("#meta-slug").dataset.touched = "1";
    });

    // Pencarian
    $("#search-input").addEventListener("input", (e) => filterArticles(e.target.value));

    // Upload media
    $("#btn-upload-media").addEventListener("click", () => {
      $("#media-upload").click();
    });
    $("#media-upload").addEventListener("change", (e) => {
      handleUpload(e.target.files[0]);
      e.target.value = ""; // reset agar bisa upload file sama lagi
    });

    // Upload khusus featured image di sidebar editor
    $("#btn-upload-featured-image").addEventListener("click", () => {
      $("#featured-image-upload").click();
    });
    $("#featured-image-upload").addEventListener("change", (e) => {
      handleUpload(e.target.files[0], { target: "featured" });
      e.target.value = "";
    });
    $("#btn-open-media-for-featured").addEventListener("click", () => {
      showPanel("media");
      loadMedia();
      toast("Pilih tombol ‘Jadikan Featured’ pada gambar yang ingin dipakai.", "info");
    });
    $("#btn-clear-featured-image").addEventListener("click", clearFeaturedImage);
    $("#meta-image").addEventListener("input", updateFeaturedImagePreview);

    // Kategori
    $("#cat-name").addEventListener("input", (e) => {
      if (!$("#cat-slug").dataset.touched) $("#cat-slug").value = slugifyText(e.target.value);
    });
    $("#cat-slug").addEventListener("input", () => {
      $("#cat-slug").dataset.touched = "1";
    });

    // Modal konfirmasi
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-confirm-btn").addEventListener("click", () => {
      if (state.confirmCallback) state.confirmCallback();
      closeModal();
    });
    $("#modal-confirm").addEventListener("click", (e) => {
      if (e.target.id === "modal-confirm") closeModal();
    });
  }

  function closeModal() {
    $("#modal-confirm").classList.add("hidden");
    state.confirmCallback = null;
  }

  /* ---------- API publik (dipanggil dari atribut onclick) ---------- */
  return {
    init,
    newArticle,
    editArticle,
    askDelete,
    insertImage,
    setFeaturedImage,
    copyText,
    editCategory,
    askDeleteCategory,
    editMenu,
    askDeleteMenu,
  };
})();

/* Jalankan saat DOM siap */
document.addEventListener("DOMContentLoaded", App.init);
