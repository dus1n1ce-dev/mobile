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
    if (event.key === "Escape" && !cartOverlay.hidden) {
        closeCart();
    }
});

renderCart();
