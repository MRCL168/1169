(function () {
  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  var storageKey = 'gitcms-news-theme';

  function preferredTheme() {
    try {
      var saved = localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(storageKey, theme); } catch (e) {}
    if (button) {
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      var text = button.querySelector('.toggle-text');
      var icon = button.querySelector('.toggle-icon');
      if (text) text.textContent = theme === 'dark' ? 'Gelap' : 'Terang';
      if (icon) icon.textContent = theme === 'dark' ? '☾' : '☼';
    }
  }

  setTheme(preferredTheme());
  if (button) {
    button.addEventListener('click', function () {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }
})();
