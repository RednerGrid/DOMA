// Masks are sampled in source-image coordinates, including object-fit: cover cropping.
export async function createOverview(image, source, objects, asset, onSelect) {
  const entries = await Promise.all(objects.map(async object => {
    const mask = new Image(); mask.src = asset(object.mask);
    const hover = new Image(); hover.src = asset(object.hover);
    await Promise.all([mask.decode(), hover.decode()]);
    if ([mask, hover].some(img => img.naturalWidth !== source.naturalWidth || img.naturalHeight !== source.naturalHeight)) throw new Error(`Overview asset size mismatch: ${object.id}`);
    const canvas = document.createElement('canvas');
    canvas.width = mask.naturalWidth; canvas.height = mask.naturalHeight;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(mask,0,0);
    const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    hover.className = 'vr-image vr-overview-hover'; hover.alt = ''; hover.setAttribute('aria-hidden','true');
    return {object, hover, pixels, width:canvas.width, height:canvas.height};
  }));
  let active = null;
  function hit(event) {
    if (document.body.classList.contains('is-clean')) return null;
    const r = image.getBoundingClientRect();
    const scale = Math.max(r.width/source.naturalWidth,r.height/source.naturalHeight);
    const x = Math.floor((event.clientX-r.left+(source.naturalWidth*scale-r.width)/2)/scale);
    const y = Math.floor((event.clientY-r.top+(source.naturalHeight*scale-r.height)/2)/scale);
    return entries.find(e => x>=0 && y>=0 && x<e.width && y<e.height && e.pixels[(y*e.width+x)*4]>=128) || null;
  }
  function highlight(entry) {
    active = entry;
    for (const e of entries) e.hover.classList.toggle('is-active',e===active);
    image.style.cursor = active ? 'pointer' : '';
  }
  const move = e => highlight(e.pointerType === 'touch' ? null : hit(e));
  const leave = () => highlight(null);
  const click = e => { const entry=hit(e); if(entry) onSelect(entry.object); };
  const observer = new MutationObserver(() => {if(document.body.classList.contains('is-clean')) leave();});
  return {
    start() {
      for(const e of entries) image.after(e.hover);
      image.addEventListener('pointermove',move); image.addEventListener('pointerleave',leave); image.addEventListener('click',click);
      observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    },
    destroy() {
      observer.disconnect(); leave();
      image.removeEventListener('pointermove',move); image.removeEventListener('pointerleave',leave); image.removeEventListener('click',click);
      for(const e of entries) e.hover.remove();
    }
  };
}
