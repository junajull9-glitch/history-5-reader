
/* Service pages are intentionally independent of book/ and its InDesign updates. */
(() => {
 const layer=document.getElementById('servicePageLayer');
 const dialog=document.getElementById('serviceMapDialog');
 const picture=document.getElementById('serviceMapImage');
 const caption=document.getElementById('serviceMapCaption');
 const stage=document.querySelector('.reader-stage');
 const viewport=document.getElementById('serviceMapViewport');
 const legend=document.getElementById('serviceMapLegend');
 const reset=document.getElementById('serviceMapReset');
 let baseWidth=0,baseHeight=0;
 let serviceIndex=null, zoom=1;
 const files='service-pages/';
 function show(index){
   serviceIndex=index;layer.hidden=false;
   layer.innerHTML=index===-2
    ? '<div class="service-sheet service-cover"><img src="'+files+'front-cover.png" alt="Передняя обложка учебника"></div>'
    : index===-3 ? '<div class="service-sheet service-endpaper"><div class="service-maps"><div class="service-primary"><span class="service-map-title service-map-title-main">Россия в конце XVI века</span><img class="service-main-map service-map-click" tabindex="0" role="button" src="'+files+'rear-map.png" data-caption="Россия в конце XVI века" alt="Россия в конце XVI века"></div><figure class="service-inset-figure"><img class="service-inset service-map-click" tabindex="0" role="button" src="'+files+'rear-inset.png" data-caption="Административное деление юга нижегородских земель в конце XVI века" alt="Административное деление юга нижегородских земель в конце XVI века"><figcaption class="service-inset-label"><span class="service-map-title service-map-title-inset">Административное деление юга нижегородских земель в конце XVI века</span></figcaption></figure><span class="service-map-caption">Нажмите на карту для увеличения</span></div><img class="service-legend" src="'+files+'rear-legend.png" alt="Условные обозначения карты"></div>' : index===-4 ? '<div class="service-sheet service-cover"><img src="'+files+'rear-cover.png" alt="Задняя обложка"></div>'
    : '<div class="service-sheet service-endpaper"><div class="service-maps"><div class="service-primary"><span class="service-map-title service-map-title-main">Карта древностей России</span><img class="service-main-map service-map-click" tabindex="0" role="button" src="'+files+'main-map.png" data-caption="Карта древностей России" alt="Карта древностей России"></div><figure class="service-inset-figure"><img class="service-inset service-map-click" tabindex="0" role="button" src="'+files+'inset-map.png" data-caption="Расселение племён в Нижегородском Поволжье в конце I тысячелетия нашей эры" alt="Расселение племён в Нижегородском Поволжье в конце I тысячелетия нашей эры"><figcaption class="service-inset-label"><span class="service-map-title service-map-title-inset">Расселение племён в Нижегородском Поволжье в конце I тысячелетия нашей эры</span></figcaption></figure><span class="service-map-caption">Нажмите на карту для увеличения</span></div><img class="service-legend" src="'+files+'legend.png" alt="Условные обозначения карты"></div>';
   document.getElementById('pageInput').value=({[-2]:'Обложка',[-1]:'Форзац',[-3]:'Эрзац',[-4]:'Задняя обложка'})[index];
   layer.querySelectorAll('.service-map-click').forEach(el=>{
    const open=()=>{zoom=1;legend.hidden=!el.classList.contains('service-main-map');legend.querySelector('img').src=files+(serviceIndex===-3?'rear-legend.png':'legend.png');picture.src=el.src;caption.textContent=el.dataset.caption;dialog.showModal();picture.onload=()=>{fitMap();};if(picture.complete&&picture.naturalWidth)fitMap();};
    el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
   });
 }
 function hide(){serviceIndex=null;layer.hidden=true;layer.innerHTML='';document.getElementById('pageInput').value=window.__serviceLastBookPage||'1';}
 function nav(delta){
  if(serviceIndex!==null){if(delta>0){if(serviceIndex===-2)show(-1);else if(serviceIndex===-3)show(-4);else if(serviceIndex===-4)return true;else {hide();window.dispatchEvent(new CustomEvent('reader-service-open-first-page'));}}else if(serviceIndex===-4)show(-3);else if(serviceIndex===-1)show(-2);return true;}
  if(delta<0 && (Number(window.__serviceLastBookIndex)===0 || String(window.__serviceLastBookPage||'1')==='1')){show(-1);return true;}
  return false;
 }
 window.ReaderServicePages={nav,hide,show,isActive:()=>serviceIndex!==null};
 function fitMap(){
  if(!picture.naturalWidth)return;
  const availableWidth=Math.max(100,viewport.clientWidth-20),availableHeight=Math.max(100,viewport.clientHeight-20);
  const ratio=Math.min(availableWidth/picture.naturalWidth,availableHeight/picture.naturalHeight);
  baseWidth=Math.round(picture.naturalWidth*ratio);baseHeight=Math.round(picture.naturalHeight*ratio);
  zoom=1;applyZoom();
 }
 function applyZoom(){
  if(!baseWidth)return;
  const centerX=viewport.scrollLeft+viewport.clientWidth/2,centerY=viewport.scrollTop+viewport.clientHeight/2;
  const previous=Number(reset.dataset.zoom)||1;
  picture.style.width=Math.round(baseWidth*zoom)+'px';picture.style.height=Math.round(baseHeight*zoom)+'px';
  reset.textContent=Math.round(zoom*100)+'%';reset.dataset.zoom=zoom;
  viewport.scrollLeft=Math.max(0,centerX*zoom/previous-viewport.clientWidth/2);
  viewport.scrollTop=Math.max(0,centerY*zoom/previous-viewport.clientHeight/2);
 }
 document.getElementById('serviceMapClose').onclick=()=>dialog.close();
 document.getElementById('serviceMapPlus').onclick=()=>{zoom=Math.min(4,zoom+.25);applyZoom();};
 document.getElementById('serviceMapMinus').onclick=()=>{zoom=Math.max(1,zoom-.25);applyZoom();};
 reset.onclick=()=>fitMap();
 let dragging=false, startX=0,startY=0,scrollX=0,scrollY=0;
 viewport.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  dragging=true;startX=e.clientX;startY=e.clientY;scrollX=viewport.scrollLeft;scrollY=viewport.scrollTop;
  viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');e.preventDefault();
 });
 viewport.addEventListener('pointermove',e=>{
  if(!dragging)return;
  viewport.scrollLeft=scrollX-(e.clientX-startX);
  viewport.scrollTop=scrollY-(e.clientY-startY);
 });
 const stopDrag=()=>{dragging=false;viewport.classList.remove('dragging');};
 viewport.addEventListener('pointerup',stopDrag);
 viewport.addEventListener('pointercancel',stopDrag);
 picture.addEventListener('dragstart',e=>e.preventDefault());
 viewport.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom=Math.max(1,Math.min(4,zoom+(e.deltaY<0?.25:-.25)));applyZoom();}},{passive:false});
 dialog.addEventListener('close',()=>{picture.removeAttribute('src');picture.onload=null;baseWidth=0;baseHeight=0;reset.dataset.zoom='1';});
 if(!localStorage.getItem('reader_service_intro_seen')){show(-2);localStorage.setItem('reader_service_intro_seen','1');}
})();
