import { createObject360 } from "./viewers/object360.js";


const PROJECT_PATH = "./projects/barn80/";

const mainImage = document.querySelector(".project-visual-image");
const placeholder = document.querySelector(".project-gallery-placeholder");
const thumbnailsContainer = document.querySelector(".project-thumbnails");
const viewButtons = document.querySelectorAll(".project-visual-menu button");

const visualContainer = document.querySelector(".project-visual");
const fullscreenButton = document.querySelector(".project-fullscreen");
const object360Button = document.querySelector(".project-object360-toggle");
const object360Modal = document.querySelector(".doma-object360-modal");
const object360Dialog = document.querySelector(".doma-object360-dialog");
const object360Host = document.querySelector(".doma-object360-host");
const object360Close = document.querySelector(".doma-object360-close");
let object360Instance = null;
let object360ReturnFocus = null;

function stopObject360() {
    if (object360Modal?.hidden) return;
    object360Instance?.destroy();
    object360Instance = null;
    object360Modal.hidden = true;
    document.body.classList.remove("doma-object360-open");
    object360Button?.setAttribute("aria-pressed", "false");
    object360ReturnFocus?.focus();
    object360ReturnFocus = null;
}

object360Close?.addEventListener("click", stopObject360);
object360Modal?.addEventListener("click", event => {
    if (event.target === object360Modal) stopObject360();
});
document.addEventListener("keydown", event => {
    if (object360Modal?.hidden) return;
    if (event.key === "Escape") {
        event.preventDefault();
        stopObject360();
    } else if (event.key === "Tab") {
        // Keep keyboard focus inside the modal.
        event.preventDefault();
        object360Close?.focus();
    }
});

async function initHouseGallery() {
    if (!mainImage || !placeholder || !thumbnailsContainer || !viewButtons.length) {
        return;
    }

    try {
        const response = await fetch(PROJECT_PATH + "project.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const project = await response.json();
        object360Button?.addEventListener("click", async () => {
            if (document.fullscreenElement) await document.exitFullscreen();
            if (!object360Modal || !object360Host || !object360Dialog) return;
            if (!object360Modal.hidden) { stopObject360(); return; }
            const config = project.object360?.house;
            if (!config) { console.warn("Object360: конфигурация house отсутствует"); return; }
            object360ReturnFocus = document.activeElement;
            object360Modal.hidden = false;
            document.body.classList.add("doma-object360-open");
            object360Button.setAttribute("aria-pressed", "true");
            object360Close?.focus();
            try {
                object360Instance = createObject360(object360Host, config, PROJECT_PATH);
            } catch (error) {
                stopObject360();
                console.error(error);
            }
        });

        let activeView = "exterior";
        let activeRoom = null;
        let activeImageIndex = 0;
        const sync360 = () => { if (object360Button) object360Button.hidden = activeView !== "exterior"; };

        // Отображение основного изображения


let imageRequestId = 0;
let imageTransition = null;
const mobileMedia = window.matchMedia("(max-width: 700px)");

function clearImageTransition() {
    if (!imageTransition) return;
    clearTimeout(imageTransition.timer);
    imageTransition.overlay.remove();
    imageTransition = null;
}

function showImage(imagePath, alt) {
    const requestId = ++imageRequestId;
    const imageUrl = PROJECT_PATH + imagePath;
    clearImageTransition();

    const preloadImage = new Image();
    preloadImage.onload = () => {
        if (requestId !== imageRequestId) return;
        const ratio = preloadImage.naturalWidth / preloadImage.naturalHeight;
        const desktopFit = ratio >= 1.5 ? "cover" : "contain";
        const preview = project.mobilePreviews?.[imagePath] ?? {};
        const scale = Math.min(3, Math.max(1, Number(preview.scale) || 1));
        const x = Math.min(100, Math.max(0, Number(preview.x ?? 50)));
        const y = Math.min(100, Math.max(0, Number(preview.y ?? 50)));

        function applyFraming(img) {
            img.style.objectFit = mobileMedia.matches ? "cover" : desktopFit;
            img.style.objectPosition = mobileMedia.matches ? `${x}% ${y}%` : "50% 50%";
            img.style.transform = mobileMedia.matches ? `scale(${scale})` : "";
        }
        function commit() {
            if (requestId !== imageRequestId) return;
            mainImage.src = imageUrl;
            mainImage.alt = alt;
            applyFraming(mainImage);
            mainImage.style.display = "";
            placeholder.hidden = true;
            thumbnailsContainer.style.display = "";
        }
        if (mainImage.style.display === "none" || !mainImage.complete || !mainImage.naturalWidth) {
            commit();
            return;
        }
        if (mainImage.currentSrc === new URL(imageUrl, document.baseURI).href) {
            commit();
            return;
        }
        const overlay = document.createElement("img");
        overlay.className = "project-visual-image gallery-crossfade-image";
        overlay.src = imageUrl;
        overlay.alt = "";
        overlay.setAttribute("aria-hidden", "true");
        applyFraming(overlay);
        visualContainer.appendChild(overlay);
        const transition = { overlay, timer: null };
        imageTransition = transition;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (requestId === imageRequestId && imageTransition === transition) {
                overlay.classList.add("is-visible");
            }
        }));
        transition.timer = setTimeout(() => {
            if (requestId !== imageRequestId || imageTransition !== transition) return;
            commit();
            clearImageTransition();
        }, 280);
    };
    preloadImage.onerror = () => {
        if (requestId === imageRequestId) console.error("Не удалось загрузить изображение:", imageUrl);
    };
    preloadImage.src = imageUrl;
}


        // Пустая категория
        function showPlaceholder() {
            ++imageRequestId;
            clearImageTransition();
            mainImage.style.display = "none";
            placeholder.hidden = false;
            thumbnailsContainer.style.display = "none";
        }

        // Создание миниатюры
        function createThumbnail(imagePath, alt, onClick) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "project-thumbnail";
            button.title = alt;
            button.setAttribute("aria-label", alt);

            const image = document.createElement("img");
            image.src = PROJECT_PATH + imagePath;
            image.alt = alt;

            button.appendChild(image);
            thumbnailsContainer.appendChild(button);

            button.addEventListener("click", () => {
                onClick();

                thumbnailsContainer
                    .querySelectorAll(".project-thumbnail")
                    .forEach((item) => {
                        item.classList.remove("active");
                    });

                button.classList.add("active");

                document.dispatchEvent(new Event("doma:gallery-change"));

                button.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest"
                });
            });

            return button;
        }

        // Обычная галерея: экстерьер, планы, окружение
        function showGallery(view) {
            stopObject360();
            activeView = view;
            sync360();
            activeRoom = null;
            activeImageIndex = 0;

            thumbnailsContainer.replaceChildren();

            if (view === "interior") {
                showRooms();
                return;
            }

            const images = project.gallery?.[view] ?? [];

            if (!Array.isArray(images) || images.length === 0) {
                showPlaceholder();
                return;
            }

            images.forEach((imagePath, index) => {
                const button = createThumbnail(
                    imagePath,
                    `${project.name} — вид ${index + 1}`,
                    () => {
                        activeImageIndex = index;
                        showImage(
                            imagePath,
                            `${project.name} — вид ${index + 1}`
                        );
                    }
                );

                if (index === 0) {
                    button.click();
                }
            });
        }

        // Уровень 1: список комнат
        function showRooms() {
            activeRoom = null;
            activeImageIndex = 0;

            thumbnailsContainer.replaceChildren();

            const rooms = project.gallery?.interior ?? {};

            const availableRooms = Object.entries(rooms).filter(
                ([, room]) =>
                    Array.isArray(room.images) &&
                    room.images.length > 0
            );

            if (availableRooms.length === 0) {
                showPlaceholder();
                return;
            }

            // Основное изображение — первый рендер первой комнаты
            const firstRoom = availableRooms[0][1];

            showImage(
                firstRoom.images[0],
                `${project.name} — ${firstRoom.title}`
            );

            availableRooms.forEach(([roomId, room]) => {
                createThumbnail(
                    room.images[0],
                    room.title,
                    () => {
                        showRoomGallery(roomId);
                    }
                );
            });

            // On mobile, the sheet keeps the room list independently.
            // Select the first room so swipe navigation works immediately.
            if (window.matchMedia("(max-width: 700px)").matches) {
                showRoomGallery(availableRooms[0][0]);
            }
        }

        // Уровень 2: рендеры выбранной комнаты
        function showRoomGallery(roomId) {
            stopObject360();
            const room = project.gallery?.interior?.[roomId];

            if (!room || !Array.isArray(room.images) || !room.images.length) {
                return;
            }

            activeRoom = roomId;
            activeImageIndex = 0;

            thumbnailsContainer.replaceChildren();

            // Кнопка возврата к комнатам
            const backButton = document.createElement("button");
            backButton.type = "button";
            backButton.className =
                "project-thumbnail project-thumbnail-back";

            backButton.textContent = "← Назад";
            backButton.setAttribute(
                "aria-label",
                "Вернуться к списку комнат"
            );

            backButton.addEventListener("click", showRooms);
            thumbnailsContainer.appendChild(backButton);

            room.images.forEach((imagePath, index) => {
                const button = createThumbnail(
                    imagePath,
                    `${room.title} — ракурс ${index + 1}`,
                    () => {
                        activeImageIndex = index;

                        showImage(
                            imagePath,
                            `${project.name} — ${room.title}, ракурс ${index + 1}`
                        );
                    }
                );

                if (index === 0) {
                    button.click();
                }
            });
        }

        // API for mobile navigation: one shared gallery state, no duplicate fetch.
        window.domaGallery = {
            project,
            getState: () => ({ activeView, activeRoom, activeImageIndex }),
            selectView: (view) => {
                const button = [...viewButtons].find(item => item.dataset.view === view);
                button?.click();
                document.dispatchEvent(new Event("doma:gallery-change"));
            },
            selectRoom: (roomId) => {
                showRoomGallery(roomId);
                document.dispatchEvent(new Event("doma:gallery-change"));
            },
            step: (direction) => {
                const images = activeView === "interior"
                    ? project.gallery?.interior?.[activeRoom]?.images ?? []
                    : project.gallery?.[activeView] ?? [];
                if (!Array.isArray(images) || images.length < 2) return;
                const next = (activeImageIndex + direction + images.length) % images.length;
                const buttons = thumbnailsContainer.querySelectorAll(".project-thumbnail:not(.project-thumbnail-back)");
                if (buttons[next]) {
                    buttons[next].click();
                } else {
                    showImage(images[next], `${project.name} — ракурс ${next + 1}`);
                    activeImageIndex = next;
                    document.dispatchEvent(new Event("doma:gallery-change"));
                }
            }
        };
        document.dispatchEvent(new Event("doma:gallery-ready"));

        // Fullscreen: navigate only within the active category or room.
        document.addEventListener("keydown", event => {
            if (document.fullscreenElement !== visualContainer) return;
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            window.domaGallery?.step(event.key === "ArrowRight" ? 1 : -1);
            event.preventDefault();
        });

        // Переключение категорий Viewer
        viewButtons.forEach((button) => {
            button.addEventListener("click", () => {
                viewButtons.forEach((item) => {
                    item.classList.remove("active");
                });

                button.classList.add("active");
                showGallery(button.dataset.view);
            });
        });

        showGallery("exterior");

    } catch (error) {
        console.error("Ошибка загрузки галереи:", error);
    }
}

// Полноэкранный режим
if (visualContainer && fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement === visualContainer) {
                await document.exitFullscreen();
            } else {
                await visualContainer.requestFullscreen();
            }
        } catch (error) {
            console.error("Ошибка полноэкранного режима:", error);
        }
    });
}

// On mobile, tapping the photo opens fullscreen; controls keep their own actions.
if (mainImage && visualContainer) {
    mainImage.addEventListener("click", async () => {
        if (!window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches) return;
        if (document.fullscreenElement === visualContainer) return;
        try {
            await visualContainer.requestFullscreen();
        } catch (error) {
            console.error("Ошибка полноэкранного просмотра:", error);
        }
    });
}

document.addEventListener("fullscreenchange", () => {
    if (!fullscreenButton) return;

    const isFullscreen =
        document.fullscreenElement === visualContainer;

    fullscreenButton.textContent = isFullscreen ? "⤢" : "⛶";

    fullscreenButton.setAttribute(
        "aria-label",
        isFullscreen ? "Свернуть просмотр" : "Полный экран"
    );
});

initHouseGallery();

// Mobile bottom sheet uses the same gallery state as the desktop viewer.
function initMobileGallerySheet() {
    const sheet = document.querySelector(".gallery-sheet");
    const content = sheet?.querySelector(".gallery-sheet-content");
    const categories = sheet?.querySelector(".gallery-sheet-categories");
    const items = sheet?.querySelector(".gallery-sheet-items");
    const count = document.querySelector(".gallery-progress-count");
    const dots = document.querySelector(".gallery-progress-dots");
    if (!sheet || !content || !categories || !items) return;

    // Keep navigation visible; measure its content-driven height for overlay controls.
    const visual = sheet.closest(".project-visual");
    if (visual && typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            visual.style.setProperty("--gallery-panel-height", `${sheet.getBoundingClientRect().height}px`);
        });
        observer.observe(sheet);
    }

    function render() {
        const gallery = window.domaGallery;
        if (!gallery) return;
        const { project } = gallery;
        const { activeView, activeRoom, activeImageIndex } = gallery.getState();

        categories.replaceChildren();
        viewButtons.forEach(original => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "gallery-sheet-category";
            button.textContent = original.textContent.trim();
            button.classList.toggle("active", original.dataset.view === activeView);
            button.addEventListener("click", () => gallery.selectView(original.dataset.view));
            categories.appendChild(button);
        });

        items.replaceChildren();
        if (activeView === "interior") {
            const rooms = Object.entries(project.gallery?.interior ?? {}).filter(
                ([, room]) => Array.isArray(room.images) && room.images.length
            );
            rooms.forEach(([roomId, room]) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "gallery-sheet-item";
                button.classList.toggle("active", activeRoom === roomId);
                const img = document.createElement("img");
                img.src = PROJECT_PATH + room.images[0];
                img.alt = room.title;
                img.loading = "lazy";
                const label = document.createElement("span");
                label.textContent = room.title;
                button.append(preview, label);
                button.addEventListener("click", () => gallery.selectRoom(roomId));
                items.appendChild(button);
            });
        } else {
            const images = project.gallery?.[activeView] ?? [];
            const titles = { exterior: "Фасады", plans: "Планировки", surroundings: "Окружение" };
            const button = document.createElement("div");
            button.className = "gallery-sheet-item active";
            const preview = document.createElement("div");
            preview.className = "gallery-sheet-preview";
            if (Array.isArray(images) && images.length) {
                const img = document.createElement("img");
                img.src = PROJECT_PATH + images[0];
                img.alt = titles[activeView] || activeView;
                preview.appendChild(img);
            } else {
                preview.classList.add("is-placeholder");
                preview.textContent = "СКОРО";
            }
            const label = document.createElement("span");
            label.textContent = titles[activeView] || activeView;
            button.append(preview, label);
            items.appendChild(button);
        }

        const images = activeView === "interior"
            ? project.gallery?.interior?.[activeRoom]?.images ?? []
            : project.gallery?.[activeView] ?? [];
        const total = Array.isArray(images) ? images.length : 0;
        if (count) count.textContent = total ? `${activeImageIndex + 1} / ${total}` : "";
        if (dots) {
            dots.replaceChildren();
            // Cap visual dots to avoid overflow with large image sets.
            if (total <= 12) {
                for (let i = 0; i < total; i++) {
                    const dot = document.createElement("span");
                    dot.className = "gallery-progress-dot";
                    dot.classList.toggle("active", i === activeImageIndex);
                    dots.appendChild(dot);
                }
            }
        }
    }

    document.addEventListener("doma:gallery-ready", render);
    document.addEventListener("doma:gallery-change", render);
    if (window.domaGallery) render();

    // Only horizontal swipes over the image area navigate photos.
    let startX = 0, startY = 0, swipeArmed = false;
    visualContainer?.addEventListener("touchstart", event => {
        if (event.touches.length !== 1 || event.target.closest("button, .gallery-sheet, .gallery-landscape-albums")) return;
        if (window.matchMedia("(orientation: landscape) and (max-height: 600px) and (pointer: coarse)").matches && !event.target.closest(".project-visual-image, .project-gallery-placeholder")) return;
        swipeArmed = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    }, { passive: true });
    visualContainer?.addEventListener("touchend", event => {
        if (!swipeArmed || event.changedTouches.length !== 1 || event.target.closest("button, .gallery-sheet, .gallery-landscape-albums")) return;
        swipeArmed = false;
        if (window.matchMedia("(orientation: landscape) and (max-height: 600px) and (pointer: coarse)").matches && !event.target.closest(".project-visual-image, .project-gallery-placeholder")) return;
        const dx = event.changedTouches[0].clientX - startX;
        const dy = event.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            window.domaGallery?.step(dx < 0 ? 1 : -1);
        }
    }, { passive: true });
}

initMobileGallerySheet();


// Unified album strip for touch landscape; source of truth remains project.json.
function initLandscapeAlbums() {
    const sidebar = document.querySelector(".gallery-landscape-albums");
    if (!sidebar) return;
    const list = sidebar.querySelector(".gallery-landscape-list");
    if (!list) return;
    const names = { exterior: "Фасады", plans: "Планировки", surroundings: "Окружение" };

    let signature = "";

    function getAlbums(project) {
        const gallery = project.gallery || {};
        const result = [];
        for (const [view, data] of Object.entries(gallery)) {
            if (view === "interior") {
                for (const [roomId, room] of Object.entries(data || {})) {
                    if (!Array.isArray(room.images) || !room.images.length) continue;
                    result.push({ view, roomId, title: room.title || roomId, image: room.images[0] });
                }
            } else {
                result.push({ view, roomId: null, title: names[view] || view,
                    image: Array.isArray(data) && data.length ? data[0] : null });
            }
        }
        return result;
    }

    function render() {
        const api = window.domaGallery;
        if (!api) return;
        const albums = getAlbums(api.project);
        const nextSignature = albums.map(a => `${a.view}:${a.roomId}:${a.image}`).join("|");
        if (signature !== nextSignature) {
            signature = nextSignature;
            list.replaceChildren();
            albums.forEach(album => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "gallery-landscape-album";
                button.dataset.view = album.view;
                button.dataset.room = album.roomId || "";
                button.setAttribute("aria-label", album.title);
                const preview = document.createElement("div");
                preview.className = "gallery-landscape-preview";
                if (album.image) {
                    const img = document.createElement("img");
                    img.src = PROJECT_PATH + album.image;
                    img.alt = "";
                    img.loading = "lazy";
                    preview.appendChild(img);
                } else {
                    preview.classList.add("is-placeholder");
                    preview.textContent = "СКОРО";
                }
                const label = document.createElement("span");
                label.textContent = album.title;
                button.append(preview, label);
                button.addEventListener("click", () => {
                    if (album.view === "interior") {
                        if (api.getState().activeView !== "interior") api.selectView("interior");
                        api.selectRoom(album.roomId);
                    } else {
                        api.selectView(album.view);
                    }
                });
                list.appendChild(button);
            });
        }
        const { activeView, activeRoom } = api.getState();
        list.querySelectorAll(".gallery-landscape-album").forEach(button => {
            const selected = button.dataset.view === activeView &&
                (activeView !== "interior" || button.dataset.room === activeRoom);
            button.classList.toggle("active", selected);
            button.setAttribute("aria-current", selected ? "true" : "false");
        });
    }
    document.addEventListener("doma:gallery-ready", render);
    document.addEventListener("doma:gallery-change", render);
    if (window.domaGallery) render();
}
initLandscapeAlbums();
