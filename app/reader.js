'use strict';

const config = window.READER_CONFIG;
const { load, save } = window.ReaderStorage;
const $ = selector => document.querySelector(selector);
const frame = $('#bookFrame');
const imageViewer = $('#imageViewer');
const imageViewerCanvas = $('#imageViewerCanvas');
const imageViewerImage = $('#imageViewerImage');
const imageViewerCaption = $('#imageViewerCaption');
const imageViewerClose = $('#imageViewerClose');
const imageViewerZoomOut = $('#imageViewerZoomOut');
const imageViewerZoomIn = $('#imageViewerZoomIn');
const imageViewerReset = $('#imageViewerReset');
const imageViewerZoomValue = $('#imageViewerZoomValue');


/* ==========================================================
   ПОДКЛЮЧЕНИЕ ИНТЕРАКТИВНЫХ МОДУЛЕЙ

   Интерактив запускается только для изображения внутри OBJ_map.
   Ключ реестра строится автоматически из имени файла изображения:

       p022_01.jpg -> p22_1
       p22-01.jpg  -> p22_1

   Чтобы добавить следующий модуль:
   1. распакуйте его в папку modules;
   2. добавьте одну строку в INTERACTIVE_MODULES.
   ========================================================== */
const INTERACTIVE_MODULES = Object.freeze({
  p22_1: 'modules/interactive_map_001/index.html',
  p45_1: 'modules/interactive_map_002/index.html',
  p51_1: 'modules/interactive_map_003/index.html',
  p66_1: 'modules/interactive_map_004/index.html',
  p68_1: 'modules/interactive_map_005/index.html',
  p79_1: 'modules/interactive_map_006/index.html',
  p118_1: 'modules/interactive_map_007/index.html'
});

function getImageFileKey(src) {
  const clean = String(src || '').trim().split('#')[0].split('?')[0];
  if (!clean) return '';

  const fileName = clean.split('/').pop()?.split('\\').pop() || '';
  let decoded = fileName;
  try { decoded = decodeURIComponent(fileName); } catch (_) {}

  const stem = decoded
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase();

  // Нормализуем типичные имена экспорта InDesign:
  // p022_01, p22-01, P022-001 -> p22_1.
  const numbered = stem.match(/^p0*(\d+)[_\- ]+0*(\d+)$/i);
  if (numbered) {
    return `p${Number(numbered[1])}_${Number(numbered[2])}`;
  }

  return stem.replace(/[\s-]+/g, '_');
}

function getInteractiveModule(payload = {}) {
  const candidates = [
    payload.imageKey,
    payload.originalSrc,
    payload.currentSrc,
    payload.src
  ];

  for (const value of candidates) {
    const key = getImageFileKey(value);
    if (!key || !INTERACTIVE_MODULES[key]) continue;

    // Основное правило: интерактив открывается для OBJ_map.
    // Для уже собранных книг оставляем безопасную привязку по реестру,
    // чтобы зарегистрированная карта не уходила в обычное увеличение,
    // даже если старый экспорт сохранил класс OBJ_Figure.
    if (payload.isInteractiveMap || payload.objectStyle === 'OBJ_map' || INTERACTIVE_MODULES[key]) {
      return INTERACTIVE_MODULES[key];
    }
  }

  return '';
}

const interactiveModuleViewer = $('#interactiveModuleViewer');
const interactiveModuleFrame = $('#interactiveModuleFrame');
const interactiveModuleClose = $('#interactiveModuleClose');

function closeInteractiveModule() {
  if (!interactiveModuleViewer || interactiveModuleViewer.hidden) return;
  interactiveModuleViewer.hidden = true;
  interactiveModuleViewer.setAttribute('aria-hidden', 'true');
  interactiveModuleFrame.removeAttribute('src');
  document.body.classList.remove('interactive-module-open');
}

function openInteractiveModule(modulePath) {
  const path = String(modulePath || '').trim();
  if (!path || !interactiveModuleViewer || !interactiveModuleFrame) return;

  closeImageViewer();
  interactiveModuleFrame.src = path;
  interactiveModuleViewer.hidden = false;
  interactiveModuleViewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('interactive-module-open');
  requestAnimationFrame(() => interactiveModuleClose?.focus());
}

interactiveModuleClose?.addEventListener('click', closeInteractiveModule);
interactiveModuleViewer?.addEventListener('click', event => {
  if (event.target === interactiveModuleViewer) closeInteractiveModule();
});

const imageViewerState = {
  fitScale: 1,
  zoom: 1,
  x: 0,
  y: 0,
  dragging: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  displayMode: 'fit',
  sourceWidth: 0,
  sourceHeight: 0
};

function clampImageViewerPan() {
  if (!imageViewerCanvas || !imageViewerImage) return;
  const scale = imageViewerState.fitScale * imageViewerState.zoom;
  const shownWidth = imageViewerImage.naturalWidth * scale;
  const shownHeight = imageViewerImage.naturalHeight * scale;
  const maxX = Math.max(0, (shownWidth - imageViewerCanvas.clientWidth) / 2);
  const maxY = Math.max(0, (shownHeight - imageViewerCanvas.clientHeight) / 2);
  imageViewerState.x = Math.max(-maxX, Math.min(maxX, imageViewerState.x));
  imageViewerState.y = Math.max(-maxY, Math.min(maxY, imageViewerState.y));
}

function renderImageViewer() {
  if (!imageViewerImage) return;
  clampImageViewerPan();
  const scale = imageViewerState.fitScale * imageViewerState.zoom;
  imageViewerImage.style.transform = `translate(-50%, -50%) translate(${imageViewerState.x}px, ${imageViewerState.y}px) scale(${scale})`;
  imageViewerCanvas?.classList.toggle('is-zoomed', imageViewerState.zoom > 1.001);
  if (imageViewerZoomValue) imageViewerZoomValue.textContent = `${Math.round(imageViewerState.zoom * 100)}%`;
}

function fitImageViewer() {
  if (!imageViewerCanvas || !imageViewerImage.naturalWidth || !imageViewerImage.naturalHeight) return;
  const availableWidth = Math.max(1, imageViewerCanvas.clientWidth - 8);
  const availableHeight = Math.max(1, imageViewerCanvas.clientHeight - 8);
  const viewportFitScale = Math.min(
    availableWidth / imageViewerImage.naturalWidth,
    availableHeight / imageViewerImage.naturalHeight
  );
  if (imageViewerState.displayMode === 'qr-200' && imageViewerState.sourceWidth > 0 && imageViewerState.sourceHeight > 0) {
    const doubleSourceScale = Math.min(
      (imageViewerState.sourceWidth * 2) / imageViewerImage.naturalWidth,
      (imageViewerState.sourceHeight * 2) / imageViewerImage.naturalHeight
    );
    imageViewerState.fitScale = Math.min(viewportFitScale, doubleSourceScale);
  } else {
    imageViewerState.fitScale = viewportFitScale;
  }
  imageViewerState.zoom = 1;
  imageViewerState.x = 0;
  imageViewerState.y = 0;
  renderImageViewer();
}

function setImageViewerZoom(nextZoom, focusX = 0, focusY = 0) {
  const previous = imageViewerState.zoom;
  const next = Math.max(1, Math.min(6, nextZoom));
  if (Math.abs(next - previous) < 0.001) return;

  // Keep the point under the cursor visually stable while zooming.
  const ratio = next / previous;
  imageViewerState.x = focusX - (focusX - imageViewerState.x) * ratio;
  imageViewerState.y = focusY - (focusY - imageViewerState.y) * ratio;
  imageViewerState.zoom = next;
  renderImageViewer();
}

function closeImageViewer() {
  if (!imageViewer || imageViewer.hidden) return;
  imageViewer.hidden = true;
  imageViewer.setAttribute('aria-hidden', 'true');
  imageViewerImage.removeAttribute('src');
  imageViewerImage.removeAttribute('style');
  imageViewerImage.alt = '';
  imageViewerCaption.textContent = '';
  imageViewerCanvas?.classList.remove('is-zoomed', 'is-dragging');
  imageViewerState.dragging = false;
  imageViewerState.displayMode = 'fit';
  imageViewerState.sourceWidth = 0;
  imageViewerState.sourceHeight = 0;
  document.body.classList.remove('image-viewer-open');
}

function openImageViewer(payload = {}) {
  const src = String(payload.src || '').trim();
  if (!src) return;

  const interactiveModule = getInteractiveModule(payload);
  if (interactiveModule) {
    openInteractiveModule(interactiveModule);
    return;
  }

  imageViewerState.displayMode = payload.displayMode === 'qr-200' ? 'qr-200' : 'fit';
  imageViewerState.sourceWidth = Number(payload.sourceWidth) || 0;
  imageViewerState.sourceHeight = Number(payload.sourceHeight) || 0;
  imageViewerImage.onload = () => requestAnimationFrame(fitImageViewer);
  imageViewerImage.src = src;
  imageViewerImage.alt = String(payload.alt || 'Увеличенное изображение');
  imageViewerCaption.textContent = String(payload.caption || payload.alt || '').trim();
  imageViewer.hidden = false;
  imageViewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('image-viewer-open');
  requestAnimationFrame(() => {
    if (imageViewerImage.complete && imageViewerImage.naturalWidth) fitImageViewer();
    imageViewerClose.focus();
  });
}

imageViewerClose?.addEventListener('click', closeImageViewer);
imageViewer?.addEventListener('click', event => {
  if (event.target === imageViewer) closeImageViewer();
});
imageViewerZoomIn?.addEventListener('click', () => setImageViewerZoom(imageViewerState.zoom * 1.25));
imageViewerZoomOut?.addEventListener('click', () => setImageViewerZoom(imageViewerState.zoom / 1.25));
imageViewerReset?.addEventListener('click', fitImageViewer);

imageViewerCanvas?.addEventListener('wheel', event => {
  if (imageViewer.hidden) return;
  event.preventDefault();
  const rect = imageViewerCanvas.getBoundingClientRect();
  const focusX = event.clientX - (rect.left + rect.width / 2);
  const focusY = event.clientY - (rect.top + rect.height / 2);
  const factor = event.deltaY < 0 ? 1.14 : 1 / 1.14;
  setImageViewerZoom(imageViewerState.zoom * factor, focusX, focusY);
}, { passive: false });

imageViewerCanvas?.addEventListener('dblclick', event => {
  event.preventDefault();
  const rect = imageViewerCanvas.getBoundingClientRect();
  const focusX = event.clientX - (rect.left + rect.width / 2);
  const focusY = event.clientY - (rect.top + rect.height / 2);
  setImageViewerZoom(imageViewerState.zoom > 1.05 ? 1 : 2, focusX, focusY);
});

imageViewerCanvas?.addEventListener('pointerdown', event => {
  if (imageViewerState.zoom <= 1.001) return;
  imageViewerState.dragging = true;
  imageViewerState.pointerId = event.pointerId;
  imageViewerState.startX = event.clientX;
  imageViewerState.startY = event.clientY;
  imageViewerState.originX = imageViewerState.x;
  imageViewerState.originY = imageViewerState.y;
  imageViewerCanvas.setPointerCapture(event.pointerId);
  imageViewerCanvas.classList.add('is-dragging');
  event.preventDefault();
});

imageViewerCanvas?.addEventListener('pointermove', event => {
  if (!imageViewerState.dragging || event.pointerId !== imageViewerState.pointerId) return;
  imageViewerState.x = imageViewerState.originX + event.clientX - imageViewerState.startX;
  imageViewerState.y = imageViewerState.originY + event.clientY - imageViewerState.startY;
  renderImageViewer();
});

function stopImageViewerDrag(event) {
  if (!imageViewerState.dragging || event.pointerId !== imageViewerState.pointerId) return;
  imageViewerState.dragging = false;
  imageViewerCanvas?.classList.remove('is-dragging');
  try { imageViewerCanvas?.releasePointerCapture(event.pointerId); } catch (_) {}
}
imageViewerCanvas?.addEventListener('pointerup', stopImageViewerDrag);
imageViewerCanvas?.addEventListener('pointercancel', stopImageViewerDrag);

window.addEventListener('resize', () => {
  if (imageViewer && !imageViewer.hidden) fitImageViewer();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && interactiveModuleViewer && !interactiveModuleViewer.hidden) {
    event.preventDefault();
    closeInteractiveModule();
    return;
  }
  if (!imageViewer || imageViewer.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeImageViewer();
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    setImageViewerZoom(imageViewerState.zoom * 1.25);
  } else if (event.key === '-') {
    event.preventDefault();
    setImageViewerZoom(imageViewerState.zoom / 1.25);
  } else if (event.key === '0') {
    event.preventDefault();
    fitImageViewer();
  }
});


const defaultFontIndex = 1;
let fontIndex = load('fontIndex', defaultFontIndex);
// Migration from the previous five-step scale (85, 100, 115, 130, 145%).
if (!Number.isInteger(fontIndex) || fontIndex < 0 || fontIndex >= config.fontSteps.length) {
  const oldScale = Number(load('fontScale', 1)) || 1;
  fontIndex = oldScale < 0.93 ? 0 : (oldScale > 1.12 ? 2 : 1);
}
fontIndex = Math.max(0, Math.min(config.fontSteps.length - 1, Number(fontIndex)));
const pageZoomStorageKey = 'history-reader:pageZoom';
let pageZoomIsAutomatic = localStorage.getItem(pageZoomStorageKey) === null;

function isMobileReader() { return window.matchMedia('(max-width: 820px)').matches; }

function syncMobileReaderControls() {
  const mobile = isMobileReader();
  document.documentElement.classList.toggle('is-mobile-reader', mobile);
  const zoom = document.querySelector('.zoom-controls');
  const fonts = document.querySelector('.font-controls');
  if (zoom) {
    zoom.hidden = mobile;
    zoom.style.display = mobile ? 'none' : '';
    zoom.setAttribute('aria-hidden', mobile ? 'true' : 'false');
  }
  if (fonts) {
    fonts.hidden = false;
    fonts.style.display = mobile ? 'flex' : '';
    fonts.setAttribute('aria-hidden', 'false');
  }
}
syncMobileReaderControls();

function calculateAutomaticPageZoom() {
  if (isMobileReader()) return 1;
  const widthFit = window.innerWidth / 1500;
  const heightFit = window.innerHeight / 900;
  return Math.max(0.6, Math.min(1, Math.floor(Math.min(widthFit, heightFit) * 20) / 20));
}

let pageZoom = pageZoomIsAutomatic
  ? calculateAutomaticPageZoom()
  : (Number(load('pageZoom', 1)) || 1);
pageZoom = isMobileReader() ? 1 : Math.max(0.6, Math.min(1.6, pageZoom));

function applyInterfaceScale(scale) {
  const value = Math.max(0.55, Math.min(1.5, Number(scale) || 1));
  document.documentElement.style.setProperty('--ui-scale', value);
}
applyInterfaceScale(1);
let notes = load('notes', []);
let currentState = load('position', { page: '1', pageIndex: 0 });
let searchTimer;
let editingNote = null;
let pendingSelection = null;
let noteColor = '#ffe58a';

$('#bookTitle').textContent = config.title;
frame.src = config.bookUrl;


function send(type, payload = {}) {
  frame.contentWindow?.postMessage({ source: 'reader-shell', type, payload }, '*');
}

addEventListener('message', event => {
  const message = event.data || {};
  if (message.source !== 'reader-book') return;

  if (message.type === 'ready') send('init', { fontIndex, pageZoom, position: currentState, notes, bookmarks: window.ReaderBookmarks.getItems() });

  if (message.type === 'state') {
    currentState = message.payload || currentState;
    $('#pageInput').value = currentState.page || '1';
    save('position', currentState);
  }

  if (message.type === 'toc') buildToc(message.payload || []);

  if (message.type === 'openImageViewer') openImageViewer(message.payload || {});

  if (message.type === 'searchResult') {
    const { total, index } = message.payload || { total: 0, index: -1 };
    $('#searchCount').textContent = total ? `${index + 1}/${total}` : '0';
  }

  if (message.type === 'notesReanchored' && Array.isArray(message.payload?.notes)) {
    notes = message.payload.notes;
    save('notes', notes);
    renderNotes();
  }

  if (message.type === 'font') {
    fontIndex = message.payload.index;
    $('#fontScale').textContent = Math.round(message.payload.scale * 100) + '%';
    save('fontIndex', fontIndex);
  }

  if (message.type === 'pageZoom') {
    pageZoom = Math.max(0.6, Math.min(1.6, Number(message.payload.scale) || 1));
    $('#pageZoomRange').value = String(Math.round(pageZoom * 100));
    $('#pageZoomValue').textContent = Math.round(pageZoom * 100) + '%';
    save('pageZoom', pageZoom);
  }

  if (message.type === 'selectionAvailable') pendingSelection = message.payload || null;

  if (message.type === 'selection' || message.type === 'requestNote') {
    openNewNote(message.payload || pendingSelection || null);
  }

  window.ReaderBookmarks.handleMessage(message);
  if (message.type === 'noteActivated') {
    const index = notes.findIndex(note => String(note.id) === String(message.payload?.id));
    if (index >= 0) openNote(index);
  }
});

function buildToc(items) {
  const list = $('#tocList');
  list.innerHTML = '';

  items.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toc-item level-' + item.level;
    button.textContent = item.title;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      send('gotoToc', {
        target: item.target,
        pageIndex: Number(item.pageIndex),
      });
      if (isMobileReader()) window.closeMobileDrawers?.();
    });
    list.appendChild(button);
  });

  if (!items.length) {
    list.innerHTML = '<p style="padding:12px">В книге не найдены абзацы со стилями <code>Chapter1</code> и <code>Paragraph</code>.</p>';
  }
}

function turn(delta) {
  send('page', { delta });
}


$('#prevBtn').onclick = $('#bottomPrev').onclick = () => turn(-1);
$('#nextBtn').onclick = $('#bottomNext').onclick = () => turn(1);
$('#homeBtn').onclick = () => send('home');

function submitPageNumber() {
  const input = $('#pageInput');
  const value = String(input?.value || '').trim();
  if (!value) return;
  send('gotoPage', { page: value });
  input?.blur();
}
$('#pageInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitPageNumber();
  }
});
$('#pageInput').addEventListener('change', submitPageNumber);
$('#pageGo')?.addEventListener('click', submitPageNumber);

$('#fontDown').onclick = () => send('font', { index: Math.max(0, fontIndex - 1) });
$('#fontUp').onclick = () => send('font', { index: Math.min(config.fontSteps.length - 1, fontIndex + 1) });
applyInterfaceScale(1);
$('#fontScale').textContent = Math.round(config.fontSteps[fontIndex] * 100) + '%';

const pageZoomRange = $('#pageZoomRange');
pageZoomRange.value = String(Math.round(pageZoom * 100));
$('#pageZoomValue').textContent = Math.round(pageZoom * 100) + '%';
pageZoomRange.addEventListener('input', event => {
  if (isMobileReader()) { event.target.value = '100'; return; }
  const scale = Math.max(0.6, Math.min(1.6, Number(event.target.value) / 100 || 1));
  pageZoomIsAutomatic = false;
  pageZoom = scale;
  $('#pageZoomValue').textContent = Math.round(scale * 100) + '%';
  save('pageZoom', scale);
  send('pageZoom', { scale });
});

let automaticZoomResizeTimer = 0;
window.addEventListener('resize', () => {
  syncMobileReaderControls();
  if (!pageZoomIsAutomatic) return;
  clearTimeout(automaticZoomResizeTimer);
  automaticZoomResizeTimer = setTimeout(() => {
    const scale = calculateAutomaticPageZoom();
    if (Math.abs(scale - pageZoom) < 0.001) return;
    pageZoom = scale;
    pageZoomRange.value = String(Math.round(scale * 100));
    $('#pageZoomValue').textContent = Math.round(scale * 100) + '%';
    send('pageZoom', { scale });
  }, 120);
});

const searchInput = $('#searchInput');
const searchClear = $('#searchClear');

function syncSearchClearButton() {
  if (!searchClear) return;
  searchClear.hidden = !String(searchInput?.value || '').length;
}

searchInput.addEventListener('input', event => {
  clearTimeout(searchTimer);
  syncSearchClearButton();
  searchTimer = setTimeout(() => send('search', { query: event.target.value }), 220);
});

searchClear?.addEventListener('click', event => {
  event.preventDefault();
  clearTimeout(searchTimer);
  searchInput.value = '';
  syncSearchClearButton();
  send('clearSearch', { preservePosition: true });
  searchInput.focus({ preventScroll: true });
});

syncSearchClearButton();
$('#searchNext').onclick = () => send('searchNext');
$('#searchPrev').onclick = () => send('searchPrev');

function locationRecord() {
  return {
    page: String(currentState.page || '1'),
    created: Date.now()
  };
}

function gotoRecord(record) {
  send('gotoPage', { page: record.page });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}


function syncColorButtons() {
  document.querySelectorAll('.note-color').forEach(button => {
    button.classList.toggle('selected', button.dataset.color === noteColor);
  });
}

function openNewNote(anchor) {
  pendingSelection = anchor || null;
  editingNote = null;
  noteColor = '#ffe58a';
  $('#noteText').value = '';
  $('#noteSelectionHint').textContent = pendingSelection
    ? `Заметка будет привязана к выделенному фрагменту: «${pendingSelection.quote.slice(0, 110)}${pendingSelection.quote.length > 110 ? '…' : ''}»`
    : 'Текст не выделен. Заметка будет привязана к текущей странице.';
  syncColorButtons();
  $('#noteDialog').showModal();
}

$('#addNote').onclick = () => send('getSelection');

document.querySelectorAll('.note-color').forEach(button => {
  button.onclick = event => {
    event.preventDefault();
    noteColor = button.dataset.color;
    syncColorButtons();
  };
});

function openNote(index) {
  editingNote = index;
  pendingSelection = notes[index].anchor || null;
  $('#noteText').value = notes[index].text;
  noteColor = notes[index].color || '#ffe58a';
  syncColorButtons();
  $('#noteSelectionHint').textContent = notes[index].anchor
    ? `Заметка привязана к фрагменту: «${notes[index].anchor.quote.slice(0, 90)}${notes[index].anchor.quote.length > 90 ? '…' : ''}»`
    : `Заметка привязана к странице, стр. ${notes[index].page}.`;
  $('#noteDialog').showModal();
}

$('#saveNote').onclick = event => {
  event.preventDefault();
  const text = $('#noteText').value.trim();
  if (!text) return;

  if (editingNote === null) {
    notes.unshift({
      ...locationRecord(),
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      text,
      color: noteColor,
      anchor: pendingSelection || null
    });
  } else {
    notes[editingNote].text = text;
    notes[editingNote].color = noteColor;
  }

  save('notes', notes);
  renderNotes();
  send('applyNotes', { notes });
  $('#noteDialog').close();
  pendingSelection = null;
  editingNote = null;
};

function renderNotes() {
  const host = $('#noteList');
  host.innerHTML = '';
  notes.forEach((note, index) => {
    const element = document.createElement('div');
    element.className = 'item-card' + (note.anchor ? ' anchored-note' : '');
    element.innerHTML = `<span class="note-swatch" style="background:${escapeHtml(note.color || '#ffe58a')}"></span><b>${escapeHtml(note.text.slice(0, 65))}${note.text.length > 65 ? '…' : ''}</b><small>${note.anchor ? 'выделенный фрагмент · ' : ''}стр. ${escapeHtml(note.page)}</small><button class="edit-item" type="button" title="Редактировать заметку" aria-label="Редактировать заметку">✎</button><button class="delete-item" type="button" title="Удалить заметку" aria-label="Удалить заметку">×</button>`;
    element.onclick = event => {
      if (event.target.closest('.edit-item, .delete-item')) return;
      event.preventDefault();
      event.stopPropagation();

      if (note.anchor) send('gotoNote', { note });
      else gotoRecord(note);
      if (isMobileReader()) window.closeMobileDrawers?.();
    };
    element.querySelector('.edit-item').onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      openNote(index);
    };
    element.querySelector('.delete-item').onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      notes.splice(index, 1);
      save('notes', notes);
      renderNotes();
      send('applyNotes', { notes });
    };
    host.appendChild(element);
  });
  if (!notes.length) host.innerHTML = '<p style="padding:10px">Выделите текст в учебнике и нажмите «＋», чтобы прикрепить заметку к фрагменту.</p>';
}

const appShell = $('.app-shell');
const readerStage = $('.reader-stage');

function freezeReaderPageSize() {
  const rect = readerStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  appShell.style.setProperty('--reader-frozen-width', rect.width + 'px');
  appShell.style.setProperty('--reader-frozen-height', rect.height + 'px');
  appShell.classList.add('reader-pages-frozen');
}

function releaseReaderPageSize() {
  appShell.classList.remove('reader-pages-frozen');
  appShell.style.removeProperty('--reader-frozen-width');
  appShell.style.removeProperty('--reader-frozen-height');
}

$('#fullscreenBtn').onclick = async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  releaseReaderPageSize();
  try {
    await document.documentElement.requestFullscreen();
  } catch (error) {
    console.error('Не удалось включить полноэкранный режим:', error);
  }
};

document.addEventListener('fullscreenchange', () => {
  releaseReaderPageSize();
  window.dispatchEvent(new Event('resize'));
});
const tocPanel = $('#tocPanel');
const toggleTocButton = $('#toggleToc');
const closeTocButton = $('#closeToc');

function setTocOpen(isOpen) {
  if (!tocPanel) return;

  tocPanel.classList.toggle('is-open', isOpen);
  tocPanel.classList.toggle('is-closed', !isOpen);
  tocPanel.setAttribute('aria-hidden', String(!isOpen));

  if (toggleTocButton) {
    toggleTocButton.setAttribute('aria-expanded', String(isOpen));
  }
}

if (toggleTocButton) {
  toggleTocButton.onclick = () => setTocOpen(true);
}

if (closeTocButton) {
  closeTocButton.onclick = () => setTocOpen(false);
}
const addBookmarkButton = $('#addBookmark');
if (addBookmarkButton) {
  addBookmarkButton.onclick = () => {
    send('toggleCurrentPageBookmark');
  };
}





/* ==========================================================
   Desktop collapsible Bookmarks / Notes panels.
   Mobile drawer logic below remains independent.
   ========================================================== */
(function initDesktopRightPanels(){
  const workspace = document.querySelector('.workspace');
  const rightColumn = document.querySelector('.right-column');
  const bookmarksPanel = document.getElementById('bookmarksPanel');
  const notesPanel = document.getElementById('notesPanel');
  const bookmarksToggle = document.getElementById('desktopBookmarksToggle');
  const notesToggle = document.getElementById('desktopNotesToggle');
  if (!workspace || !rightColumn || !bookmarksPanel || !notesPanel || !bookmarksToggle || !notesToggle) return;

  const desktopQuery = window.matchMedia('(min-width: 821px)');
  const compactDesktopQuery = window.matchMedia('(min-width: 821px) and (max-width: 1100px)');
  const initiallyWide = window.matchMedia('(min-width: 1281px)').matches;
  let bookmarksOpen = initiallyWide;
  let notesOpen = initiallyWide;
  let wasCompact = compactDesktopQuery.matches;

  function render(){
    const compactNow = compactDesktopQuery.matches;
    if (compactNow && !wasCompact) {
      bookmarksOpen = false;
      notesOpen = false;
    }
    wasCompact = compactNow;
    if (!desktopQuery.matches) {
      workspace.classList.remove('desktop-right-collapsed');
      rightColumn.classList.remove('desktop-bookmarks-closed','desktop-notes-closed','desktop-right-drawer');
      bookmarksToggle.classList.remove('is-active');
      notesToggle.classList.remove('is-active');
      bookmarksToggle.setAttribute('aria-expanded','false');
      notesToggle.setAttribute('aria-expanded','false');
      return;
    }

    rightColumn.classList.toggle('desktop-bookmarks-closed', !bookmarksOpen);
    rightColumn.classList.toggle('desktop-notes-closed', !notesOpen);
    rightColumn.classList.toggle('desktop-right-drawer', window.matchMedia('(max-width: 1280px)').matches);
    workspace.classList.toggle('desktop-right-collapsed', !bookmarksOpen && !notesOpen);

    bookmarksToggle.classList.toggle('is-active', bookmarksOpen);
    notesToggle.classList.toggle('is-active', notesOpen);
    bookmarksToggle.setAttribute('aria-expanded', String(bookmarksOpen));
    notesToggle.setAttribute('aria-expanded', String(notesOpen));
  }

  bookmarksToggle.addEventListener('click', () => {
    if (!desktopQuery.matches) return;
    bookmarksOpen = !bookmarksOpen;
    render();
  });

  notesToggle.addEventListener('click', () => {
    if (!desktopQuery.matches) return;
    notesOpen = !notesOpen;
    render();
  });

  window.addEventListener('resize', render);
  desktopQuery.addEventListener?.('change', render);
  render();
})();





/* Desktop height is controlled by the app-shell CSS grid. */

/* ==========================================================
   Desktop collapsible Table of Contents panel.
   Mobile TOC drawer remains controlled by #toggleToc.
   ========================================================== */
(function initDesktopTocPanel(){
  const workspace = document.querySelector('.workspace');
  const toc = document.getElementById('tocPanel');
  const tocToggle = document.getElementById('desktopTocToggle');
  if (!workspace || !toc || !tocToggle) return;

  const desktopQuery = window.matchMedia('(min-width: 821px)');
  const compactDesktopQuery = window.matchMedia('(min-width: 821px) and (max-width: 1100px)');
  const initiallyWide = window.matchMedia('(min-width: 1281px)').matches;
  let tocOpen = initiallyWide;
  let wasCompact = compactDesktopQuery.matches;

  function render(){
    const compactNow = compactDesktopQuery.matches;
    if (compactNow && !wasCompact) tocOpen = false;
    wasCompact = compactNow;
    if (!desktopQuery.matches) {
      workspace.classList.remove('desktop-toc-collapsed');
      toc.classList.remove('desktop-toc-drawer');
      tocToggle.classList.remove('is-active');
      tocToggle.setAttribute('aria-expanded','false');
      return;
    }

    const drawerMode = window.matchMedia('(max-width: 1280px)').matches;
    toc.classList.toggle('desktop-toc-drawer', drawerMode && tocOpen);
    workspace.classList.toggle('desktop-toc-collapsed', !tocOpen);

    /* Keep the existing TOC state classes synchronized without using
       the mobile top button as the desktop control. */
    toc.classList.toggle('is-open', tocOpen);
    toc.classList.toggle('is-closed', !tocOpen);
    toc.setAttribute('aria-hidden', String(!tocOpen));

    tocToggle.classList.toggle('is-active', tocOpen);
    tocToggle.setAttribute('aria-expanded', String(tocOpen));
  }

  tocToggle.addEventListener('click', () => {
    if (!desktopQuery.matches) return;
    tocOpen = !tocOpen;
    render();
  });

  /* The cross in the panel also closes it on desktop. */
  closeTocButton?.addEventListener('click', () => {
    if (!desktopQuery.matches) return;
    tocOpen = false;
    render();
  });

  window.addEventListener('resize', render);
  desktopQuery.addEventListener?.('change', render);
  render();
})();


/* Мобильные выдвижные панели. */
(function initMobileShell(){
  const backdrop=document.getElementById('mobileDrawerBackdrop');
  const bookmarksButton=document.getElementById('mobileBookmarks');
  const notesButton=document.getElementById('mobileNotes');
  const closeBookmarks=document.getElementById('closeBookmarks');
  const closeNotes=document.getElementById('closeNotes');
  const isMobile=()=>window.matchMedia('(max-width: 820px)').matches;
  const setDrawerAria=(name,open)=>{
    bookmarksButton?.setAttribute('aria-expanded',String(name==='bookmarks'&&open));
    notesButton?.setAttribute('aria-expanded',String(name==='notes'&&open));
  };
  function updateBackdrop(){
    const open=isMobile()&&(tocPanel?.classList.contains('is-open')||document.body.classList.contains('mobile-bookmarks-open')||document.body.classList.contains('mobile-notes-open'));
    if(backdrop)backdrop.hidden=!open;
  }
  function closeMobileDrawers(){
    document.body.classList.remove('mobile-bookmarks-open','mobile-notes-open');
    setDrawerAria('',false);
    if(isMobile())setTocOpen(false);
    updateBackdrop();
  }
  window.closeMobileDrawers=closeMobileDrawers;
  document.addEventListener('reader:navigate-panel-item',()=>{if(isMobile())closeMobileDrawers()});
  bookmarksButton?.addEventListener('click',()=>{
    const willOpen=!document.body.classList.contains('mobile-bookmarks-open');
    setTocOpen(false);document.body.classList.toggle('mobile-bookmarks-open',willOpen);document.body.classList.remove('mobile-notes-open');setDrawerAria('bookmarks',willOpen);updateBackdrop();
  });
  notesButton?.addEventListener('click',()=>{
    const willOpen=!document.body.classList.contains('mobile-notes-open');
    setTocOpen(false);document.body.classList.toggle('mobile-notes-open',willOpen);document.body.classList.remove('mobile-bookmarks-open');setDrawerAria('notes',willOpen);updateBackdrop();
  });
  closeBookmarks?.addEventListener('click',closeMobileDrawers);closeNotes?.addEventListener('click',closeMobileDrawers);backdrop?.addEventListener('click',closeMobileDrawers);
  toggleTocButton?.addEventListener('click',()=>{document.body.classList.remove('mobile-bookmarks-open','mobile-notes-open');setTimeout(updateBackdrop,0)});
  closeTocButton?.addEventListener('click',()=>setTimeout(updateBackdrop,0));
  document.getElementById('tocList')?.addEventListener('click',()=>{if(isMobile())closeMobileDrawers()});
  window.addEventListener('resize',()=>{if(!isMobile()){document.body.classList.remove('mobile-bookmarks-open','mobile-notes-open');backdrop&&(backdrop.hidden=true)}else if(!tocPanel?.classList.contains('is-open')){setTocOpen(false)}});
  if(isMobile())setTocOpen(false);
})();


// Mobile reader allows vertical scrolling and controls, but not browser page zoom.
(function disableMobileBrowserZoom(){
  const mobile=()=>window.matchMedia('(max-width: 820px)').matches;
  let lastTouchEnd=0;
  document.addEventListener('touchend',event=>{
    if(!mobile()) return;
    const target=event.target;
    if(target?.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
    const now=Date.now();
    if(now-lastTouchEnd<320) event.preventDefault();
    lastTouchEnd=now;
  },{passive:false});
  document.addEventListener('gesturestart',event=>{if(mobile())event.preventDefault()},{passive:false});
})();

window.ReaderBookmarks.init({ storage: window.ReaderStorage, send, listHost: $("#bookmarkList") });
renderNotes();

/* ==========================================================
   Единый визуальный размер интерфейса на разных ноутбуках.
   Эталон: 1500 x 900 CSS px. На меньшем экране масштабируется
   вся читалка, включая панели и интерактивные окна.
   ========================================================== */
(function initUniversalReaderFit() {
  const ROOT = document.documentElement;
  const REFERENCE_WIDTH = 1500;
  const REFERENCE_HEIGHT = 900;
  let timer = 0;

  function applyReaderShellFit() {
    const viewportWidth = Math.max(320, window.innerWidth || REFERENCE_WIDTH);
    const viewportHeight = Math.max(240, window.innerHeight || REFERENCE_HEIGHT);
    /* On desktop, fit by HEIGHT only. Narrowing the browser window must
       activate the compact horizontal layout, not shrink the whole UI to
       an unreadable miniature. The logical width therefore becomes narrower
       naturally while the shell still fills the viewport vertically. */
    const heightFit = Math.min(viewportHeight / REFERENCE_HEIGHT, 1);
    const scale = viewportWidth <= 820 ? 1 : Math.max(0.68, heightFit);
    ROOT.style.setProperty('--reader-shell-scale', scale.toFixed(4));
    ROOT.dataset.readerShellScale = scale.toFixed(4);
  }

  applyReaderShellFit();
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = window.setTimeout(applyReaderShellFit, 60);
  }, { passive: true });
  document.addEventListener('fullscreenchange', () => {
    window.setTimeout(applyReaderShellFit, 30);
  });
})();
