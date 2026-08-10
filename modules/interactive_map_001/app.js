(() => {
  'use strict';

  const data = {
    kiev: { kind: 'Город', title: 'Киев', text: 'Начальная точка показанного на карте похода Святослава.' },
    chernigov: { kind: 'Город', title: 'Чернигов', text: 'Город на пути из Киева к северо-восточным землям.' },
    smolensk: { kind: 'Город', title: 'Смоленск', text: 'Город в верхнем течении Днепра, отмеченный в западной части карты.' },
    rostov: { kind: 'Город', title: 'Ростов', text: 'Город в северо-восточной части Древней Руси, рядом с землями мери.' },
    suzdal: { kind: 'Город', title: 'Суздаль', text: 'Город рядом с Ростовом, на северо-востоке Руси.' },
    murom: { kind: 'Город', title: 'Муром', text: 'Город на Оке, рядом с областью расселения муромы.' },
    bulgar: { kind: 'Город', title: 'Булгар', text: 'Один из крупнейших городов Волжской Булгарии.' },
    merya: { kind: 'Народ', title: 'Меря', text: 'Финно-угорский народ, область которого показана к северу от Ростова и Суздаля.' },
    muroma: { kind: 'Народ', title: 'Мурома', text: 'Финно-угорский народ, населявший земли в районе Мурома и Оки.' },
    mordva: { kind: 'Народ', title: 'Мордва', text: 'Земли мордвы располагались восточнее Мурома, на пути к Волге.' },
    mari: { kind: 'Народ', title: 'Марийцы', text: 'Финно-угорский народ, населявший земли в бассейнах Вятки и Камы.' },
    bulgaria: { kind: 'Государство', title: 'Волжская Булгария', text: 'Государство в Среднем Поволжье — конечная цель показанного похода.' }
  };

  const stages = [
    {
      at: 0,
      title: 'Киев — начало похода',
      text: 'В 965 году князь Святослав выступил из Киева на северо-восток.'
    },
    {
      at: 0.34,
      title: 'Через земли вятичей',
      text: 'Войско продвигалось через земли вятичей, следуя в сторону Оки и Волги.'
    },
    {
      at: 0.61,
      title: 'Земли мордвы',
      text: 'Дальнейший путь проходил через земли мордвы к Среднему Поволжью.'
    },
    {
      at: 0.82,
      title: 'Волжская Булгария',
      text: 'Маршрут достигает территории Волжской Булгарии и города Булгар.'
    }
  ];

  const viewport = document.getElementById('mapViewport');
  const stage = document.getElementById('mapStage');
  const zoomValue = document.querySelector('.zoom-value');
  const routeController = document.querySelector('.route-controller');
  const infoCard = document.getElementById('infoCard');
  const infoKind = document.getElementById('infoKind');
  const infoTitle = document.getElementById('infoTitle');
  const infoText = document.getElementById('infoText');
  const closeCard = document.getElementById('closeCard');

  const routePath = document.getElementById('routePath');
  const routeTrail = document.getElementById('routeTrail');
  const routeMarkerHalo = document.getElementById('routeMarkerHalo');
  const routeMarkerArrow = document.getElementById('routeMarkerArrow');
  const routeProgressBar = document.getElementById('routeProgressBar');
  const routeProgressLabel = document.getElementById('routeProgressLabel');
  const routeTitle = document.getElementById('routeTitle');
  const routeText = document.getElementById('routeText');
  const startRoute = document.getElementById('startRoute');
  const pauseRoute = document.getElementById('pauseRoute');
  const resetRoute = document.getElementById('resetRoute');
  const routeSpeed = document.getElementById('routeSpeed');
  const routeLayerButton = document.querySelector('[data-toggle-route]');
  const animatedRoute = document.querySelector('.animated-route');
  const stageItems = [...document.querySelectorAll('[data-stage-index]')];
  const stagePulses = [...document.querySelectorAll('.stage-pulse')];

  let scale = 1;
  let x = 0;
  let y = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  let progress = 0;
  let playing = false;
  let animationFrame = 0;
  let lastTime = 0;
  let activeStage = -1;

  const routeLength = routePath.getTotalLength();
  routeTrail.style.strokeDasharray = `${routeLength} ${routeLength}`;

  function renderTransform() {
    stage.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
    zoomValue.textContent = `${Math.round(scale * 100)}%`;
  }

  function setScale(nextScale, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) {
    const clamped = Math.max(0.7, Math.min(3.2, nextScale));
    if (clamped === scale) return;
    const rect = viewport.getBoundingClientRect();
    const localX = anchorX - rect.left - rect.width / 2 - x;
    const localY = anchorY - rect.top - rect.height / 2 - y;
    const ratio = clamped / scale;
    x -= localX * (ratio - 1);
    y -= localY * (ratio - 1);
    scale = clamped;
    renderTransform();
  }

  function resetView() {
    scale = 1;
    x = 0;
    y = 0;
    renderTransform();
  }

  document.querySelector('[data-action="zoom-in"]').addEventListener('click', () => setScale(scale + 0.15));
  document.querySelector('[data-action="zoom-out"]').addEventListener('click', () => setScale(scale - 0.15));
  document.querySelector('[data-action="reset-view"]').addEventListener('click', resetView);

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    setScale(scale + (event.deltaY < 0 ? 0.12 : -0.12), event.clientX, event.clientY);
  }, { passive: false });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.hotspot')) return;
    dragging = true;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture(event.pointerId);
    startX = event.clientX;
    startY = event.clientY;
    originX = x;
    originY = y;
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    x = originX + event.clientX - startX;
    y = originY + event.clientY - startY;
    renderTransform();
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  }

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  function openCard(id, element) {
    const item = data[id];
    if (!item) return;
    document.querySelectorAll('.hotspot.is-selected').forEach(node => node.classList.remove('is-selected'));
    element.classList.add('is-selected');
    infoKind.textContent = item.kind;
    infoTitle.textContent = item.title;
    infoText.textContent = item.text;
    routeController.hidden = true;
    infoCard.hidden = false;
  }

  document.querySelectorAll('.hotspot').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      openCard(element.dataset.id, element);
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCard(element.dataset.id, element);
      }
    });
  });

  closeCard.addEventListener('click', () => {
    document.querySelectorAll('.hotspot.is-selected').forEach(node => node.classList.remove('is-selected'));
    infoCard.hidden = true;
    routeController.hidden = false;
  });

  document.querySelectorAll('[data-toggle-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.toggleLayer;
      const layer = document.querySelector(`[data-layer="${name}"]`);
      const active = button.classList.toggle('is-active');
      layer.classList.toggle('is-hidden', !active);
    });
  });

  routeLayerButton.addEventListener('click', () => {
    const active = routeLayerButton.classList.toggle('is-active');
    animatedRoute.classList.toggle('is-hidden', !active);
    stagePulses.forEach(pulse => pulse.style.visibility = active ? '' : 'hidden');
  });

  function stageForProgress(value) {
    let index = 0;
    for (let i = 0; i < stages.length; i += 1) {
      if (value >= stages[i].at) index = i;
    }
    return index;
  }

  function setActiveStage(index) {
    if (index === activeStage) return;
    activeStage = index;
    stageItems.forEach((item, i) => item.classList.toggle('is-active', i === index));
    stagePulses.forEach((pulse, i) => pulse.classList.toggle('is-active', i === index));
    const stageData = stages[index];
    routeTitle.textContent = stageData.title;
    routeText.textContent = stageData.text;
  }

  function renderRoute() {
    const length = progress * routeLength;
    routeTrail.style.strokeDashoffset = `${routeLength - length}`;

    const point = routePath.getPointAtLength(length);
    const next = routePath.getPointAtLength(Math.min(routeLength, length + 1.5));
    const previous = routePath.getPointAtLength(Math.max(0, length - 1.5));

    let dx = next.x - previous.x;
    let dy = next.y - previous.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    dx /= magnitude;
    dy /= magnitude;

    const perpendicularX = -dy;
    const perpendicularY = dx;
    const tipLength = 8;
    const tailLength = 6;
    const halfWidth = 4.5;
    const notchDepth = 2.4;

    const tipX = point.x + dx * tipLength;
    const tipY = point.y + dy * tipLength;
    const backX = point.x - dx * tailLength;
    const backY = point.y - dy * tailLength;
    const leftX = backX + perpendicularX * halfWidth;
    const leftY = backY + perpendicularY * halfWidth;
    const rightX = backX - perpendicularX * halfWidth;
    const rightY = backY - perpendicularY * halfWidth;
    const notchX = point.x - dx * notchDepth;
    const notchY = point.y - dy * notchDepth;

    routeMarkerHalo.setAttribute('cx', point.x.toFixed(2));
    routeMarkerHalo.setAttribute('cy', point.y.toFixed(2));
    routeMarkerArrow.setAttribute(
      'd',
      `M${tipX.toFixed(2)},${tipY.toFixed(2)} ` +
      `L${leftX.toFixed(2)},${leftY.toFixed(2)} ` +
      `L${notchX.toFixed(2)},${notchY.toFixed(2)} ` +
      `L${rightX.toFixed(2)},${rightY.toFixed(2)} Z`
    );

    routeProgressBar.style.width = `${progress * 100}%`;
    routeProgressLabel.textContent = progress >= 1
      ? 'Маршрут завершён'
      : `Пройдено ${Math.round(progress * 100)}% маршрута`;
    setActiveStage(stageForProgress(progress));
  }

  function tick(time) {
    if (!playing) return;
    if (!lastTime) lastTime = time;
    const elapsed = Math.min(50, time - lastTime);
    lastTime = time;
    const speed = Number(routeSpeed.value);
    progress = Math.min(1, progress + elapsed / 14500 * speed);
    renderRoute();

    if (progress >= 1) {
      playing = false;
      startRoute.textContent = '▶ Снова';
      pauseRoute.disabled = true;
      return;
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function playRoute() {
    if (progress >= 1) progress = 0;
    playing = true;
    lastTime = 0;
    startRoute.textContent = '▶ Идёт маршрут';
    startRoute.disabled = true;
    pauseRoute.disabled = false;
    animationFrame = requestAnimationFrame(tick);
  }

  function pauseAnimation() {
    playing = false;
    cancelAnimationFrame(animationFrame);
    startRoute.disabled = false;
    startRoute.textContent = '▶ Продолжить';
    pauseRoute.disabled = true;
  }

  function resetAnimation() {
    playing = false;
    cancelAnimationFrame(animationFrame);
    progress = 0;
    lastTime = 0;
    activeStage = -1;
    startRoute.disabled = false;
    startRoute.textContent = '▶ Старт';
    pauseRoute.disabled = true;
    routeProgressLabel.textContent = 'Маршрут не запущен';
    routeTitle.textContent = 'Поход Святослава';
    routeText.textContent = 'Запустите маршрут: карта последовательно покажет движение от Киева через земли вятичей и мордвы к Волжской Булгарии.';
    stageItems.forEach(item => item.classList.remove('is-active'));
    stagePulses.forEach(pulse => pulse.classList.remove('is-active'));
    renderRoute();
  }

  startRoute.addEventListener('click', playRoute);
  pauseRoute.addEventListener('click', pauseAnimation);
  resetRoute.addEventListener('click', resetAnimation);

  renderTransform();
  resetAnimation();
})();



/* Адаптивное вписывание карты в вычисленную область iframe. */
(() => {
  const viewport = document.getElementById('mapViewport');
  const stage = document.getElementById('mapStage');
  const image = stage?.querySelector('img');
  if (!viewport || !stage || !image) return;

  function fitStage() {
    const vw = Math.max(1, viewport.clientWidth);
    const vh = Math.max(1, viewport.clientHeight);
    const ratio = (image.naturalWidth && image.naturalHeight)
      ? image.naturalWidth / image.naturalHeight
      : 539 / 370;
    const width = Math.max(1, Math.min(vw * 0.94, vh * 0.94 * ratio));
    stage.style.width = `${width}px`;
  }

  const observer = new ResizeObserver(fitStage);
  observer.observe(viewport);
  image.addEventListener('load', fitStage, { once: true });
  window.addEventListener('resize', fitStage, { passive: true });
  fitStage();
})();

/* Mobile shell helper: reveal updated information immediately. */
(() => {
  const panel = document.querySelector('.info-panel');
  if (!panel) return;
  const mobile = () => matchMedia('(max-width: 900px)').matches;
  document.querySelectorAll('.hotspot, .stage-list li').forEach(el => {
    el.addEventListener('click', () => {
      if (mobile()) requestAnimationFrame(() => panel.scrollTo({ top: 0, behavior: 'smooth' }));
    });
  });
  const title = document.getElementById('infoTitle');
  if (title) new MutationObserver(() => { if (mobile()) panel.scrollTop = 0; })
    .observe(title, { childList: true, characterData: true, subtree: true });
})();
