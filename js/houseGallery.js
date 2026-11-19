
const PROJECT_PATH = "./projects/barn80/";

const mainImage = document.querySelector(".project-visual-image");
const placeholder = document.querySelector(".project-gallery-placeholder");
const thumbnailsContainer = document.querySelector(".project-thumbnails");
const viewButtons = document.querySelectorAll(".project-visual-menu button");

const visualContainer = document.querySelector(".project-visual");
const fullscreenButton = document.querySelector(".project-fullscreen");

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
        mainImage.style.objectFit = objectFit;
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
        }

        // Уровень 2: рендеры выбранной комнаты
        function showRoomGallery(roomId) {
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
