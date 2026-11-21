import { createObject360 } from "./viewers/object360.js";


const PROJECT_PATH = "./projects/barn80/";

const mainImage = document.querySelector(".project-visual-image");
const placeholder = document.querySelector(".project-gallery-placeholder");
const thumbnailsContainer = document.querySelector(".project-thumbnails");
const viewButtons = document.querySelectorAll(".project-visual-menu button");

const visualContainer = document.querySelector(".project-visual");
const fullscreenButton = document.querySelector(".project-fullscreen");
const object360Button = document.querySelector(".project-object360-toggle");
const object360Host = document.querySelector(".doma-object360-host");
let object360Instance = null;

function stopObject360() {
    if (!object360Instance) return;
    object360Instance.destroy();
    object360Instance = null;
    object360Host.hidden = true;
    visualContainer.classList.remove("is-object360");
    object360Button.setAttribute("aria-pressed", "false");
    object360Button.setAttribute("aria-label", "Включить облёт 360°");
}


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
        object360Button?.addEventListener("click", () => {
            if (object360Instance) { stopObject360(); return; }
            const config = project.object360?.house;
            if (!config) { console.warn("Object360: конфигурация house отсутствует"); return; }
            try {
                object360Host.hidden = false;
                visualContainer.classList.add("is-object360");
                object360Instance = createObject360(object360Host, config, PROJECT_PATH);
                object360Button.setAttribute("aria-pressed", "true");
                object360Button.setAttribute("aria-label", "Вернуться к галерее");
            } catch (error) { stopObject360(); console.error(error); }
        });

        let activeView = "exterior";
        let activeRoom = null;
        let activeImageIndex = 0;

        // Отображение основного изображения


let imageRequestId = 0;

function showImage(imagePath, alt) {
    const requestId = ++imageRequestId;
    const imageUrl = PROJECT_PATH + imagePath;

    const preloadImage = new Image();

    preloadImage.onload = () => {
        // Если пользователь уже выбрал другой кадр,
        // результат предыдущей загрузки игнорируем.
        if (requestId !== imageRequestId) return;

        const aspectRatio =
            preloadImage.naturalWidth / preloadImage.naturalHeight;

        const objectFit =
            aspectRatio >= 1.5 ? "cover" : "contain";

        // Сначала устанавливаем режим отображения,
        // затем подменяем изображение.
        mainImage.style.objectFit = window.matchMedia("(max-width: 700px)").matches
            ? "cover"
            : objectFit;
        // Per-image mobile framing can be configured later without new renders.
        mainImage.style.objectPosition = "50% 50%";
        mainImage.src = imageUrl;
        mainImage.alt = alt;
        mainImage.style.display = "";

        placeholder.hidden = true;
        thumbnailsContainer.style.display = "";
    };

    preloadImage.onerror = () => {
        if (requestId !== imageRequestId) return;

        console.error("Не удалось загрузить изображение:", imageUrl);
    };

    preloadImage.src = imageUrl;
}



        // Пустая категория
        function showPlaceholder() {
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
                const buttons = thumbnailsContainer.querySelectorAll(
                    ".project-thumbnail:not(.project-thumbnail-back)"
                );
                buttons[next]?.click();
            }
        };
        document.dispatchEvent(new Event("doma:gallery-ready"));

        // Стрелки в полноэкранном режиме
        document.addEventListener("keydown", (event) => {
            if (document.fullscreenElement !== visualContainer) {
                return;
            }

            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
            }

            let images = [];

            if (activeView === "interior") {
                if (!activeRoom) {
                    return;
                }

                images =
                    project.gallery?.interior?.[activeRoom]?.images ?? [];
            } else {
                images = project.gallery?.[activeView] ?? [];
            }

            if (!Array.isArray(images) || images.length < 2) {
                return;
            }

            const direction = event.key === "ArrowRight" ? 1 : -1;

            activeImageIndex =
                (activeImageIndex + direction + images.length) %
                images.length;

            const thumbnails = thumbnailsContainer.querySelectorAll(
                ".project-thumbnail:not(.project-thumbnail-back)"
            );

            thumbnails[activeImageIndex]?.click();

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
        if (!window.matchMedia("(max-width: 700px)").matches) return;
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
                button.append(img, label);
                button.addEventListener("click", () => gallery.selectRoom(roomId));
                items.appendChild(button);
            });
        } else {
            const images = project.gallery?.[activeView] ?? [];
            if (!Array.isArray(images) || !images.length) {
                const empty = document.createElement("p");
                empty.className = "gallery-sheet-empty";
                empty.textContent = "Материалы готовятся";
                items.appendChild(empty);
            }
            if (Array.isArray(images) && images.length) {
                const hint = document.createElement("p");
                hint.className = "gallery-sheet-empty";
                hint.textContent = "Листайте изображения свайпом влево или вправо";
                items.appendChild(hint);
            }
            // For exterior, swipes replace thumbnails; no second thumbnail strip.
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
    let startX = 0, startY = 0;
    visualContainer?.addEventListener("touchstart", event => {
        if (event.touches.length !== 1 || event.target.closest("button, .gallery-sheet")) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    }, { passive: true });
    visualContainer?.addEventListener("touchend", event => {
        if (event.changedTouches.length !== 1 || event.target.closest("button, .gallery-sheet")) return;
        const dx = event.changedTouches[0].clientX - startX;
        const dy = event.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            window.domaGallery?.step(dx < 0 ? 1 : -1);
        }
    }, { passive: true });
}

initMobileGallerySheet();
