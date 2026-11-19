
const PROJECT_PATH = "./projects/barn80/";

const mainImage = document.querySelector(".project-visual-image");
const placeholder = document.querySelector(".project-gallery-placeholder");
const thumbnailsContainer = document.querySelector(".project-thumbnails");
const viewButtons = document.querySelectorAll(".project-visual-menu button");

async function initHouseGallery() {
    if (!mainImage || !thumbnailsContainer || !viewButtons.length) {
        return;
    }

    try {
        const response = await fetch(PROJECT_PATH + "project.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const project = await response.json();

        function showGallery(view) {
            const images = project.gallery?.[view] ?? [];

            thumbnailsContainer.replaceChildren();

            if (images.length === 0) {
                mainImage.style.display = "none";
                placeholder.hidden = false;
                thumbnailsContainer.style.display = "none";
                return;
            }

            mainImage.style.display = "";
            placeholder.hidden = true;
            thumbnailsContainer.style.display = "";


            mainImage.style.display = "";

            images.forEach((imagePath, index) => {
                const imageUrl = PROJECT_PATH + imagePath;

                const button = document.createElement("button");
                button.type = "button";
                button.className = "project-thumbnail";

                const image = document.createElement("img");
                image.src = imageUrl;
                image.alt = `${project.name} — вид ${index + 1}`;

                button.appendChild(image);
                thumbnailsContainer.appendChild(button);

                button.addEventListener("click", () => {
                    mainImage.src = imageUrl;
                    mainImage.alt = image.alt;

                    thumbnailsContainer
                        .querySelectorAll(".project-thumbnail")
                        .forEach((item) => {
                            item.classList.remove("active");
                        });

                    button.classList.add("active");
                });

                if (index === 0) {
                    button.click();
                }
            });
        }

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

initHouseGallery();
