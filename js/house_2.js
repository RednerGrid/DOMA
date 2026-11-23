// house_2 is a presentation layer over the existing houseGallery.js state.
const page = document.body;
const info = document.querySelector('.info-toggle');
const dialog = document.querySelector('.vr-dialog');
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
document.querySelector('.vr-cta')?.addEventListener('click', () => { hideIntro(); dialog.hidden = false; });
const closeDialog = () => { dialog.hidden = true; };
document.querySelector('.vr-close')?.addEventListener('click', closeDialog);
dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDialog(); });
const burger = document.querySelector('.burger');
burger?.addEventListener('click', () => { const nav = document.querySelector('.header-links'); const open = burger.getAttribute('aria-expanded') !== 'true'; burger.setAttribute('aria-expanded', String(open)); nav.style.display = open ? 'flex' : ''; nav.style.position = open ? 'absolute' : ''; nav.style.top = open ? '64px' : ''; nav.style.right = open ? '0' : ''; nav.style.background = open ? '#222' : ''; nav.style.flexDirection = open ? 'column' : ''; nav.style.padding = open ? '24px' : ''; });


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
  if (dialog && !dialog.hidden) return;
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
