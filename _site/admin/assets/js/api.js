/* ============================================================
   api.js — Wrapper GitHub Contents API
   Operasi: list, get, create, update, delete file + upload media.
   Menangani encoding UTF-8 ⇄ Base64 dengan benar (mendukung
   karakter non-ASCII seperti teks Bahasa Indonesia).
   ============================================================ */

const API = (() => {
  const API_BASE = "https://api.github.com";

  /* ---------- Helper: encoding UTF-8 yang aman ---------- */

  /** String UTF-8 → Base64 (aman untuk emoji & aksara non-latin) */
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  /** Base64 → string UTF-8 */
  function base64ToUtf8(b64) {
    const clean = b64.replace(/\s/g, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /* ---------- Helper: request dasar ---------- */

  function headers() {
    return {
      Authorization: `Bearer ${Config.getToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function repoUrl(path) {
    const { owner, repo } = Config.getAll();
    const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
    return `${API_BASE}/repos/${owner}/${repo}/contents${cleanPath}`;
  }

  async function request(url, options = {}, meta = {}) {
    const mergedHeaders = Object.assign({}, headers(), options.headers || {});
    const res = await fetch(url, Object.assign({}, options, { headers: mergedHeaders }));

    // 404 hanya dianggap aman untuk operasi baca. Untuk operasi tulis
    // seperti upload/update/delete, 404 harus dilempar sebagai error agar
    // admin tidak menampilkan upload berhasil padahal file tidak masuk repo.
    if (res.status === 404 && meta.allowNotFound) return { notFound: true };

    if (!res.ok) {
      let detail = `GitHub API merespons status ${res.status}`;
      try {
        const body = await res.json();
        if (body.message) detail = body.message;
        if (Array.isArray(body.errors) && body.errors.length) {
          const extra = body.errors
            .map((e) => e.message || e.code || e.field)
            .filter(Boolean)
            .join(", ");
          if (extra) detail += ` (${extra})`;
        }
      } catch (_) {}
      throw new Error(detail);
    }
    if (res.status === 204) return { ok: true };
    return res.json();
  }

  return {
    utf8ToBase64,
    base64ToUtf8,

    /**
     * List semua file di dalam sebuah folder.
     * @param {string} path
     * @returns {Promise<Array>} daftar file/folder
     */
    async listFiles(path) {
      const { branch } = Config.getAll();
      const url = `${repoUrl(path)}?ref=${encodeURIComponent(branch)}`;
      const data = await request(url, {}, { allowNotFound: true });
      if (data.notFound) return [];
      return Array.isArray(data) ? data : [data];
    },

    /**
     * Ambil isi sebuah file (decoded ke teks).
     * @param {string} path
     * @returns {Promise<{content:string, sha:string}|null>}
     */
    async getFile(path) {
      const { branch } = Config.getAll();
      const url = `${repoUrl(path)}?ref=${encodeURIComponent(branch)}`;
      const data = await request(url, {}, { allowNotFound: true });
      if (data.notFound) return null;
      return {
        content: base64ToUtf8(data.content),
        sha: data.sha,
        name: data.name,
        path: data.path,
      };
    },

    /**
     * Buat atau update file teks.
     * Jika `sha` diberikan → update; jika tidak → create.
     * @param {string} path
     * @param {string} textContent
     * @param {string} message  pesan commit
     * @param {string|null} sha
     */
    async saveFile(path, textContent, message, sha = null) {
      const { branch } = Config.getAll();
      const body = {
        message: message || `Update ${path}`,
        content: utf8ToBase64(textContent),
        branch,
      };
      if (sha) body.sha = sha;

      return request(repoUrl(path), {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },

    /**
     * Upload file biner (gambar) yang sudah dalam bentuk Base64.
     * @param {string} path
     * @param {string} base64Content  base64 tanpa prefix data URI
     * @param {string} message
     */
    async uploadBinary(path, base64Content, message) {
      const { branch } = Config.getAll();
      const body = {
        message: message || `Upload ${path}`,
        content: base64Content,
        branch,
      };
      return request(repoUrl(path), {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },

    /**
     * Hapus file.
     * @param {string} path
     * @param {string} sha
     * @param {string} message
     */
    async deleteFile(path, sha, message) {
      const { branch } = Config.getAll();
      const body = {
        message: message || `Delete ${path}`,
        sha,
        branch,
      };
      return request(repoUrl(path), {
        method: "DELETE",
        body: JSON.stringify(body),
      });
    },

    /**
     * Pastikan repository & branch dapat diakses.
     * @returns {Promise<{ok:boolean, error?:string}>}
     */
    async verifyRepo() {
      try {
        const { owner, repo, branch } = Config.getAll();
        const url = `${API_BASE}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
        const res = await fetch(url, { headers: headers() });
        if (res.status === 404) {
          return { ok: false, error: "Repository atau branch tidak ditemukan. Periksa kembali nama owner, repo, dan branch." };
        }
        if (res.status === 403) {
          return { ok: false, error: "Token tidak punya akses ke repository ini. Pastikan permission 'Contents' sudah aktif." };
        }
        if (!res.ok) {
          return { ok: false, error: `GitHub merespons status ${res.status}.` };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: "Gagal memverifikasi repository." };
      }
    },
  };
})();
