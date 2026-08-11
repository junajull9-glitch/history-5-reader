(function () {
  'use strict';

  const STORAGE_KEY = 'bookmarks';
  let items = [];
  let sendToBook = null;
  let storage = null;
  let listHost = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeBookmark(raw) {
    if (!raw) return null;
    const page = String(raw.page || raw.anchor?.page || '—').trim();
    if (!page || page === '—') return null;
    const quote = cleanText(raw.quote).slice(0, 110);
    return {
      id: raw.id || ('bookmark-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      created: Number(raw.created || Date.now()),
      page,
      quote: quote || ('Закладка на странице ' + page)
    };
  }

  function persist() {
    storage.save(STORAGE_KEY, items);
  }

  function render() {
    if (!listHost) return;
    listHost.innerHTML = '';
    items.forEach(bookmark => {
      const card = document.createElement('div');
      card.className = 'item-card bookmark-card';
      card.dataset.bookmarkId = bookmark.id;
      card.innerHTML = '<span class="bookmark-ribbon" aria-hidden="true"></span>' +
        '<b>Стр. ' + escapeHtml(bookmark.page) + '</b>' +
        '<small>' + escapeHtml(bookmark.quote) + '</small>' +
        '<button class="delete-item" type="button" title="Удалить закладку" aria-label="Удалить закладку">×</button>';
      card.addEventListener('click', event => {
        if (event.target.closest('.delete-item')) return;
        sendToBook('gotoBookmark', { bookmark });
        document.dispatchEvent(new CustomEvent('reader:navigate-panel-item', { detail: { type: 'bookmark' } }));
      });
      card.querySelector('.delete-item').addEventListener('click', event => {
        event.stopPropagation();
        remove(bookmark.id);
      });
      listHost.appendChild(card);
    });
    if (!items.length) {
      listHost.innerHTML = '<p class="empty-panel-message">Нажмите «＋», чтобы добавить закладку на текущей странице.</p>';
    }
  }

  function syncBook() {
    sendToBook('applyBookmarks', { bookmarks: items });
  }

  function remove(id) {
    const next = items.filter(item => String(item.id) !== String(id));
    if (next.length === items.length) return;
    items = next;
    persist();
    render();
    syncBook();
  }

  function sameLocation(a, b) {
    return String(a.page).trim() === String(b.page).trim();
  }

  function toggle(payload) {
    const candidate = normalizeBookmark(payload);
    if (!candidate) return;
    const existing = items.find(item => sameLocation(item, candidate));
    if (existing) {
      remove(existing.id);
      return;
    }
    items.unshift(candidate);
    persist();
    render();
    syncBook();
  }

  function init(options) {
    storage = options.storage;
    sendToBook = options.send;
    listHost = options.listHost;
    const restored = (storage.load(STORAGE_KEY, []) || []).map(normalizeBookmark).filter(Boolean);
    const seenPages = new Set();
    items = restored.filter(bookmark => {
      const key = String(bookmark.page).trim();
      if (seenPages.has(key)) return false;
      seenPages.add(key);
      return true;
    });
    persist();
    render();
  }

  function handleMessage(message) {
    if (message.type === 'togglePageBookmark') toggle(message.payload);
  }

  window.ReaderBookmarks = {
    init,
    handleMessage,
    getItems: () => items.slice(),
    syncBook,
    render
  };
})();
