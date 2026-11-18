const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");

if (menuButton && mainNav) {
    menuButton.addEventListener("click", () => {
        const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
        menuButton.setAttribute("aria-expanded", String(!isExpanded));
        menuButton.setAttribute("aria-label", isExpanded ? "Открыть меню" : "Закрыть меню");
        mainNav.classList.toggle("is-open", !isExpanded);
    });

    mainNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            menuButton.setAttribute("aria-expanded", "false");
            menuButton.setAttribute("aria-label", "Открыть меню");
            mainNav.classList.remove("is-open");
        }
    });
}

const searchOverlay = document.createElement("div");
searchOverlay.className = "search-overlay";
searchOverlay.hidden = true;
searchOverlay.innerHTML = `
    <section class="search-panel" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <header class="search-header">
            <h2 id="search-title">Поиск товаров</h2>
            <button class="cart-close search-close" type="button" aria-label="Закрыть поиск">×</button>
        </header>
        <label class="search-label" for="product-search-input">Название или модель</label>
        <input class="search-input" id="product-search-input" type="search" autocomplete="off" placeholder="Например, iPhone или наушники">
        <p class="search-status" role="status" aria-live="polite">Загружаем каталог…</p>
        <div class="search-results"></div>
    </section>
`;
document.body.append(searchOverlay);

const searchInput = searchOverlay.querySelector(".search-input");
const searchStatus = searchOverlay.querySelector(".search-status");
const searchResults = searchOverlay.querySelector(".search-results");
const searchPages = ["smartphones.html", "deals.html", "accessories.html", "index.html"];
let searchProducts = null;
let searchCatalogPromise = null;
let searchLoadErrors = 0;
let lastSearchFocusedElement = null;

document.querySelectorAll(".product-card").forEach((card) => {
    const addButton = card.querySelector(".add-to-cart");
    if (addButton && addButton.dataset.productId) {
        card.id = `product-${addButton.dataset.productId}`;
    }
});

function getCurrentPageName() {
    const path = window.location.pathname;
    return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

function collectSearchProducts(pageDocument, page) {
    return Array.from(pageDocument.querySelectorAll(".product-card")).reduce((products, card) => {
        const addButton = card.querySelector(".add-to-cart");
        const id = addButton && addButton.dataset.productId;
        const name = addButton && addButton.dataset.productName;
        const price = Number(addButton && addButton.dataset.price);
        if (!id || !name || !Number.isSafeInteger(price) || price <= 0) {
            console.error("Не удалось добавить товар в поиск: неверные данные товара.", card);
            return products;
        }

        if (pageDocument === document) {
            card.id = `product-${id}`;
        }
        const description = card.querySelector(".product-info > p");
        products.push({
            id,
            name,
            description: description ? description.textContent.trim() : "",
            price,
            href: `${page}#product-${encodeURIComponent(id)}`
        });
        return products;
    }, []);
}

async function loadSearchProducts() {
    const currentPage = getCurrentPageName();
    const sources = [{ page: currentPage, pageDocument: document }];
    const pagesToLoad = searchPages.filter((page) => page !== currentPage);
    const loadedPages = await Promise.all(pagesToLoad.map(async (page) => {
        try {
            const response = await fetch(page);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const pageDocument = new DOMParser().parseFromString(await response.text(), "text/html");
            return { page, pageDocument };
        } catch (error) {
            searchLoadErrors += 1;
            console.error(`Не удалось загрузить товары для поиска из ${page}.`, error);
            return null;
        }
    }));

    sources.push(...loadedPages.filter(Boolean));
    const productsById = new Map();
    for (const source of sources) {
        for (const product of collectSearchProducts(source.pageDocument, source.page)) {
            if (!productsById.has(product.id)) {
                productsById.set(product.id, product);
            }
        }
    }
    return Array.from(productsById.values());
}

function renderSearchResults() {
    searchResults.replaceChildren();
    if (!searchProducts) {
        searchStatus.textContent = "Загружаем каталог…";
        return;
    }

    if (searchLoadErrors > 0) {
        const warning = document.createElement("small");
        warning.className = "search-warning";
        warning.textContent = "Не удалось загрузить часть каталога.";
        searchResults.append(warning);
    }

    const query = searchInput.value.trim().toLocaleLowerCase("ru-RU");
    if (!query) {
        searchStatus.textContent = "Введите название товара или модели.";
        return;
    }

    const terms = query.split(/\s+/);
    const matches = searchProducts.filter((product) => {
        const searchableText = `${product.name} ${product.description} ${product.price}`.toLocaleLowerCase("ru-RU");
        return terms.every((term) => searchableText.includes(term));
    });

    if (matches.length === 0) {
        searchStatus.textContent = "Ничего не найдено.";
        return;
    }

    searchStatus.textContent = `Найдено товаров: ${matches.length}`;
    for (const product of matches) {
        const link = document.createElement("a");
        link.className = "search-result";
        link.href = product.href;

        const details = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = product.name;
        const description = document.createElement("small");
        description.textContent = product.description;
        details.append(name, description);

        const price = document.createElement("strong");
        price.className = "search-result-price";
        price.textContent = formatSom(product.price);
        link.append(details, price);
        searchResults.append(link);
    }
}

function openSearch() {
    lastSearchFocusedElement = document.activeElement;
    searchOverlay.hidden = false;
    document.body.classList.add("search-open");
    searchInput.focus();

    if (!searchCatalogPromise) {
        searchCatalogPromise = loadSearchProducts().then((products) => {
            searchProducts = products;
            renderSearchResults();
        });
    }
    renderSearchResults();
}

function closeSearch() {
    searchOverlay.hidden = true;
    document.body.classList.remove("search-open");
    if (lastSearchFocusedElement instanceof HTMLElement) {
        lastSearchFocusedElement.focus();
    }
}

document.querySelectorAll(".search-button").forEach((button) => {
    button.addEventListener("click", openSearch);
});
searchInput.addEventListener("input", renderSearchResults);
searchOverlay.querySelector(".search-close").addEventListener("click", closeSearch);
searchOverlay.addEventListener("click", (event) => {
    if (event.target === searchOverlay) {
        closeSearch();
    }
});

const cartKey = "mobile-cart";
const cartOverlay = document.createElement("div");
cartOverlay.className = "cart-overlay";
cartOverlay.hidden = true;
cartOverlay.innerHTML = `
    <section class="cart-panel" role="dialog" aria-modal="true" aria-label="Корзина">
        <header class="cart-header">
            <div>
                <h2>Корзина</h2>
                <p class="cart-count-label">Пока пусто</p>
            </div>
            <button class="cart-close" type="button" aria-label="Закрыть корзину">×</button>
        </header>
        <div class="cart-items"></div>
        <div class="cart-empty">
            <strong>В корзине пока пусто</strong>
            <span>Добавьте понравившиеся товары из каталога.</span>
        </div>
        <footer class="cart-footer" hidden>
            <div class="cart-total-row"><span>Итого</span><strong class="cart-total"></strong></div>
            <p class="cart-note">Корзина сохранится на этом устройстве.</p>
            <button class="cart-clear" type="button">Очистить корзину</button>
            <button class="cart-continue" type="button">Продолжить покупки</button>
        </footer>
    </section>
`;
document.body.append(cartOverlay);

const cartToast = document.createElement("div");
cartToast.className = "cart-toast";
cartToast.setAttribute("role", "status");
cartToast.hidden = true;
cartToast.textContent = "Товар добавлен в корзину";
document.body.append(cartToast);

const cartItemsElement = cartOverlay.querySelector(".cart-items");
const cartEmptyElement = cartOverlay.querySelector(".cart-empty");
const cartFooterElement = cartOverlay.querySelector(".cart-footer");
const cartCountLabel = cartOverlay.querySelector(".cart-count-label");
const cartTotalElement = cartOverlay.querySelector(".cart-total");
const currencyFormatter = new Intl.NumberFormat("ru-RU");
let cart = [];
let lastFocusedElement = null;
let toastTimeout;

const storedCart = localStorage.getItem(cartKey);
if (storedCart) {
    try {
        const parsedCart = JSON.parse(storedCart);
        if (Array.isArray(parsedCart)) {
            cart = parsedCart.filter((item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                Number.isSafeInteger(item.price) &&
                item.price > 0 &&
                Number.isSafeInteger(item.quantity) &&
                item.quantity > 0
            );
            if (cart.length !== parsedCart.length) {
                console.error("Некорректные товары в сохранённой корзине были пропущены.");
            }
        } else {
            console.error("Сохранённая корзина имеет неверный формат.");
        }
    } catch (error) {
        console.error("Не удалось прочитать сохранённую корзину.", error);
    }
}

function formatSom(amount) {
    return `${currencyFormatter.format(amount)} сом`;
}

function getItemWord(amount) {
    const lastTwoDigits = amount % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return "товаров";
    }
    if (amount % 10 === 1) {
        return "товар";
    }
    if (amount % 10 >= 2 && amount % 10 <= 4) {
        return "товара";
    }
    return "товаров";
}

function saveCart() {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    renderCart();
}

function renderCart() {
    const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.querySelectorAll(".bag-count").forEach((badge) => {
        badge.textContent = String(itemCount);
    });
    document.querySelectorAll(".bag-button").forEach((button) => {
        button.setAttribute("aria-label", `Корзина, товаров: ${itemCount}`);
    });
    cartCountLabel.textContent = itemCount ? `${itemCount} ${getItemWord(itemCount)}` : "Пока пусто";
    cartItemsElement.replaceChildren();
    cartEmptyElement.hidden = cart.length > 0;
    cartFooterElement.hidden = cart.length === 0;

    for (const item of cart) {
        const row = document.createElement("article");
        row.className = "cart-item";

        const details = document.createElement("div");
        const name = document.createElement("h3");
        name.textContent = item.name;
        const price = document.createElement("div");
        price.className = "cart-item-price";
        price.textContent = `${formatSom(item.price)} за шт.`;
        const controls = document.createElement("div");
        controls.className = "cart-item-controls";
        controls.append(
            createCartAction("−", "decrease", item.id, `Уменьшить количество: ${item.name}`),
            createQuantityLabel(item.quantity),
            createCartAction("+", "increase", item.id, `Увеличить количество: ${item.name}`)
        );
        details.append(name, price, controls);
        row.append(details, createCartAction("×", "remove", item.id, `Удалить ${item.name}`, "cart-remove"));
        cartItemsElement.append(row);
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartTotalElement.textContent = formatSom(total);
}

function createCartAction(label, action, id, ariaLabel, className = "cart-quantity-button") {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.dataset.cartAction = action;
    button.dataset.productId = id;
    button.setAttribute("aria-label", ariaLabel);
    button.textContent = label;
    return button;
}

function createQuantityLabel(quantity) {
    const label = document.createElement("span");
    label.className = "cart-quantity";
    label.textContent = String(quantity);
    return label;
}

function openCart() {
    lastFocusedElement = document.activeElement;
    renderCart();
    cartOverlay.hidden = false;
    document.body.classList.add("cart-open");
    cartOverlay.querySelector(".cart-close").focus();
}

function closeCart() {
    cartOverlay.hidden = true;
    document.body.classList.remove("cart-open");
    if (lastFocusedElement instanceof HTMLElement) {
        lastFocusedElement.focus();
    }
}

function showCartToast() {
    cartToast.hidden = false;
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
        cartToast.hidden = true;
    }, 1800);
}

document.querySelectorAll(".bag-button").forEach((button) => {
    button.addEventListener("click", openCart);
});

document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
        return;
    }

    const addButton = event.target.closest(".add-to-cart");
    if (addButton) {
        const id = addButton.dataset.productId;
        const name = addButton.dataset.productName;
        const price = Number(addButton.dataset.price);
        if (!id || !name || !Number.isSafeInteger(price) || price <= 0) {
            console.error("Не удалось добавить товар: неверные данные товара.", addButton);
            return;
        }

        const existingItem = cart.find((item) => item.id === id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id, name, price, quantity: 1 });
        }
        saveCart();
        showCartToast();
        return;
    }

    if (event.target === cartOverlay || event.target.closest(".cart-close, .cart-continue")) {
        closeCart();
        return;
    }

    const actionButton = event.target.closest("[data-cart-action]");
    if (!actionButton) {
        return;
    }

    const item = cart.find((cartItem) => cartItem.id === actionButton.dataset.productId);
    if (!item) {
        return;
    }

    switch (actionButton.dataset.cartAction) {
        case "increase":
            item.quantity += 1;
            break;
        case "decrease":
            item.quantity -= 1;
            if (item.quantity <= 0) {
                cart = cart.filter((cartItem) => cartItem.id !== item.id);
            }
            break;
        case "remove":
            cart = cart.filter((cartItem) => cartItem.id !== item.id);
            break;
        default:
            console.error("Неизвестное действие корзины.", actionButton.dataset.cartAction);
            return;
    }
    saveCart();
});

cartOverlay.querySelector(".cart-clear").addEventListener("click", () => {
    cart = [];
    saveCart();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !searchOverlay.hidden) {
        closeSearch();
        return;
    }
    if (event.key === "Escape" && !cartOverlay.hidden) {
        closeCart();
    }
});

renderCart();
