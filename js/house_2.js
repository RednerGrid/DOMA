// house_2 is a presentation layer over the existing houseGallery.js state.
const page = document.body;
const info = document.querySelector('.info-toggle');
const hideIntro = () => { page.classList.add('is-browsing'); info.hidden = false; };
const showIntro = () => { page.classList.remove('is-browsing'); info.hidden = true; };
// Only user-initiated navigation hides the description; initial gallery loading does not.
document.querySelector('.gallery-landscape-list')?.addEventListener('click', e => {
  if (e.target.closest('button')) hideIntro();
});
for (const [selector, direction] of [['.prev-frame',-1],['.next-frame',1]]) {
  document.querySelector(selector)?.addEventListener('click', () => {
    hideIntro(); window.domaGallery?.step(direction);
  });
}
info.addEventListener('click', showIntro);
document.querySelector('.vr-cta')?.addEventListener('click', () => { window.location.href = './vr.html'; });
const burger = document.querySelector('.burger');
const nav = document.querySelector('.header-links');
function setMenuOpen(open) {
  burger?.setAttribute('aria-expanded', String(open));
  burger?.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  nav?.classList.toggle('is-open', open);
}
burger?.addEventListener('click', () => setMenuOpen(burger.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.site-header')) setMenuOpen(false);
});
nav?.addEventListener('click', event => {
  if (event.target.closest('a')) setMenuOpen(false);
});


// v3: Gallery controls follow the selected album, not the initial exterior count.
const visual = document.querySelector('.project-visual');
const frameCount = document.querySelector('.gallery-progress-count');
const frameDots = document.querySelector('.gallery-progress-dots');
const prevFrame = document.querySelector('.prev-frame');
const nextFrame = document.querySelector('.next-frame');

function updateV3GalleryControls() {
  const gallery = window.domaGallery;
  if (!gallery) return;
  const {activeView, activeRoom, activeImageIndex} = gallery.getState();
  const images = activeView === 'interior'
    ? gallery.project.gallery?.interior?.[activeRoom]?.images ?? []
    : gallery.project.gallery?.[activeView] ?? [];
  const total = activeView === 'object360' ? 0 : Array.isArray(images) ? images.length : 0;
  frameCount.textContent = total ? `${activeImageIndex + 1} / ${total}` : '';
  const hasMultiple = total > 1;
  prevFrame.hidden = !hasMultiple;
  nextFrame.hidden = !hasMultiple;
  frameDots.replaceChildren();
  if (total > 1 && total <= 12) {
    for (let index = 0; index < total; index++) {
      const dot = document.createElement('span');
      dot.className = 'gallery-progress-dot';
      dot.classList.toggle('active', index === activeImageIndex);
      frameDots.append(dot);
    }
  }
  document.querySelector('.gallery-progress').hidden = !total;
}
document.addEventListener('doma:gallery-ready', updateV3GalleryControls);
document.addEventListener('doma:gallery-change', updateV3GalleryControls);

// Keyboard arrows work in both regular and fullscreen viewing modes.
document.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if (!page.classList.contains('is-browsing')) return;
  // Shared houseGallery.js already handles fullscreen keyboard navigation.
  if (document.fullscreenElement === visual) return;
  const state = window.domaGallery?.getState();
  if (!state || state.activeView === 'object360') return;
  event.preventDefault();
  window.domaGallery.step(event.key === 'ArrowRight' ? 1 : -1);
});

// v5: the same album rail serves desktop and mobile portrait.
// Clicking a category dismisses the hero description, without a second gallery engine.
// Existing delegated .gallery-landscape-list click handler above handles both layouts.

// v5.4: one gesture controller for ordinary photos. Object360 keeps its own input.
(() => {
  const stage = document.querySelector('.project-visual');
  const photo = stage?.querySelector('.project-visual-image');
  if (!stage || !photo) return;
  const mobile = () => matchMedia('(max-width:700px), (orientation:landscape) and (max-height:600px) and (max-width:1100px)').matches;
  const isPhoto = () => window.domaGallery?.getState()?.activeView !== 'object360';
  const blocked = '.gallery-landscape-albums, .project-intro, .info-toggle, .site-header, button, a, .viewer-controls';
  const targetOK = e => !e.target.closest(blocked) && (e.target === photo || e.target.closest('.hero-cover, .gallery-crossfade-image, .project-gallery-placeholder'));
  const pointers = new Map();
  let scale=1, tx=0, ty=0, start=null, pinch=null, lastTap=0, consumed=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function apply() {
    const rect=stage.getBoundingClientRect();
    const maxX=(rect.width*(scale-1))/2, maxY=(rect.height*(scale-1))/2;
    tx=clamp(tx,-maxX,maxX);ty=clamp(ty,-maxY,maxY);
    // The wrapper transform is independent of the project.json crop settings.
    stage.style.setProperty('--photo-gesture-scale',String(scale));
    stage.style.setProperty('--photo-gesture-x',`${tx}px`);
    stage.style.setProperty('--photo-gesture-y',`${ty}px`);
    photo.classList.toggle('is-gesture-zoomed',scale>1.001);
  }
  function reset(){pointers.clear();start=null;pinch=null;scale=1;tx=ty=0;apply();}
  document.addEventListener('doma:gallery-change',reset);
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  stage.addEventListener('pointerdown',e=>{
    if(!mobile()||!isPhoto()||!targetOK(e))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    consumed=false;
    if(pointers.size===1){start={id:e.pointerId,x:e.clientX,y:e.clientY,tx,ty};}
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,dist(a,b)),scale,tx,ty,centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2};start=null;}
    try{stage.setPointerCapture(e.pointerId);}catch{}
  });
  stage.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!isPhoto())return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];scale=clamp(pinch.scale*dist(a,b)/pinch.distance,1,3);tx=pinch.tx+((a.x+b.x)/2-pinch.centerX);ty=pinch.ty+((a.y+b.y)/2-pinch.centerY);apply();consumed=true;}
    else if(pointers.size===1&&start&&scale>1){tx=start.tx+e.clientX-start.x;ty=start.ty+e.clientY-start.y;apply();consumed=true;}
  });
  function finish(e){
    if(!pointers.has(e.pointerId))return;
    const origin=start;const wasPinch=!!pinch;
    pointers.delete(e.pointerId);
    if(pointers.size===0){
      if(origin&&!wasPinch&&scale===1){
        const dx=e.clientX-origin.x,dy=e.clientY-origin.y;
        if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){
          window.domaGallery?.step(dx<0?1:-1);consumed=true;
        } else if(Math.abs(dx)<12&&Math.abs(dy)<12){
          const now=Date.now();if(now-lastTap<320){scale=scale>1?1:2;tx=ty=0;apply();consumed=true;lastTap=0;}else lastTap=now;
        }
      }
      start=null;pinch=null;
    }else if(pointers.size===1){const p=[...pointers.entries()][0];start={id:p[0],x:p[1].x,y:p[1].y,tx,ty};pinch=null;}
  }
  stage.addEventListener('pointerup',finish);
  stage.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(!pointers.size){start=null;pinch=null;}});
  stage.addEventListener('click',e=>{if(consumed&&targetOK(e)){e.preventDefault();e.stopImmediatePropagation();consumed=false;}},true);
})();

// v5.7: choose mobile-landscape framing from each photo's intrinsic ratio.
// The gallery remains the sole owner of image loading and transitions.
(() => {
  const stage = document.querySelector('.project-visual');
  const photo = stage?.querySelector('img.project-visual-image');
  if (!stage || !photo) return;
  let version = 0;
  function updateFraming() {
    const current = ++version;
    const view = window.domaGallery?.getState()?.activeView;
    if (view === 'object360' || !photo.src || photo.style.display === 'none') {
      stage.classList.remove('is-narrow-photo');
      stage.style.removeProperty('--landscape-photo-background');
      return;
    }
    const src = photo.currentSrc || photo.src;
    const probe = new Image();
    probe.onload = () => {
      if (current !== version || (window.domaGallery?.getState()?.activeView === 'object360')) return;
      const narrow = probe.naturalWidth / probe.naturalHeight < 1.4;
      stage.classList.toggle('is-narrow-photo', narrow);
      if (narrow) stage.style.setProperty('--landscape-photo-background', `url(${JSON.stringify(src)})`);
      else stage.style.removeProperty('--landscape-photo-background');
    };
    probe.src = src;
  }
  photo.addEventListener('load', updateFraming);
  new MutationObserver(updateFraming).observe(photo, {attributes:true, attributeFilter:['src','style']});
  document.addEventListener('doma:gallery-change', () => requestAnimationFrame(updateFraming));
  document.addEventListener('doma:gallery-ready', updateFraming);
  updateFraming();
})();
