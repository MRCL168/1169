/* ============================================================
   config.js — Manajemen konfigurasi (localStorage)
   Menyimpan: token, owner, repo, branch, dan path konten.
   ============================================================ */

const Config = (() => {
  const KEYS = {
    token: "gitcms_token",
    owner: "gitcms_owner",
    repo: "gitcms_repo",
    branch: "gitcms_branch",
    path: "gitcms_path",
  };

  return {
    /** Ambil seluruh konfigurasi sebagai objek */
    getAll() {
      return {
        token: localStorage.getItem(KEYS.token) || "",
        owner: localStorage.getItem(KEYS.owner) || "",
        repo: localStorage.getItem(KEYS.repo) || "",
        branch: localStorage.getItem(KEYS.branch) || "main",
        path: localStorage.getItem(KEYS.path) || "content/posts",
      };
    },

    /** Simpan token saja */
    setToken(token) {
      localStorage.setItem(KEYS.token, token.trim());
    },

    getToken() {
      return localStorage.getItem(KEYS.token) || "";
    },

    /** Simpan konfigurasi repository */
    setRepoConfig({ owner, repo, branch, path }) {
      localStorage.setItem(KEYS.owner, owner.trim());
      localStorage.setItem(KEYS.repo, repo.trim());
      localStorage.setItem(KEYS.branch, (branch || "main").trim());
      localStorage.setItem(KEYS.path, (path || "content/posts").trim().replace(/^\/+|\/+$/g, ""));
    },

    /** Cek apakah token sudah ada */
    hasToken() {
      return !!this.getToken();
    },

    /** Cek apakah konfigurasi repo sudah lengkap */
    hasRepoConfig() {
      const c = this.getAll();
      return !!(c.owner && c.repo);
    },

    /** Hapus token saja (logout) */
    clearToken() {
      localStorage.removeItem(KEYS.token);
    },

    /** Hapus seluruh konfigurasi */
    clearAll() {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    },
  };
})();
