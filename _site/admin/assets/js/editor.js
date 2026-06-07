/* ============================================================
   editor.js — Markdown + YAML frontmatter
   - Parser & serializer frontmatter (tanpa library eksternal)
   - Inisialisasi EasyMDE
   - Helper slug
   ============================================================ */

const Editor = (() => {
  let mde = null; // instance EasyMDE

  /* ---------- Frontmatter ---------- */

  /**
   * Pisahkan frontmatter YAML dari body markdown.
   * @param {string} raw  isi file mentah
   * @returns {{ meta: object, body: string }}
   */
  function parse(raw) {
    const meta = {};
    let body = raw;

    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (match) {
      const yaml = match[1];
      body = match[2];

      yaml.split("\n").forEach((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return;
        const key = line.slice(0, idx).trim();
        let value = line.slice(idx + 1).trim();
        if (!key) return;

        // Array sederhana: [a, b, c]
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        } else {
          // Lepas tanda kutip
          value = value.replace(/^["']|["']$/g, "");
        }
        meta[key] = value;
      });
    }

    return { meta, body: body.replace(/^\n+/, "") };
  }

  /**
   * Susun frontmatter + body menjadi file markdown lengkap.
   * @param {object} meta
   * @param {string} body
   * @returns {string}
   */
  function serialize(meta, body) {
    const lines = ["---"];

    const order = ["title", "slug", "date", "status", "category", "author", "tags", "excerpt", "featured_image"];
    const keys = [...order, ...Object.keys(meta).filter((k) => !order.includes(k))];

    keys.forEach((key) => {
      if (!(key in meta)) return;
      const val = meta[key];
      if (val === "" || val == null) return;

      if (Array.isArray(val)) {
        if (val.length === 0) return;
        lines.push(`${key}: [${val.map((v) => `"${v}"`).join(", ")}]`);
      } else {
        const needsQuote = /[:#"']/.test(String(val));
        lines.push(`${key}: ${needsQuote ? JSON.stringify(String(val)) : val}`);
      }
    });

    lines.push("---", "", body.trim(), "");
    return lines.join("\n");
  }

  /* ---------- Slug ---------- */

  /** Ubah teks menjadi slug ramah-URL */
  function slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* ---------- EasyMDE ---------- */

  /** Inisialisasi editor pada <textarea id="markdown-editor"> */
  function initMDE() {
    if (mde) return mde;
    mde = new EasyMDE({
      element: document.getElementById("markdown-editor"),
      spellChecker: false,
      autofocus: false,
      placeholder: "Tulis konten artikel Anda dalam format Markdown…\n\nGunakan toolbar di atas untuk format teks, atau tab Media untuk menyisipkan gambar.",
      status: ["lines", "words"],
      toolbar: [
        "bold", "italic", "heading", "|",
        "quote", "unordered-list", "ordered-list", "|",
        "link", "image", "code", "table", "|",
        "preview", "side-by-side", "fullscreen", "|",
        "guide",
      ],
      minHeight: "420px",
    });
    return mde;
  }

  return {
    parse,
    serialize,
    slugify,
    initMDE,
    /** Ambil nilai markdown saat ini */
    getValue() { return mde ? mde.value() : ""; },
    /** Set nilai markdown */
    setValue(v) { if (mde) mde.value(v || ""); },
    /** Sisipkan teks di posisi kursor */
    insert(text) {
      if (!mde) return;
      const cm = mde.codemirror;
      cm.replaceSelection(text);
      cm.focus();
    },
  };
})();
