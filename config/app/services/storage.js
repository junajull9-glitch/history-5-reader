(function () {
  const prefix = 'history-reader:';
  window.ReaderStorage = {
    load(key, fallback) {
      try {
        const value = JSON.parse(localStorage.getItem(prefix + key));
        return value ?? fallback;
      } catch (_) {
        return fallback;
      }
    },
    save(key, value) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch (_) {}
    }
  };
})();
