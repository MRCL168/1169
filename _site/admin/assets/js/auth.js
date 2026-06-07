/* ============================================================
   auth.js — Autentikasi via GitHub Personal Access Token
   Memvalidasi token dengan memanggil endpoint /user.
   ============================================================ */

const Auth = (() => {
  const API_BASE = "https://api.github.com";

  return {
    /**
     * Validasi token dengan memanggil GET /user.
     * @param {string} token
     * @returns {Promise<{ok:boolean, user?:object, error?:string}>}
     */
    async validateToken(token) {
      try {
        const res = await fetch(`${API_BASE}/user`, {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });

        if (res.status === 401) {
          return { ok: false, error: "Token tidak valid atau sudah kedaluwarsa." };
        }
        if (!res.ok) {
          return { ok: false, error: `GitHub merespons dengan status ${res.status}.` };
        }

        const user = await res.json();
        return { ok: true, user };
      } catch (err) {
        return { ok: false, error: "Gagal terhubung ke GitHub. Periksa koneksi internet Anda." };
      }
    },

    /** Ambil data user yang sedang login (jika token valid) */
    async getCurrentUser() {
      const token = Config.getToken();
      if (!token) return null;
      const result = await this.validateToken(token);
      return result.ok ? result.user : null;
    },
  };
})();
