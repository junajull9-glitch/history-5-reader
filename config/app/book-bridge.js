(function () {
  'use strict';

  const cfg = {
    fontSteps: [0.85, 1, 1.25],
    pageMargin: 32,
    pageGap: 18,
    maxPageWidth: 794,
    // At 100% the book type remains proportional to the rendered sheet width.
    // 1.08 makes the default reading size slightly larger without turning it
    // into a fixed pixel size.
    baseFontRatio: 1.08,
    referencePageWidth: 794,
    minResponsiveFontScale: 0.82
  };

  let viewport;
  let flow;
  let pageIndex = 0;
  let stateReady = false;
  let pageCount = 1;
  let pageWidth = 0;
  let pageHeight = 0;
  let pages = [];
  let fontIndex = 1;
  let pageZoom = 1;
  let resizeTimer = 0;
  let hits = [];
  let hitIndex = -1;
  let cachedSelection = null;
  let notes = [];
  let bookmarks = [];
  let selectionToolbar = null;
  let glossaryEntries = [];
  let glossaryPopup = null;

  const post = (type, payload) => parent.postMessage({ source: 'reader-book', type, payload }, '*');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const cleanText = value => String(value || '').replace(/\s+/g, ' ').trim();

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'reader-single-page-style';
    style.textContent = `
      html,body{width:100%!important;height:100%!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;background:#d9cfbd!important;overflow:hidden!important}
      body{position:static!important;font-size:16px}
      #reader-viewport{position:fixed!important;z-index:2147483000;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;padding:0!important;overflow-x:auto!important;overflow-y:scroll!important;box-sizing:border-box!important;scrollbar-gutter:stable}
      #reader-flow{width:max(100%,calc(var(--reader-page-width,320px) + 20px));min-width:100%;min-height:100%;display:flex;justify-content:center;align-items:flex-start;padding:10px;box-sizing:border-box}
      .reader-page-sheet{display:none;box-sizing:border-box;background:#fffdfa;box-shadow:0 4px 18px #342b1e35;padding:var(--reader-page-margin);overflow:visible;flex-direction:column}
      .reader-page-sheet,.reader-page-sheet *{--reader-font-scale:var(--reader-effective-font-scale,1)!important}
      .reader-page-sheet.is-active{display:flex}
      .reader-page-content{flex:0 0 auto;min-width:0;display:flow-root}
      .reader-page-footer-spacer{flex:1 0 28px;min-height:28px}
      .reader-page-footer{display:flex;align-items:center;gap:18px;min-height:52px;margin-top:0;margin-left:calc(-1 * var(--reader-page-margin));margin-right:calc(-1 * var(--reader-page-margin));margin-bottom:calc(-1 * var(--reader-page-margin));padding:10px var(--reader-page-margin);box-sizing:border-box;background:#f7dca4;color:#17130d;border-top:1px solid #e3c27e;font:16px/1.25 Georgia,'Times New Roman',serif}
      .reader-page-footer-title{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .reader-page-footer-number{flex:0 0 auto;min-width:2.5em;text-align:right;font-weight:700;font-size:18px}
      .reader-page-sheet img{max-width:100%;height:auto}
      .reader-page-sheet table{max-width:100%}
      .Sys_PageBreak{display:none!important}
      .reader-search-hit{background:#ffe56d!important;color:#111!important;border-radius:2px}
      .reader-search-hit.is-active{outline:2px solid #a34b18}
      .reader-note-highlight{display:inline;background-image:none!important;border-radius:2px;box-shadow:inset 0 -2px rgba(0,0,0,.12);color:inherit!important;cursor:pointer}
      .reader-selection-toolbar{position:fixed;z-index:2147483646;display:flex;gap:6px;padding:6px;border-radius:8px;background:#26352c;box-shadow:0 4px 16px #0005;pointer-events:auto}
      .reader-selection-toolbar[hidden]{display:none}
      .reader-selection-toolbar button{border:0;border-radius:6px;padding:7px 10px;background:#f1e4cc;color:#29271e;cursor:pointer;font:14px Arial,sans-serif}
      @media(max-width:820px){.reader-selection-toolbar{justify-content:center;padding:8px;border-radius:12px;isolation:isolate}.reader-selection-toolbar:after{content:'';position:absolute;left:50%;bottom:-8px;width:16px;height:16px;background:#26352c;transform:translateX(-50%) rotate(45deg);z-index:-1}.reader-selection-toolbar button{width:100%;min-height:44px;padding:10px 14px;font:600 16px 'Open Sans',Arial,sans-serif}}
      .reader-clickable-image{cursor:zoom-in}
      .term-word{cursor:help;text-decoration-line:underline;text-decoration-style:dotted;text-decoration-thickness:1px;text-underline-offset:.14em}
      .reader-glossary-popup{position:fixed;z-index:2147483640;display:block;width:min(390px,calc(100vw - 24px));max-height:min(55vh,430px);overflow:auto;padding:14px 16px 15px;border:2px solid #00a9e8;border-radius:10px;background:#fff8e8;color:#17130d;box-shadow:0 10px 30px #0006;box-sizing:border-box;font-family:"PT Serif",Georgia,serif;font-size:calc(16px * var(--reader-effective-font-scale,1));line-height:1.35}
      .reader-glossary-popup[hidden]{display:none!important}
      .reader-glossary-title{margin:0 28px 7px 0;color:#c55f43;font-weight:700;font-style:italic;font-size:1.08em}
      .reader-glossary-definition{margin:0;white-space:normal}
      .reader-glossary-close{position:absolute;top:5px;right:7px;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:#26352c;cursor:pointer;font:700 22px/28px Arial,sans-serif}
      .reader-glossary-close:hover,.reader-glossary-close:focus{background:#e6f4f9;outline:none}

      @media (max-width:820px){
        html,body{background:#f2eadc!important}
        #reader-viewport{overflow-x:hidden!important;overflow-y:auto!important;scrollbar-gutter:auto!important}
        #reader-flow{width:100%!important;min-width:0!important;padding:0!important;display:block!important}
        .reader-page-sheet{width:100%!important;min-width:0!important;max-width:100%!important;min-height:100%!important;padding:var(--reader-page-margin)!important;box-shadow:none!important;overflow:visible!important}
        .reader-page-content{width:100%!important;min-width:0!important;max-width:100%!important;overflow:visible!important}
        .reader-page-content :is(h1,h2,h3,h4,h5,h6,p,div,section,article,figure,table,ul,ol){max-width:100%!important}
        .reader-page-content :is(h1,h2,h3,h4,h5,h6,.Chapter1,.Chapter2,.item){white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;word-break:normal!important}
        .reader-page-content img{display:block;max-width:100%!important;width:auto;height:auto!important;max-height:none!important;object-fit:contain!important}
        .reader-page-content table{width:100%!important;max-width:100%!important;table-layout:auto!important}
        .reader-page-content ._idGenObjectLayout-1{max-width:100%!important;min-width:0!important;overflow:visible!important}
        .reader-page-footer{min-height:42px!important;padding:7px var(--reader-page-margin)!important}
        .reader-page-footer-number{font-size:16px!important}
        .reader-page-content p.Chapter1:has(> .ChapterWord){
          min-height:90px!important;margin:10px 0 16px!important;
          padding:4px 4px 14px 108px!important;
          font-size:clamp(18px,5.1vw,22px)!important;
          line-height:1.08!important;letter-spacing:-.015em!important;
          overflow-wrap:normal!important;word-break:normal!important;
        }
        .reader-page-content p.Chapter1:has(> .ChapterWord)::before{left:91px!important;top:2px!important;bottom:8px!important;width:3px!important}
        .reader-page-content p.Chapter1:has(> .ChapterWord)::after{left:108px!important;right:6px!important;bottom:2px!important;width:auto!important}
        .reader-page-content p.Chapter1:has(> .ChapterWord)>.ChapterWord{left:0!important;top:2px!important;width:78px!important;font-size:15px!important}
        .reader-page-content p.Chapter1:has(> .ChapterWord)>.ChapterNumber{left:0!important;top:24px!important;width:78px!important;font-size:46px!important;line-height:.84!important}
        .reader-page-content p.Chapter1:has(> .ChapterWord)>.ChapterTitle{font-size:inherit!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:auto!important}
        .reader-page-content :is(.OBJ_Figure,.OBJ_map,._idGenObjectLayout-1){max-width:100%!important}
        /* Мобильная типографика: шрифты, набранные в PT Serif,
           заменяются на Open Sans. Заголовочные гарнитуры не затрагиваются. */
        .reader-page-content :is(
          p.main,
          p.friend,
          p.Attention,
          p.introduction,
          p.term_word,
          p.List,
          p.document,
          p.documentHead,
          p.link2
        ),
        .reader-page-content :is(
          p.main,
          p.friend,
          p.Attention,
          p.introduction,
          p.term_word,
          p.List,
          p.document,
          p.documentHead,
          p.link2
        ) :is(span,strong,b,em,i,a){
          font-family:"Open Sans",Arial,sans-serif!important;
        }
        .reader-page-content p.main{
          font-size:inherit!important;
          line-height:1.24!important;
          text-align:justify!important;
          text-align-last:auto!important;
          word-spacing:normal!important;
          letter-spacing:normal!important;
          -webkit-hyphens:auto!important;
          hyphens:auto!important;
          overflow-wrap:normal!important;
          word-break:normal!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isPageBreak(node) {
    return node?.nodeType === Node.ELEMENT_NODE && node.classList.contains('Sys_PageBreak');
  }

  function splitNode(node) {
    if (isPageBreak(node)) return [null, 'BREAK'];
    if (node.nodeType !== Node.ELEMENT_NODE) return [node.cloneNode(true)];

    const segments = [];
    let clone = node.cloneNode(false);
    let hasContent = false;
    const flush = () => {
      if (hasContent) segments.push(clone);
      clone = node.cloneNode(false);
      hasContent = false;
    };

    [...node.childNodes].forEach(child => {
      splitNode(child).forEach(part => {
        if (part === 'BREAK') {
          flush();
          segments.push('BREAK');
        } else if (part) {
          clone.appendChild(part);
          hasContent = true;
        }
      });
    });
    flush();
    return segments.length ? segments : [node.cloneNode(false)];
  }

  function cleanSectionTitle(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('.SYS_pageMarker,.Sys_PageBreak,script,style').forEach(node => node.remove());
    return cleanText(clone.textContent);
  }

  function hasVisibleContent(fragment) {
    if (!fragment) return false;
    if (cleanText(fragment.textContent)) return true;
    return !!fragment.querySelector?.('img,svg,table,video,audio,iframe,canvas,object,embed,hr,input,button');
  }

  function buildPages(bodyChildren) {
    const fragments = [document.createDocumentFragment()];
    const nextPage = () => {
      if (hasVisibleContent(fragments[fragments.length - 1])) fragments.push(document.createDocumentFragment());
    };

    bodyChildren.forEach(node => {
      splitNode(node).forEach(part => {
        if (part === 'BREAK') nextPage();
        else if (part) fragments[fragments.length - 1].appendChild(part);
      });
    });

    return fragments.filter(hasVisibleContent).map((fragment, index) => {
      const page = document.createElement('section');
      page.className = 'reader-page-sheet';
      page.dataset.pageIndex = String(index);

      const content = document.createElement('div');
      content.className = 'reader-page-content';
      content.appendChild(fragment);
      page.appendChild(content);

      // Pages 1 and 2 have no footer. Starting with page 3, show only
      // the yellow plate and the current page number.
      if (index >= 2) {
        const footerSpacer = document.createElement('div');
        footerSpacer.className = 'reader-page-footer-spacer';
        footerSpacer.setAttribute('aria-hidden', 'true');
        page.appendChild(footerSpacer);

        const footer = document.createElement('footer');
        footer.className = 'reader-page-footer';

        const footerNumber = document.createElement('div');
        footerNumber.className = 'reader-page-footer-number';
        footerNumber.textContent = String(index + 1);

        footer.appendChild(footerNumber);
        page.appendChild(footer);
      }
      return page;
    });
  }

  /*
   * InDesign may export a combining acute accent (U+0301) into a separate
   * span/text node. On iOS Safari with Open Sans this can visually split the
   * word. Attach any leading combining marks to the previous text node before
   * the document is cloned into reader pages.
   */
  function normalizeDetachedCombiningMarks(root) {
    if (!root) return;
    const combiningAtStart = /^[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]+/u;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,noscript,textarea')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let previousText = null;
    const emptyParents = new Set();
    for (const node of nodes) {
      const match = node.data.match(combiningAtStart);
      if (match && previousText) {
        previousText.data += match[0];
        node.data = node.data.slice(match[0].length);
        if (!node.data && node.parentElement) emptyParents.add(node.parentElement);
      }
      if (node.data.length) previousText = node;
    }
    emptyParents.forEach(el => {
      if (el.tagName === 'SPAN' && !el.textContent && !el.querySelector('*')) el.remove();
    });
    const nw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (nw.nextNode()) {
      const node = nw.currentNode;
      if (node.data && /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/u.test(node.data)) {
        node.data = node.data.normalize('NFC');
      }
    }
  }

  function prepareDocument() {
    injectStyles();
    normalizeDetachedCombiningMarks(document.body);
    const bodyChildren = [...document.body.childNodes].filter(node =>
      !(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT')
    );
    viewport = document.createElement('div');
    viewport.id = 'reader-viewport';
    flow = document.createElement('main');
    flow.id = 'reader-flow';
    pages = buildPages(bodyChildren);
    if (!pages.length) {
      const page = document.createElement('section');
      page.className = 'reader-page-sheet';
      page.dataset.pageIndex = '0';
      pages = [page];
    }
    pages.forEach(page => flow.appendChild(page));
    viewport.appendChild(flow);

    // The pages above are clones of the source document. Remove the original
    // source tree completely so it cannot remain visible behind the active page.
    // Keeping it in the body caused large fragments of the cover and neighbouring
    // content to bleed through around the centered sheet.
    document.body.replaceChildren(viewport);

    flow.querySelectorAll('img').forEach(img => {
      /*
       * Служебные и декоративные иконки не должны открываться
       * в окне увеличенного просмотра. Иконкой считаем изображение,
       * если слово "icon" встречается в имени файла, id, class,
       * name/alt либо в id/class любого его контейнера InDesign.
       */
      if (isIconImage(img)) {
        img.classList.remove('reader-clickable-image');
        img.classList.add('reader-static-icon');
        img.removeAttribute('tabindex');
        img.setAttribute('aria-disabled', 'true');
        return;
      }

      img.classList.add('reader-clickable-image');
      img.addEventListener('click', () => {
        const originalSrc = img.getAttribute('src') || '';
        const currentSrc = img.currentSrc || img.src || originalSrc;
        const sourceName = originalSrc || currentSrc;
        const cleanName = sourceName.split('#')[0].split('?')[0].split('/').pop()?.split('\\').pop() || '';
        const stem = cleanName.replace(/\.[^.]+$/, '').trim().toLowerCase();
        const numbered = stem.match(/^p0*(\d+)[_\- ]+0*(\d+)$/i);
        const imageKey = numbered
          ? `p${Number(numbered[1])}_${Number(numbered[2])}`
          : stem.replace(/[\s-]+/g, '_');

        /*
         * Интерактивной считается только картинка, находящаяся внутри
         * объектного стиля InDesign OBJ_map. Обычные изображения с тем же
         * именем продолжают открываться стандартным просмотрщиком.
         */
        const interactiveMapContainer = img.closest('.OBJ_map');

        post('openImageViewer', {
          src: currentSrc,
          currentSrc,
          originalSrc,
          imageKey,
          isInteractiveMap: Boolean(interactiveMapContainer),
          objectStyle: interactiveMapContainer ? 'OBJ_map' : '',
          alt: img.alt || '',
          caption: imageCaption(img),
          sourceWidth: img.getBoundingClientRect().width,
          sourceHeight: img.getBoundingClientRect().height
        });
      });
    });
    createSelectionToolbar();
    setupGlossary();
  }


  function glossaryNormalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ё/g, 'е')
      .toLocaleLowerCase('ru')
      .replace(/[^а-яa-z0-9]+/gi, ' ')
      .trim();
  }

  function glossaryStem(word) {
    let value = glossaryNormalize(word);
    const endings = [
      'иями','ями','ами','ыми','ими','ого','его','ому','ему','ую','юю',
      'ая','яя','ое','ее','ие','ые','ий','ый','ой','ам','ям','ах','ях',
      'ом','ем','ов','ев','ей','ую','юю','ы','и','а','я','у','ю','е','о'
    ];
    for (const ending of endings) {
      if (value.length - ending.length >= 3 && value.endsWith(ending)) {
        value = value.slice(0, -ending.length);
        break;
      }
    }
    return value;
  }

  function glossaryDistance(a, b) {
    const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
    for (let column = 1; column <= b.length; column += 1) rows[0][column] = column;
    for (let row = 1; row <= a.length; row += 1) {
      for (let column = 1; column <= b.length; column += 1) {
        const cost = a[row - 1] === b[column - 1] ? 0 : 1;
        rows[row][column] = Math.min(
          rows[row - 1][column] + 1,
          rows[row][column - 1] + 1,
          rows[row - 1][column - 1] + cost
        );
      }
    }
    return rows[a.length][b.length];
  }

  function glossaryWordScore(source, target) {
    const a = glossaryStem(source);
    const b = glossaryStem(target);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.92;
    return 1 - glossaryDistance(a, b) / Math.max(a.length, b.length, 1);
  }

  function glossaryEntryScore(term, entry) {
    const normalized = glossaryNormalize(term);
    if (!normalized) return 0;
    if (normalized === entry.normalized) return 2;

    const sourceWords = normalized.split(' ').filter(Boolean);
    const targetWords = entry.normalized.split(' ').filter(Boolean);
    if (!sourceWords.length || sourceWords.length !== targetWords.length) return 0;

    const scores = sourceWords.map((word, index) => glossaryWordScore(word, targetWords[index]));
    const minimum = Math.min(...scores);
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return minimum < 0.48 ? 0 : average;
  }

  function buildGlossaryEntries() {
    const entries = [];
    flow.querySelectorAll('p.term_word, p.term_words').forEach(paragraph => {
      const text = cleanText(paragraph.textContent || '');
      const separator = text.search(/\s[—–-]\s/);
      if (separator < 1) return;
      const term = cleanText(text.slice(0, separator));
      const definition = cleanText(text.slice(separator).replace(/^\s*[—–-]\s*/, ''));
      const normalized = glossaryNormalize(term);
      if (!term || !definition || !normalized) return;
      entries.push({ term, definition, normalized });
    });
    glossaryEntries = entries;
  }

  function glossaryTermGroup(target) {
    const span = target.closest?.('.term-word');
    if (!span) return '';
    const parent = span.parentElement;
    if (!parent) return cleanText(span.textContent);

    const children = Array.from(parent.childNodes);
    const clickedIndex = children.indexOf(span);
    if (clickedIndex < 0) return cleanText(span.textContent);

    const isTermPart = node =>
      node?.nodeType === Node.ELEMENT_NODE && node.classList?.contains('term-word');
    const isIgnorable = node =>
      node?.nodeType === Node.TEXT_NODE && !cleanText(node.data);

    let start = clickedIndex;
    let end = clickedIndex;
    while (start > 0 && (isTermPart(children[start - 1]) || isIgnorable(children[start - 1]))) start -= 1;
    while (end + 1 < children.length && (isTermPart(children[end + 1]) || isIgnorable(children[end + 1]))) end += 1;

    return cleanText(children.slice(start, end + 1).map(node => node.textContent || '').join(''));
  }

  function findGlossaryEntry(term) {
    let best = null;
    let bestScore = 0;
    glossaryEntries.forEach(entry => {
      const score = glossaryEntryScore(term, entry);
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    });
    return bestScore >= 0.62 ? best : null;
  }

  function closeGlossaryPopup() {
    if (glossaryPopup) glossaryPopup.hidden = true;
  }

  function showGlossaryPopup(entry, target) {
    if (!glossaryPopup) return;
    glossaryPopup.querySelector('.reader-glossary-title').textContent = entry.term;
    glossaryPopup.querySelector('.reader-glossary-definition').textContent = entry.definition;
    glossaryPopup.hidden = false;

    const rect = target.getBoundingClientRect();
    const popupRect = glossaryPopup.getBoundingClientRect();
    const gap = 10;
    let left = rect.left;
    let top = rect.bottom + gap;
    if (left + popupRect.width > innerWidth - 8) left = innerWidth - popupRect.width - 8;
    if (top + popupRect.height > innerHeight - 8) top = rect.top - popupRect.height - gap;
    glossaryPopup.style.left = `${Math.max(8, left)}px`;
    glossaryPopup.style.top = `${Math.max(8, top)}px`;
  }

  function setupGlossary() {
    buildGlossaryEntries();

    glossaryPopup = document.createElement('aside');
    glossaryPopup.className = 'reader-glossary-popup';
    glossaryPopup.hidden = true;
    glossaryPopup.setAttribute('role', 'dialog');
    glossaryPopup.setAttribute('aria-label', 'Определение термина');
    glossaryPopup.innerHTML = `
      <button class="reader-glossary-close" type="button" aria-label="Закрыть">×</button>
      <div class="reader-glossary-title"></div>
      <p class="reader-glossary-definition"></p>
    `;
    document.body.appendChild(glossaryPopup);
    glossaryPopup.querySelector('.reader-glossary-close').addEventListener('click', closeGlossaryPopup);

    document.addEventListener('click', event => {
      const termTarget = event.target.closest?.('.term-word');
      if (termTarget && flow.contains(termTarget)) {
        const term = glossaryTermGroup(termTarget);
        const entry = findGlossaryEntry(term);
        if (entry) {
          event.preventDefault();
          event.stopPropagation();
          showGlossaryPopup(entry, termTarget);
        }
        return;
      }
      if (!event.target.closest?.('.reader-glossary-popup')) closeGlossaryPopup();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeGlossaryPopup();
    });
  }

  function isIconImage(img) {
    const hasIcon = value => /icon/i.test(String(value || ''));

    if (
      hasIcon(img.getAttribute('src')) ||
      hasIcon(img.currentSrc) ||
      hasIcon(img.id) ||
      hasIcon(img.className) ||
      hasIcon(img.getAttribute('name')) ||
      hasIcon(img.getAttribute('alt')) ||
      hasIcon(img.getAttribute('data-name')) ||
      hasIcon(img.getAttribute('data-object-style'))
    ) {
      return true;
    }

    let node = img.parentElement;
    while (node && node !== flow) {
      if (
        hasIcon(node.id) ||
        hasIcon(node.className) ||
        hasIcon(node.getAttribute('name')) ||
        hasIcon(node.getAttribute('data-name')) ||
        hasIcon(node.getAttribute('data-object-style'))
      ) {
        return true;
      }
      node = node.parentElement;
    }

    return false;
  }

  function imageCaption(img) {
    /*
     * Изображения InDesign обычно находятся внутри общей объектной
     * обёртки ._idGenObjectLayout-1, а подпись лежит в соседнем
     * вложенном фрейме. Поэтому ищем все абзацы TXT_Caption именно
     * внутри той же объектной обёртки и объединяем их построчно.
     */
    const objectLayout = img.closest('._idGenObjectLayout-1');
    if (objectLayout) {
      const captionParts = Array.from(
        objectLayout.querySelectorAll('p.TXT_Caption, figcaption, .caption, .Caption')
      )
        .map(node => cleanText(node.textContent || ''))
        .filter(Boolean);

      if (captionParts.length) return captionParts.join('\n');
    }

    /* Запасной вариант для иллюстраций без объектной обёртки. */
    const nearby = img.closest('figure,td,div')
      ?.querySelector('figcaption,p.TXT_Caption,.caption,.Caption')
      ?.textContent;
    return cleanText(nearby || img.alt || '');
  }

  function paginate(preserveRatio) {
    if (!viewport || !flow) return;
    const oldCount = pageCount;
    const ratio = preserveRatio && oldCount > 1 ? pageIndex / (oldCount - 1) : 0;
    const rect = viewport.getBoundingClientRect();
    const mobile = rect.width <= 820;
    const availableWidth = Math.max(280, Math.floor(rect.width - (mobile ? 0 : 28)));
    pageWidth = mobile ? availableWidth : Math.min(cfg.maxPageWidth, availableWidth);
    // The sheet must always fill the currently visible reader area vertically.
    // The flow has 10px padding above and below, so subtract it from the
    // viewport height. Content may extend the sheet further down naturally.
    pageHeight = Math.max(0, Math.floor(rect.height - 20));
    const margin = mobile ? clamp(Math.round(pageWidth * 0.038), 12, 20) : clamp(Math.round(pageWidth * 0.06), 24, 52);
    flow.style.setProperty('--reader-page-margin', `${margin}px`);
    flow.style.setProperty('--reader-page-width', `${pageWidth}px`);

    // Font size is derived from the actual sheet width rather than from a
    // fixed pixel value. Thus 100% has the same visual proportion on laptop
    // and desktop screens. The small base multiplier is the requested
    // increase of the initial reading size.
    const pageFontRatio = mobile
      // На телефоне 100% означает комфортный размер чтения, а не
      // уменьшенную копию настольной страницы. Ширина листа уже равна
      // ширине экрана, поэтому дополнительно ужимать шрифт не нужно.
      ? 0.94
      : clamp(pageWidth / cfg.referencePageWidth, cfg.minResponsiveFontScale, 1);
    // The font control changes typography inside the sheet only. The page
    // slider is independent and scales the complete sheet with every element.
    const fontZoom = cfg.fontSteps[fontIndex];
    const effectiveFontScale = pageFontRatio * cfg.baseFontRatio * fontZoom;
    if (mobile) pageZoom = 1;
    const visualPageWidth = Math.round(pageWidth * pageZoom);
    const unzoomedPageHeight = Math.max(0, pageHeight / Math.max(pageZoom, 0.01));
    const figure2MaxImageHeight = Math.max(1, Math.floor(unzoomedPageHeight * 0.30));
    flow.style.setProperty('--reader-effective-font-scale', String(effectiveFontScale));
    flow.style.setProperty('--reader-page-width', `${visualPageWidth}px`);
    // Figure2 images are allowed to use at most 30% of the visible sheet
    // height. Store the already-calculated unzoomed value as a CSS variable
    // so object-layout.css does not have to depend on vh/browser chrome.
    flow.style.setProperty('--reader-figure2-max-image-height', `${figure2MaxImageHeight}px`);
    flow.style.fontSize = `${effectiveFontScale * 100}%`;
    pages.forEach(page => {
      page.style.width = `${pageWidth}px`;
      // Keep the visible minimum height equal to the reader viewport at every
      // zoom level; the zoom itself still enlarges all page contents.
      page.style.minHeight = `${Math.max(0, pageHeight / pageZoom)}px`;
      page.style.zoom = String(pageZoom);
    });
    pageCount = Math.max(1, pages.length);
    pageIndex = preserveRatio ? Math.round(ratio * Math.max(0, pageCount - 1)) : clamp(pageIndex, 0, pageCount - 1);
    renderPage(false);
    applyNotes();
  }

  function firstVisibleContentRect(content) {
    if (!content) return null;

    let bestRect = null;
    const consider = rect => {
      if (!rect || (!rect.width && !rect.height)) return;
      if (!bestRect || rect.top < bestRect.top) bestRect = rect;
    };

    /*
     * DOM order is not necessarily visual order in exported InDesign objects.
     * In OBJ_Figure_Left2/Right2 the caption may come before the image in the
     * markup even though the image starts higher on the page. The old code
     * stopped at the first text node and then pulled the whole page upward to
     * that caption, clipping the top of the image.
     *
     * Measure both printed text and substantial visual objects and use the
     * physically highest rectangle.
     */
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data || !/\S/.test(node.data)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,.Sys_PageBreak,[hidden]')) return NodeFilter.FILTER_REJECT;
        const css = getComputedStyle(parent);
        if (css.display === 'none' || css.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const index = node.data.search(/\S/);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, Math.min(node.data.length, index + 1));
      consider(range.getBoundingClientRect());
    }

    content.querySelectorAll(
      '._idGenObjectLayout-1:has(img,svg,video,canvas,iframe,object,embed),'+
      '._idGenObjectLayout-2:has(img,svg,video,canvas,iframe,object,embed),'+
      'img,svg,table,video,canvas,iframe,object,embed,hr'
    ).forEach(element => {
      const css = getComputedStyle(element);
      if (css.display === 'none' || css.visibility === 'hidden') return;
      consider(element.getBoundingClientRect());
    });

    return bestRect;
  }

  function pageStartVisualObject(content, firstRect) {
    if (!content || !firstRect) return null;

    let topVisual = null;
    content.querySelectorAll(
      '._idGenObjectLayout-1:has(img,svg,video,canvas,iframe,object,embed),'+
      '._idGenObjectLayout-2:has(img,svg,video,canvas,iframe,object,embed)'
    ).forEach(element => {
      const css = getComputedStyle(element);
      if (css.display === 'none' || css.visibility === 'hidden') return;
      const rect = element.getBoundingClientRect();
      if ((!rect.width && !rect.height) || rect.bottom <= rect.top) return;
      if (!topVisual || rect.top < topVisual.rect.top) topVisual = { element, rect };
    });

    if (!topVisual) return null;

    /*
     * If the highest visual object begins at the same height as, or above, the
     * first printable content, it is the page-start object. Return the actual
     * element as well as detecting it: CSS can then use a smaller top gap only
     * for this one object without changing Figure2 spacing elsewhere.
     */
    return topVisual.rect.top <= firstRect.top + Math.max(2, 2 * pageZoom)
      ? topVisual.element
      : null;
  }

  function normalizeActivePageTop() {
    const page = pages[pageIndex];
    const content = page?.querySelector('.reader-page-content');
    if (!page || !content) return;

    // This marker is recalculated for every active page. It lets CSS reduce
    // only the top gap of the object that actually begins the visible page.
    pages.forEach(p => p.querySelectorAll('.reader-page-start-visual').forEach(el => {
      el.classList.remove('reader-page-start-visual');
    }));

    if (viewport && viewport.clientWidth <= 820) { content.style.marginTop = '0px'; return; }

    // Always measure from the uncorrected position so repeated navigation,
    // resizing and zooming cannot accumulate an offset.
    content.style.marginTop = '0px';
    const desiredTop = content.getBoundingClientRect().top;
    const firstRect = firstVisibleContentRect(content);
    if (!firstRect) return;

    // A page that starts with a visual InDesign object must keep its natural
    // spacing. Mark that specific object so Figure2 can use a smaller top gap
    // without tightening the spacing of Figure2 instances inside the text.
    const startVisual = pageStartVisualObject(content, firstRect);
    if (startVisual) {
      startVisual.classList.add('reader-page-start-visual');
      return;
    }

    // getBoundingClientRect() contains CSS zoom, while margin-top is assigned
    // in the page's unzoomed coordinate system.
    const correction = clamp((desiredTop - firstRect.top) / pageZoom, -180, 180);
    content.style.marginTop = `${correction.toFixed(2)}px`;
  }

  function renderPage(animate = true) {
    if (!flow) return;
    pages.forEach((page, index) => page.classList.toggle('is-active', index === pageIndex));
    normalizeActivePageTop();
    requestAnimationFrame(normalizeActivePageTop);
    viewport.scrollTo({ top: 0, left: 0, behavior: animate ? 'smooth' : 'auto' });
    postState();
  }

  function postState() {
    // During the first pagination pass the book is still on page 1. Do not
    // publish that temporary state: otherwise the shell overwrites the saved
    // reading position before it sends the init message after a refresh.
    if (!stateReady) return;
    post('state', { page: String(pageIndex + 1), pageIndex, pageCount });
  }

  function gotoPage(value, animate = true) {
    const target = clamp((parseInt(value, 10) || 1) - 1, 0, pageCount - 1);
    pageIndex = target;
    renderPage(animate);
  }

  function elementPageIndex(element) {
    if (!element || !flow) return 0;
    const page = element.closest?.('.reader-page-sheet');
    return clamp(Number(page?.dataset.pageIndex) || 0, 0, pageCount - 1);
  }

  function buildToc() {
    const selectors = ['[data-toc-title]', 'h1', 'h2', 'h3', '.Chapter', '.Chapter1', '.Paragraph', '.item'];
    const seen = new Set();
    const items = [];
    flow.querySelectorAll(selectors.join(',')).forEach((element, index) => {
      const title = cleanText(element.dataset.tocTitle || element.textContent);
      if (!title || title.length > 180 || seen.has(title)) return;
      seen.add(title);
      if (!element.id) element.id = `reader-toc-${index}`;
      const headingMatch = /^H([1-3])$/.exec(element.tagName);
      const level = headingMatch
        ? Number(headingMatch[1])
        : element.classList.contains('Paragraph')
          ? 2
          : 1;
      items.push({ target: element.id, title, level, pageIndex: elementPageIndex(element) });
    });
    post('toc', items);
  }

  function clearSearch(options = {}) {
    const preservePosition = Boolean(options.preservePosition);
    const savedPageIndex = pageIndex;
    const savedScrollTop = viewport?.scrollTop || 0;
    const savedScrollLeft = viewport?.scrollLeft || 0;

    flow.querySelectorAll('mark.reader-search-hit').forEach(mark => mark.replaceWith(...mark.childNodes));
    flow.normalize();
    hits = [];
    hitIndex = -1;

    if (preservePosition && viewport) {
      pageIndex = savedPageIndex;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        viewport.scrollTo({
          top: savedScrollTop,
          left: savedScrollLeft,
          behavior: 'auto'
        });
      }));
    }
  }

  function search(query) {
    clearSearch();
    const needle = cleanText(query).toLocaleLowerCase('ru');
    if (!needle) return post('searchResult', { total: 0, index: -1 });
    const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!cleanText(node.data) || node.parentElement.closest('script,style,.reader-selection-toolbar')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let text = node.data;
      let lower = text.toLocaleLowerCase('ru');
      let start = lower.indexOf(needle);
      if (start < 0) return;
      const fragment = document.createDocumentFragment();
      while (start >= 0) {
        fragment.append(text.slice(0, start));
        const mark = document.createElement('mark');
        mark.className = 'reader-search-hit';
        mark.textContent = text.slice(start, start + needle.length);
        fragment.append(mark);
        hits.push(mark);
        text = text.slice(start + needle.length);
        lower = text.toLocaleLowerCase('ru');
        start = lower.indexOf(needle);
      }
      fragment.append(text);
      node.replaceWith(fragment);
    });
    hitIndex = hits.length ? 0 : -1;
    activateHit();
  }

  function revealSearchHit(hit, behavior = 'smooth') {
    if (!hit || !viewport) return;

    // Page switching and top normalization happen asynchronously. Wait for
    // both layout passes, then scroll the internal reader viewport so the
    // active match is actually visible to the user.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!hit.isConnected || !hit.closest('.reader-page-sheet.is-active')) return;

      const viewportRect = viewport.getBoundingClientRect();
      const hitRect = hit.getBoundingClientRect();
      const safeInset = Math.max(28, Math.min(96, viewport.clientHeight * 0.16));
      const visibleTop = viewportRect.top + safeInset;
      const visibleBottom = viewportRect.bottom - safeInset;

      if (hitRect.top >= visibleTop && hitRect.bottom <= visibleBottom) return;

      const targetTop = viewport.scrollTop
        + (hitRect.top - viewportRect.top)
        - Math.max(0, (viewport.clientHeight - hitRect.height) / 2);

      viewport.scrollTo({
        top: Math.max(0, targetTop),
        left: 0,
        behavior
      });
    }));
  }

  function activateHit() {
    hits.forEach((hit, index) => hit.classList.toggle('is-active', index === hitIndex));
    if (hitIndex >= 0) {
      const activeHit = hits[hitIndex];
      pageIndex = elementPageIndex(activeHit);
      renderPage(false);
      revealSearchHit(activeHit, 'smooth');
    }
    post('searchResult', { total: hits.length, index: hitIndex });
  }

  function moveSearch(delta) {
    if (!hits.length) return;
    hitIndex = (hitIndex + delta + hits.length) % hits.length;
    activateHit();
  }

  function selectionPayload() {
    const selection = getSelection();
    if (!selection || selection.isCollapsed || !flow.contains(selection.anchorNode) || !flow.contains(selection.focusNode)) return null;
    const quote = cleanText(selection.toString());
    if (!quote) return null;
    const range = selection.getRangeAt(0).cloneRange();
    const prefixRange = document.createRange();
    prefixRange.selectNodeContents(flow);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    return { quote, start: prefixRange.toString().length, length: range.toString().length, page: String(pageIndex + 1) };
  }

  function createSelectionToolbar() {
    selectionToolbar = document.createElement('div');
    selectionToolbar.className = 'reader-selection-toolbar';
    selectionToolbar.hidden = true;
    selectionToolbar.innerHTML = '<button type="button">Добавить заметку</button>';
    const selectionButton = selectionToolbar.querySelector('button');
    selectionButton.style.touchAction = 'manipulation';

    // Keep the native text selection alive while the floating command is tapped.
    // On iOS a prevented touchstart can suppress a later click, so activation is
    // handled on pointerup/touchend with a click fallback and duplicate protection.
    ['pointerdown', 'mousedown', 'touchstart'].forEach(type => {
      selectionButton.addEventListener(type, event => event.preventDefault(), { passive: false });
    });

    let lastNoteActivation = 0;
    const activateSelectionNote = event => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const now = Date.now();
      if (now - lastNoteActivation < 450) return;
      lastNoteActivation = now;

      // Re-read the selection when possible; fall back to the cached anchor because
      // Safari may collapse the visual selection as focus moves to the parent dialog.
      const payload = selectionPayload() || cachedSelection;
      if (!payload) return;
      cachedSelection = payload;
      selectionToolbar.hidden = true;
      post('requestNote', payload);
    };

    selectionButton.addEventListener('pointerup', activateSelectionNote, { passive: false });
    selectionButton.addEventListener('touchend', activateSelectionNote, { passive: false });
    selectionButton.addEventListener('click', activateSelectionNote, { passive: false });
    document.body.appendChild(selectionToolbar);

    const scheduleSelectionToolbar = delay => {
      clearTimeout(document._readerSelectionTimer);
      document._readerSelectionTimer = setTimeout(showSelectionToolbar, delay);
    };
    document.addEventListener('selectionchange', () => scheduleSelectionToolbar(90));
    // Mobile Safari sometimes finalises the selection only after touchend.
    document.addEventListener('touchend', () => scheduleSelectionToolbar(180), { passive: true });
    document.addEventListener('pointerup', () => scheduleSelectionToolbar(80), { passive: true });
  }

  function showSelectionToolbar() {
    cachedSelection = selectionPayload();
    if (!cachedSelection) {
      selectionToolbar.hidden = true;
      post('selectionAvailable', null);
      return;
    }
    const range = getSelection().getRangeAt(0);
    const clientRects = Array.from(range.getClientRects()).filter(rect => rect.width || rect.height);
    const rect = clientRects[0] || range.getBoundingClientRect();
    const mobile = matchMedia('(max-width: 820px)').matches;
    if (mobile) {
      const toolbarWidth = Math.min(230, Math.max(180, innerWidth - 24));
      selectionToolbar.style.width = `${toolbarWidth}px`;
      selectionToolbar.style.left = `${Math.max(12, (innerWidth - toolbarWidth) / 2)}px`;
      const preferredTop = rect.top - 58;
      const fallbackTop = rect.bottom + 12;
      selectionToolbar.style.top = `${clamp(preferredTop >= 8 ? preferredTop : fallbackTop, 8, innerHeight - 62)}px`;
    } else {
      selectionToolbar.style.width = '';
      selectionToolbar.style.left = `${clamp(rect.left, 8, innerWidth - 170)}px`;
      selectionToolbar.style.top = `${clamp(rect.top - 46, 8, innerHeight - 50)}px`;
    }
    selectionToolbar.hidden = false;
    post('selectionAvailable', cachedSelection);
  }

  function textPositionToRange(start, length) {
    const range = document.createRange();
    const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
    let position = 0;
    let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const next = position + node.data.length;
      if (!startNode && start <= next) { startNode = node; startOffset = clamp(start - position, 0, node.data.length); }
      if (startNode && start + length <= next) { endNode = node; endOffset = clamp(start + length - position, 0, node.data.length); break; }
      position = next;
    }
    if (!startNode || !endNode) return null;
    range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset);
    return range;
  }

  function clearNoteHighlights() {
    flow.querySelectorAll('mark.reader-note-highlight').forEach(mark => mark.replaceWith(...mark.childNodes));
    flow.normalize();
  }

  function wrapNoteRange(range, note) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.data || !node.data.length) return NodeFilter.FILTER_REJECT;
          try {
            return range.intersectsNode(node)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          } catch (_) {
            return NodeFilter.FILTER_REJECT;
          }
        }
      }
    );

    if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
      textNodes.push(range.commonAncestorContainer);
    } else {
      while (walker.nextNode()) textNodes.push(walker.currentNode);
    }

    let highlighted = false;

    /*
     * Обрабатываем с конца, чтобы splitText() не менял ещё не
     * обработанные границы выделения в предыдущих текстовых узлах.
     */
    textNodes.reverse().forEach(node => {
      let startOffset = node === range.startContainer ? range.startOffset : 0;
      let endOffset = node === range.endContainer ? range.endOffset : node.data.length;

      startOffset = clamp(startOffset, 0, node.data.length);
      endOffset = clamp(endOffset, startOffset, node.data.length);
      if (endOffset <= startOffset) return;

      let selectedNode = node;
      if (endOffset < selectedNode.data.length) selectedNode.splitText(endOffset);
      if (startOffset > 0) selectedNode = selectedNode.splitText(startOffset);
      if (!selectedNode.data.length) return;

      const mark = document.createElement('mark');
      mark.className = 'reader-note-highlight';
      mark.dataset.noteId = note.id;
      mark.style.setProperty('background-color', note.color || '#ffe58a', 'important');
      mark.style.setProperty('color', 'inherit', 'important');
      mark.addEventListener('click', () => post('noteActivated', { id: note.id }));

      selectedNode.parentNode.insertBefore(mark, selectedNode);
      mark.appendChild(selectedNode);
      highlighted = true;
    });

    return highlighted;
  }

  function applyNotes() {
    if (!flow) return;
    clearNoteHighlights();

    [...notes]
      .sort((a, b) => Number(b.anchor?.start || 0) - Number(a.anchor?.start || 0))
      .forEach(note => {
        if (!note.anchor || !Number.isFinite(Number(note.anchor.start))) return;

        const length = Number(
          note.anchor.length || note.anchor.quote?.length || 0
        );
        const range = textPositionToRange(Number(note.anchor.start), length);
        if (!range || range.collapsed) return;

        /*
         * surroundContents() падает, если выделение пересекает span,
         * strong, em и другие вложенные элементы. Поэтому выделяем
         * каждый попавший в диапазон текстовый фрагмент отдельно.
         */
        wrapNoteRange(range, note);
      });
  }

  function currentQuote() {
    const x = Math.min(innerWidth - 20, Math.max(20, innerWidth / 2));
    const y = Math.min(innerHeight - 20, Math.max(20, innerHeight / 2));
    const element = document.elementFromPoint(x, y);
    return cleanText(element?.closest('p,li,h1,h2,h3,td')?.textContent || '').slice(0, 110);
  }

  function currentBookmark() {
    return { id: `bookmark-${Date.now()}`, page: String(pageIndex + 1), quote: currentQuote(), created: Date.now() };
  }

  function gotoAnchor(anchor) {
    if (anchor && Number.isFinite(Number(anchor.start))) {
      const range = textPositionToRange(Number(anchor.start), 1);
      if (range) {
        pageIndex = elementPageIndex(range.startContainer.parentElement);
        renderPage();
        return;
      }
    }
    gotoPage(anchor?.page || 1);
  }

  addEventListener('message', event => {
    const message = event.data || {};
    if (message.source !== 'reader-shell') return;
    const payload = message.payload || {};
    switch (message.type) {
      case 'init':
        fontIndex = clamp(Number(payload.fontIndex) || 1, 0, cfg.fontSteps.length - 1);
        pageZoom = clamp(Number(payload.pageZoom) || 1, 0.35, 1.6);
        notes = Array.isArray(payload.notes) ? payload.notes : [];
        bookmarks = Array.isArray(payload.bookmarks) ? payload.bookmarks : [];
        paginate(false);
        stateReady = true;
        gotoPage(payload.position?.page || payload.position?.pageIndex + 1 || 1, false);
        buildToc();
        applyNotes();
        post('font', { index: fontIndex, scale: cfg.fontSteps[fontIndex] });
        post('pageZoom', { scale: pageZoom });
        break;
      case 'page': gotoPage(pageIndex + 1 + Number(payload.delta || 0)); break;
      case 'gotoPage': gotoPage(payload.page); break;
      case 'home': gotoPage(1); break;
      case 'gotoToc': {
        const target = document.getElementById(payload.target);
        pageIndex = target ? elementPageIndex(target) : clamp(Number(payload.pageIndex) || 0, 0, pageCount - 1);
        renderPage(); break;
      }
      case 'font':
        fontIndex = clamp(Number(payload.index) || 0, 0, cfg.fontSteps.length - 1);
        paginate(true); buildToc();
        post('font', { index: fontIndex, scale: cfg.fontSteps[fontIndex] }); break;
      case 'pageZoom':
        pageZoom = clamp(Number(payload.scale) || 1, 0.35, 1.6);
        paginate(true);
        post('pageZoom', { scale: pageZoom }); break;
      case 'search': search(payload.query); break;
      case 'clearSearch': clearSearch({ preservePosition: payload.preservePosition !== false }); post('searchResult', { total: 0, index: -1 }); break;
      case 'searchNext': moveSearch(1); break;
      case 'searchPrev': moveSearch(-1); break;
      case 'getSelection': post('selection', cachedSelection); break;
      case 'applyNotes': notes = Array.isArray(payload.notes) ? payload.notes : []; applyNotes(); break;
      case 'gotoNote': gotoAnchor(payload.note?.anchor || payload.note); break;
      case 'toggleCurrentPageBookmark': post('togglePageBookmark', currentBookmark()); break;
      case 'applyBookmarks': bookmarks = Array.isArray(payload.bookmarks) ? payload.bookmarks : []; break;
      case 'gotoBookmark': gotoPage(payload.bookmark?.page || 1); break;
    }
  });

  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { paginate(true); buildToc(); }, 120);
  });

  prepareDocument();
  requestAnimationFrame(() => {
    paginate(false);
    buildToc();
    post('ready', {});
  });

  // Prevent accidental double-tap/pinch browser zoom inside the book on phones.
  let readerLastTouchEnd = 0;
  document.addEventListener('touchend', event => {
    if (window.innerWidth > 820) return;
    const target = event.target;
    if (target?.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
    const now = Date.now();
    if (now - readerLastTouchEnd < 320) event.preventDefault();
    readerLastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('gesturestart', event => {
    if (window.innerWidth <= 820) event.preventDefault();
  }, { passive: false });
})();
