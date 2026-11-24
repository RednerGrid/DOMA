import {createPanoramaGates} from './panoramaGates.js';
// Camera and pointer mechanics ported from the original Viewer.
export async function createPanorama(viewerRef, url, view = {}, gates = [], onGate = () => {}) {
  const THREE = window.THREE;
  const activePointers = new Map();
  const MOUSE_SENSITIVITY = 0.18;
  let lon = Number(view.yaw ?? 0), lat = Number(view.pitch ?? 0);
  let targetFov = Number(view.fov ?? 50);
  let isDown = false, startX = 0, startY = 0;
  let startPinchDistance = 0, startPinchFov = 50, animationId;
  const texture = await new THREE.TextureLoader().loadAsync(url);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true}); }
  catch (error) { texture.dispose(); throw error; }
  const scene3d = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(targetFov, 1, 1, 2000);
  const geometry = new THREE.SphereGeometry(500,128,64);
  geometry.scale(-1,1,1);
  const material = new THREE.MeshBasicMaterial({map:texture});
  scene3d.add(new THREE.Mesh(geometry,material));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  let gateLayer;
  let observer, started = false, disposed = false;
  function resize() {
    const w = viewerRef.clientWidth, h = viewerRef.clientHeight;
    if (!w || !h) return;
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
  }
  function start() {
    if (started || disposed) return;
    started = true;
    viewerRef.append(renderer.domElement);
    resize(); observer = new ResizeObserver(resize); observer.observe(viewerRef);
    addControls(viewerRef); gateLayer = createPanoramaGates(scene3d,camera,viewerRef,gates,onGate); animate();
  }
  function destroy() {
    if (disposed) return;
    disposed = true;
    if (started) { removeControls(); observer.disconnect(); cancelAnimationFrame(animationId); }
    gateLayer?.destroy(); activePointers.clear(); texture.dispose(); material.dispose(); geometry.dispose();
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  }
function addControls(viewer) {
  viewer.style.touchAction = "none";
  viewer.style.userSelect = "none";

  viewer.addEventListener("pointerdown", onPointerDown);
  viewer.addEventListener("pointermove", onPointerMove);
  viewer.addEventListener("pointerup", onPointerEnd);
  viewer.addEventListener("pointercancel", onPointerEnd);
  viewer.addEventListener("wheel", onWheel, { passive: false });
}

function removeControls() {
  if (!viewerRef) return;

  viewerRef.removeEventListener("pointerdown", onPointerDown);
  viewerRef.removeEventListener("pointermove", onPointerMove);
  viewerRef.removeEventListener("pointerup", onPointerEnd);
  viewerRef.removeEventListener("pointercancel", onPointerEnd);
  viewerRef.removeEventListener("wheel", onWheel);
}

function onPointerDown(e) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  e.preventDefault();

  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });

  viewerRef.setPointerCapture(e.pointerId);

  if (activePointers.size === 1) {
    isDown = true;
    startX = e.clientX;
    startY = e.clientY;
  }

  if (activePointers.size === 2) {
    const points = [...activePointers.values()];
    startPinchDistance = getDistance(points[0], points[1]);
    startPinchFov = targetFov;
    isDown = false;
  }
}

function onPointerMove(e) {
  e.preventDefault();

  if (!activePointers.has(e.pointerId)) return;

  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });

  if (activePointers.size === 2) {
    const points = [...activePointers.values()];
    const currentDistance = getDistance(points[0], points[1]);
    const zoomFactor = startPinchDistance / currentDistance;

    targetFov = startPinchFov * zoomFactor;
    targetFov = Math.max(35, Math.min(60, targetFov));
    return;
  }

  if (!isDown) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  lon -= dx * MOUSE_SENSITIVITY;
  lat += dy * MOUSE_SENSITIVITY;

  startX = e.clientX;
  startY = e.clientY;
}

function onPointerEnd(e) {
  activePointers.delete(e.pointerId);
  isDown = false;

  if (viewerRef && viewerRef.hasPointerCapture(e.pointerId)) {
    viewerRef.releasePointerCapture(e.pointerId);
  }
}

function onWheel(e) {
  e.preventDefault();

  targetFov += e.deltaY * 0.03;
  targetFov = Math.max(35, Math.min(60, targetFov));
}

function getDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function animate() {
  animationId = requestAnimationFrame(animate);

  lat = Math.max(-45, Math.min(45, lat));
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);

  camera.lookAt(
    500 * Math.sin(phi) * Math.cos(theta),
    500 * Math.cos(phi),
    500 * Math.sin(phi) * Math.sin(theta)
  );

  camera.fov += (targetFov - camera.fov) * 0.12;
  camera.updateProjectionMatrix();

  window.currentView = {
  yaw: Number(lon.toFixed(1)),
  pitch: Number(lat.toFixed(1))
}; // временная для координат
  
  gateLayer?.update();
  renderer.render(scene3d, camera);

}


  return {start,destroy,getView:()=>({yaw:lon,pitch:lat,fov:camera.fov}),snapshot:()=>{renderer.render(scene3d,camera);return renderer.domElement.toDataURL();}};
}
