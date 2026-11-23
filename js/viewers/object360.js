/** Standalone DOMA JPEG-sequence Object360. No Viewer runtime dependencies. */
export function createObject360(container, config, basePath) {
    if (config.source === "video") return createVideoObject360(container, config, basePath);
    const count = Number(config.frameCount);
    if (!Number.isInteger(count) || count < 1) throw new Error('Object360: invalid frameCount');
    const canvas = document.createElement('canvas');
    canvas.className = 'doma-object360-canvas';
    canvas.setAttribute('aria-label', `Вращение объекта ${config.title || ''} на 360 градусов`);
    const ctx = canvas.getContext('2d', { alpha: false });
    const status = document.createElement('div');
    status.className = 'doma-object360-status';
    status.textContent = 'Загрузка 360°…';
    container.append(canvas, status);
    const images = new Array(count);
    const failed = new Set();
    const pending = new Set();
    const abort = new AbortController();
    let disposed = false, angle = 0, velocity = 0, lastX = 0, pointerId = null, raf = 0;
    let lastFrame = -1, lastDrawn = -1, active = 0;
    const firstNumber = config.startFrame ?? 0;
    const path = new URL(`${basePath}${config.path}`, document.baseURI);
    const url = i => new URL(`${config.framePrefix || 'frame_'}${String(firstNumber + i).padStart(config.padding ?? 4, '0')}.${config.extension || 'jpg'}`, path).href;
    function draw() {
        if (disposed) return;
        const wanted = ((Math.round(angle / 360 * count) % count) + count) % count;
        let index = wanted;
        if (!images[index]) {
            let nearest = Infinity;
            for (let i = 0; i < count; i++) {
                if (!images[i]) continue;
                const d = Math.min(Math.abs(i - wanted), count - Math.abs(i - wanted));
                if (d < nearest) { nearest = d; index = i; }
            }
        }
        if (!images[index] || (index === lastDrawn && wanted === lastFrame)) return;
        const img = images[index];
        const rect = canvas.getBoundingClientRect();

        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const scale = Math.max(
            width / img.naturalWidth,
            height / img.naturalHeight
        );

        const drawWidth = img.naturalWidth * scale;
        const drawHeight = img.naturalHeight * scale;

        const x = document.body.classList.contains("house-v2") ? width - drawWidth : (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        lastDrawn = index;
        lastFrame = wanted;
    }
    function load(i) {
        if (disposed || images[i] || failed.has(i) || pending.has(i)) return Promise.resolve();
        pending.add(i);
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => { if (!disposed) { images[i] = img; status.hidden = true; draw(); } pending.delete(i); resolve(); };
            img.onerror = () => { failed.add(i); pending.delete(i); resolve(); };
            img.src = url(i);
        });
    }
    function tick() {
        if (disposed) return;
        if (pointerId === null && Math.abs(velocity) > 0.05) {
            angle = (angle + velocity + 360) % 360;

            velocity *= Math.abs(velocity) > 0.5
                ? 0.92
                : 0.85;

            draw();
        } else if (pointerId === null) {
            velocity = 0;
        }
        raf = requestAnimationFrame(tick);
    }
    function down(e) {
        if (pointerId !== null) return;
        pointerId = e.pointerId; lastX = e.clientX; velocity = 0;
        canvas.setPointerCapture(e.pointerId);
    }
    function move(e) {
        if (pointerId !== e.pointerId) return;
        const delta = (e.clientX - lastX) * .2;
        lastX = e.clientX;
        angle = (angle + delta + 360) % 360;
        velocity = delta;
        draw();
    }
    function up(e) { if (pointerId === e.pointerId) pointerId = null; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    // Start with frame 0, then progressively fetch remaining frames with bounded concurrency.
    (async () => {
        await load(0);
        if (disposed) return;
        if (!images[0]) { status.textContent = 'Не удалось загрузить первый кадр 360°'; return; }
        let next = 1;
        const worker = async () => {
            while (!disposed && next < count) await load(next++);
        };
        await Promise.all(Array.from({ length: Math.min(4, count - 1) }, worker));
        if (!disposed && failed.size) console.warn(`Object360: отсутствуют ${failed.size} из ${count} кадров`);
    })();
    raf = requestAnimationFrame(tick);
    return {
        destroy() {
            disposed = true;
            abort.abort();
            cancelAnimationFrame(raf);
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            canvas.remove(); status.remove();
        }
    };
}


// MP4 mode. The existing JPEG implementation above remains unchanged.
function createVideoObject360(container, config, basePath) {
    const count = Number(config.frameCount);
    const fps = Number(config.fps);
    if (!Number.isInteger(count) || count < 1 || !Number.isFinite(fps) || fps <= 0 || !config.file) {
        throw new Error('Object360 video: invalid file, fps or frameCount');
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'doma-object360-canvas';
    canvas.setAttribute('aria-label', `Вращение объекта ${config.title || ''} на 360 градусов`);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Object360 video: canvas 2D unavailable');

    const status = document.createElement('div');
    status.className = 'doma-object360-status';
    status.textContent = 'Загрузка 360°…';

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    // Keep the video element in the DOM for browser decoding; only the canvas is visible.
    video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    container.append(canvas, status, video);

    let disposed = false;
    let angle = 0;
    let velocity = 0;
    let lastX = 0;
    let pointerId = null;
    let raf = 0;
    let ready = false;
    let seeking = false;
    let wantedFrame = 0;
    let requestedFrame = -1;
    let displayedFrame = -1;

    const frameAtAngle = () => ((Math.round(angle / 360 * count) % count) + count) % count;

    function paint() {
        if (disposed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        const width = Math.max(1, Math.round(canvas.getBoundingClientRect().width));
        const height = Math.max(1, Math.round(canvas.getBoundingClientRect().height));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
        const drawWidth = video.videoWidth * scale;
        const drawHeight = video.videoHeight * scale;
        ctx.drawImage(video, document.body.classList.contains("house-v2") ? width - drawWidth : (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        status.hidden = true;
    }

    function seekLatest() {
        if (disposed || !ready || seeking || wantedFrame === displayedFrame) return;
        seeking = true;
        requestedFrame = wantedFrame;
        // Seek inside the center of the desired frame to avoid boundary rounding.
        const time = (requestedFrame + 0.5) / fps;
        try {
            video.currentTime = Math.min(time, Math.max(0, video.duration - 0.001));
        } catch (error) {
            seeking = false;
            status.hidden = false;
            status.textContent = 'Ошибка перехода между кадрами';
            console.error('Object360 video seek:', error);
        }
    }

    function update() {
        wantedFrame = frameAtAngle();
        seekLatest();
    }

    function onSeeked() {
        if (disposed) return;
        paint();
        displayedFrame = requestedFrame;
        seeking = false;
        seekLatest(); // Skip obsolete intermediate requests.
    }

    function onLoaded() {
        if (disposed || ready) return;
        ready = true;
        displayedFrame = 0;
        paint();
        update();
    }

    function onError() {
        if (disposed) return;
        status.hidden = false;
        status.textContent = 'Не удалось загрузить MP4 360°';
        console.error('Object360 video:', video.error);
    }

    function tick() {
        if (disposed) return;

        if (pointerId === null && Math.abs(velocity) > 0.05) {
            angle = (angle + velocity + 360) % 360;

            velocity *= Math.abs(velocity) > 0.5
                ? 0.92
                : 0.85;

            update();
        } else if (pointerId === null) {
            velocity = 0;
        }

        raf = requestAnimationFrame(tick);
    }

    function down(event) {
        if (pointerId !== null) return;
        pointerId = event.pointerId;
        lastX = event.clientX;
        velocity = 0;
        canvas.setPointerCapture(event.pointerId);
    }
    function move(event) {
        if (pointerId !== event.pointerId) return;
        const delta = (event.clientX - lastX) * 0.2;
        lastX = event.clientX;
        angle = (angle + delta + 360) % 360;
        velocity = delta;
        update();
    }
    function up(event) {
        if (pointerId === event.pointerId) pointerId = null;
    }

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.src = new URL(`${basePath}${config.file}`, document.baseURI).href;
    video.load();
    raf = requestAnimationFrame(tick);

    return {
        destroy() {
            disposed = true;
            cancelAnimationFrame(raf);
            canvas.removeEventListener('pointerdown', down);
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
            video.removeEventListener('loadeddata', onLoaded);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            video.pause();
            video.removeAttribute('src');
            video.load();
            canvas.remove();
            status.remove();
            video.remove();
        }
    };
}
