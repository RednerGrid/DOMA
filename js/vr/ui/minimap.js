// Optional map UI. Coordinates are normalized to the image, not the viewport.
export function createMinimap(host, maps, asset, onNavigate) {
  const root = document.createElement('aside');
  root.className = 'vr-minimap'; root.hidden = true;
  root.setAttribute('aria-label', 'Карта навигации');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'vr-map-toggle';
  const content = document.createElement('div'); content.className = 'vr-map-content';
  const img = document.createElement('img'); img.alt = ''; img.draggable = false;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('aria-hidden','true');
  const sector = document.createElementNS(ns, 'path'); svg.append(sector);
  const points = document.createElement('div'); points.className = 'vr-map-points';
  content.append(img, svg, points); root.append(toggle, content); host.append(root);
  let collapsed = false, frame = 0, currentMap, currentPoint, getView;
  function setCollapsed(value) {
    collapsed = value; content.hidden = value; toggle.textContent = value ? '▣' : '−';
    toggle.setAttribute('aria-expanded', String(!value));
    toggle.setAttribute('aria-label', value ? 'Развернуть карту' : 'Свернуть карту');
  }
  setCollapsed(false); toggle.addEventListener('click', () => setCollapsed(!collapsed));
  function draw() {
    frame = 0;
    if (!currentMap || !getView) return;
    if (!collapsed && !document.body.classList.contains('is-clean')) {
      const w = content.clientWidth, h = content.clientHeight, v = getView();
      if (w && h && v && currentPoint) {
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const x = currentPoint.x*w, y = currentPoint.y*h;
        const angle = (v.yaw + (currentMap.yawOffset || 0) + (currentPoint.yawOffset || 0))*Math.PI/180;
        const aspect = host.clientWidth / Math.max(1,host.clientHeight);
        const half = Math.atan(Math.tan(v.fov*Math.PI/360)*aspect);
        const r = Math.min(w,h)*0.24;
        const a = angle-half, b = angle+half;
        sector.setAttribute('d', `M ${x} ${y} L ${x+r*Math.cos(a)} ${y+r*Math.sin(a)} A ${r} ${r} 0 0 1 ${x+r*Math.cos(b)} ${y+r*Math.sin(b)} Z`);
      }
    }
    frame = requestAnimationFrame(draw);
  }
  function show(section, sceneId, view) {
    cancelAnimationFrame(frame); frame = 0;
    currentMap = maps?.[section]; currentPoint = currentMap?.points?.[sceneId]; getView = view;
    root.hidden = !currentMap?.image || !currentPoint || !view;
    if (root.hidden) return;
    img.src = asset(currentMap.image); points.replaceChildren();
    sector.removeAttribute('d');
    for (const [id,p] of Object.entries(currentMap.points)) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'vr-map-point'; button.style.left = `${p.x*100}%`; button.style.top = `${p.y*100}%`;
      button.setAttribute('aria-label', p.title || id); button.setAttribute('aria-current', String(id === sceneId));
      button.addEventListener('click', () => { if (id !== sceneId) onNavigate(id); }); points.append(button);
    }
    frame = requestAnimationFrame(draw);
  }
  img.addEventListener('error', () => { root.hidden = true; cancelAnimationFrame(frame); });
  return {show, setClean: clean => {root.inert = clean;}};
}
