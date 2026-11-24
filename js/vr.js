import { createOverview } from "./vr/modules/overviewViewer.js";
import { createPanorama } from "./vr/modules/panoramaViewer.js";
// Stage 2: project configuration and static scene previews.
const page = document.body;
const image = document.querySelector('.vr-image');
const collapse = document.querySelector('.vr-collapse');
const fullscreen = document.querySelector('.vr-fullscreen');
const burger = document.querySelector('.burger');
const nav = document.querySelector('.header-links');

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
if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) fullscreen.hidden = true;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { console.warn('Fullscreen unavailable', error); }
});
document.addEventListener('fullscreenchange', () => fullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Выйти из полноэкранного режима' : 'Полный экран'));

const rail = document.querySelector('.vr-rail');
const list = document.querySelector('.vr-list');
const status = document.querySelector('.vr-status');
let requestId = 0;
const panoramaHost = document.querySelector(".vr-panorama");
let activePanorama = null;
let activeOverview = null;
async function initTour() {
  const project = new URLSearchParams(location.search).get('project') || 'barn80';
  if (!/^[a-zA-Z0-9_-]+$/.test(project)) throw new Error('Некорректный ID проекта');
  const configURL = new URL(`./projects/${project}/vr/tour.json`, location.href);
  const response = await fetch(configURL);
  if (!response.ok) throw new Error(`tour.json: HTTP ${response.status}`);
  const tour = await response.json();
  const scenes = tour.scenes || {};
  const asset = path => new URL(path, configURL).href;
  const available = (tour.sections || []).filter(section => scenes[section.startScene]?.image);
  const buttons = new Map();
  async function openScene(id, sectionId = null, transition = "instant", arrivalView = null) {
    const scene = scenes[id];
    if (!scene?.image) throw new Error(`Сцена недоступна: ${id}`);
    const current = ++requestId;
    let nextPanorama = null;
    let probe;
    let nextOverview;
    try {
      if (scene.type === 'panorama') {
        nextPanorama = await createPanorama(panoramaHost, asset(scene.image), arrivalView || scene.view, (scene.gates || []).filter(g=>scenes[g.targetScene]?.image), gate => {
          const view = activePanorama.getView();
          openScene(gate.targetScene, sectionId, gate.transition || "crossfade", {...view, yaw: view.yaw + (gate.yawOffset || 0)}).catch(showError);
        });
      } else {
        probe = new Image();
        probe.src = asset(scene.image);
        await probe.decode();
        if (scene.type === "overview" && scene.objects?.length) {
          nextOverview = await createOverview(image, probe, scene.objects, asset, object => {
            if (page.classList.contains("is-clean")) return;
            openScene(object.targetScene, object.targetSection || available.find(s => s.startScene === object.targetScene)?.id, object.transition).catch(showError);
          });
        }
      }
    } catch (error) {
      if (current !== requestId) return;
      throw error;
    }
    if (current !== requestId) { nextPanorama?.destroy(); nextOverview?.destroy(); return; }
    let fade = null;
    if (transition === "crossfade") {
      if (!image.hidden) fade = image.cloneNode();
      else if (activePanorama) { fade = image.cloneNode(); fade.src = activePanorama.snapshot(); fade.hidden = false; }
    }
    if (fade) { fade.classList.add("vr-scene-fade"); image.after(fade); }
    activeOverview?.destroy();
    activeOverview = nextOverview;
    activePanorama?.destroy();
    activePanorama = nextPanorama;
    panoramaHost.hidden = !nextPanorama;
    image.hidden = !!nextPanorama;
    if (nextPanorama) nextPanorama.start();
    else { image.src = probe.src; image.alt = scene.title || ''; nextOverview?.start(); }
    if (fade) { const animation = fade.animate([{opacity:1},{opacity:0}], {duration:matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400}); animation.finished.then(() => fade.remove(), () => fade.remove()); }
    status.hidden = true;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === sectionId));
  }
  document.title = `${tour.name || 'VR-тур'} — DOMA`;
  for (const section of available) {
    const button = document.createElement('button');
    button.className = 'vr-section';
    button.type = 'button';
    button.dataset.section = section.id;
    button.setAttribute('aria-pressed', 'false');
    const preview = document.createElement('img');
    preview.src = asset(section.preview || scenes[section.startScene].image);
    preview.alt = '';
    const label = document.createElement('span');
    label.textContent = section.title;
    button.append(preview, label);
    button.addEventListener('click', () => openScene(section.startScene, section.id).catch(showError));
    list.append(button);
    buttons.set(section.id, button);
  }
  rail.hidden = available.length < 2;
  if (rail.hidden) collapse.style.setProperty('--rail', '0px');
  const start = tour.startScene && scenes[tour.startScene]?.image ? tour.startScene : (available.find(s => s.id === 'interior') || available[0])?.startScene;
  await openScene(start, scenes[start]?.type === 'overview' ? null : available.find(s => s.startScene === start)?.id);
}
function showError(error) {
  console.error(error);
  status.textContent = 'Не удалось загрузить сцену тура.';
  status.hidden = false;
}
initTour().catch(showError);
