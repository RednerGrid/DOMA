import {createGateRenderer} from './routeGateRenderer.js';
export function createPanoramaGates(scene, camera, host, gates, onOpen) {
  const THREE = window.THREE;
  const visual = createGateRenderer();
  visual.initRouteGates(scene);
  const ray = new THREE.Raycaster();
  let hover = null, pointer = null, down = null;
  const clean = () => document.body.classList.contains('is-clean');
  function hit(e) {
    if (!e || clean()) return null;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    const targets = visual.getTargets();
    const result = ray.intersectObjects(targets.map(t=>t.mesh),false)[0];
    return targets.find(t=>t.mesh===result?.object)?.id ?? null;
  }
  function move(e) { pointer=e; if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>6) down.moved=true; }
  function start(e) { if(down) {down.moved=true;return;} down={id:e.pointerId,x:e.clientX,y:e.clientY,gate:hit(e),moved:false}; }
  function end(e) { if(down?.id!==e.pointerId)return; const d=down;down=null; if(!d.moved && d.gate && d.gate===hit(e)) onOpen(gates.find(g=>g.id===d.gate)); }
  function cancel(){down=null;pointer=null;}
  function leave(){pointer=null;}
  const listeners={pointermove:move,pointerdown:start,pointerup:end,pointercancel:cancel,pointerleave:leave};
  for(const [name,fn] of Object.entries(listeners))host.addEventListener(name,fn);
  return {update(){
    if(clean()){visual.hideRouteGates();host.style.cursor='';return;}
    visual.updateRouteGates(gates.map(g=>({...g,active:g.id===hover})));
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    hover=hit(pointer);host.style.cursor=hover?'pointer':'';
  },destroy(){for(const [name,fn] of Object.entries(listeners))host.removeEventListener(name,fn);visual.destroyRouteGates();host.style.cursor='';}};
}
