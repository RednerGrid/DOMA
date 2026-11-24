// Stage 1: interface only. The Viewer scene router will replace preview switching.
const page = document.body;
const image = document.querySelector('.vr-image');
const collapse = document.querySelector('.vr-collapse');
const fullscreen = document.querySelector('.vr-fullscreen');
const burger = document.querySelector('.burger');
const nav = document.querySelector('.header-links');
const sections = [...document.querySelectorAll('.vr-section')];
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('pointerdown', e => { if (!e.target.closest('.site-header')) setMenu(false); });
collapse.addEventListener('click', () => {
  const clean = page.classList.toggle('is-clean');
  collapse.textContent = clean ? '›' : '‹';
  collapse.setAttribute('aria-expanded', String(!clean));
  collapse.setAttribute('aria-label', clean ? 'Показать интерфейс' : 'Скрыть интерфейс');
  for (const el of document.querySelectorAll('.site-header,.vr-rail,.vr-fullscreen')) el.inert = clean;
  setMenu(false);
});
for (const section of sections) section.addEventListener('click', () => {
  // Static gallery preview only, not a panorama.
  const preview = section.querySelector('img');
  const probe = new Image();
  probe.onload = () => {
    image.src = preview.src;
    image.alt = section.textContent.trim();
    for (const item of sections) item.setAttribute('aria-pressed', String(item === section));
  };
  probe.src = preview.src;
});
if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) fullscreen.hidden = true;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { console.warn('Fullscreen unavailable', error); }
});
document.addEventListener('fullscreenchange', () => fullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Выйти из полноэкранного режима' : 'Полный экран'));
