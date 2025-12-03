// === Storage keys ===
const STORAGE_KEY_BOOKS = "readingTrackerBooks";
const STORAGE_KEY_SETTINGS = "readingTrackerSettings";

let books = [];
let settings = {
    theme: "light",
    yearlyGoal: null,
};

// Filter state
let searchTerm = "";
let tagFilter = "";

// DOM references
const form = document.getElementById("book-form");
const titleInput = document.getElementById("book-title");
const authorInput = document.getElementById("book-author");
const totalPagesInput = document.getElementById("book-pages-total");
const pagesReadInput = document.getElementById("book-pages-read");
const statusSelect = document.getElementById("book-status");
const tagsInput = document.getElementById("book-tags");
const coverInput = document.getElementById("book-cover");

const shelfWant = document.getElementById("shelf-want");
const shelfReading = document.getElementById("shelf-reading");
const shelfDone = document.getElementById("shelf-done");

const searchInput = document.getElementById("search-input");
const tagFilterInput = document.getElementById("tag-filter-input");

const themeButtons = document.querySelectorAll(".theme-btn");

// Goal DOM
const goalYearEl = document.getElementById("goal-year");
const goalProgressEl = document.getElementById("goal-progress");
const goalForm = document.getElementById("goal-form");
const goalInput = document.getElementById("goal-input");

// === Helper: basic sanitization ===
function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// === Storage ===
function loadBooks() {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKS);
    if (!raw) {
        books = [];
        return;
    }
    try {
        const parsed = JSON.parse(raw) || [];
        // ensure new fields exist
        books = parsed.map((b) => ({
            id: b.id ?? Date.now().toString(),
            title: b.title ?? "",
            author: b.author ?? "",
            totalPages: Number(b.totalPages ?? 0),
            pagesRead: Number(b.pagesRead ?? 0),
            status: b.status ?? "want",
            tags: b.tags ?? [],
            rating: b.rating ?? 0,
            cover: b.cover ?? null, // data URL or null
            createdAt: b.createdAt ?? new Date().toISOString(),
        }));
    } catch (e) {
        console.error("Error parsing stored books:", e);
        books = [];
    }
}

function saveBooks() {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
}

function loadSettings() {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) {
        return;
    }
    try {
        const parsed = JSON.parse(raw) || {};
        settings = {
            theme: parsed.theme || "light",
            yearlyGoal:
                typeof parsed.yearlyGoal === "number" ? parsed.yearlyGoal : null,
        };
    } catch (e) {
        console.error("Error parsing settings:", e);
    }
}

function saveSettings() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

// === Theme ===
function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    settings.theme = theme;
    saveSettings();

    themeButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.theme === theme);
    });
}

// === Filters ===
function setSearchTerm(value) {
    searchTerm = value.trim().toLowerCase();
    renderShelves();
}

function setTagFilter(value) {
    tagFilter = value.trim().toLowerCase();
    renderShelves();
}

function bookMatchesFilters(book) {
    const title = (book.title || "").toLowerCase();
    const author = (book.author || "").toLowerCase();
    const tags = (book.tags || []).map((t) => String(t).toLowerCase());

    let matchesSearch = true;
    if (searchTerm) {
        matchesSearch =
            title.includes(searchTerm) || author.includes(searchTerm);
    }

    let matchesTag = true;
    if (tagFilter) {
        matchesTag = tags.some((t) => t.includes(tagFilter));
    }

    return matchesSearch && matchesTag;
}

// === Goal / yearly stats ===
function getCurrentYear() {
    return new Date().getFullYear();
}

function updateGoalUI() {
    const year = getCurrentYear();
    goalYearEl.textContent = year;

    const doneThisYear = books.filter((b) => {
        if (b.status !== "done") return false;
        if (!b.createdAt) return true; // fallback
        const d = new Date(b.createdAt);
        return d.getFullYear() === year;
    }).length;

    if (settings.yearlyGoal && settings.yearlyGoal > 0) {
        goalProgressEl.textContent = `${doneThisYear} / ${settings.yearlyGoal} books finished`;
        goalInput.value = settings.yearlyGoal;
    } else {
        goalProgressEl.textContent = `${doneThisYear} books finished`;
    }
}

// === Rendering ===
function renderShelves() {
    // Clear
    shelfWant.innerHTML = "";
    shelfReading.innerHTML = "";
    shelfDone.innerHTML = "";

    const filtered = books.filter(bookMatchesFilters);

    function appendEmptyIfNeeded(el, msg) {
        if (!el.hasChildNodes()) {
            el.innerHTML = `<p class="empty-msg">${msg}</p>`;
        }
    }

    if (filtered.length === 0) {
        shelfWant.innerHTML =
            `<p class="empty-msg">No matching books. Try changing search or filters ✨</p>`;
        shelfReading.innerHTML = "";
        shelfDone.innerHTML = "";
        updateGoalUI();
        return;
    }

    filtered.forEach((book) => {
        const card = createBookCard(book);
        if (book.status === "want") shelfWant.appendChild(card);
        else if (book.status === "reading") shelfReading.appendChild(card);
        else if (book.status === "done") shelfDone.appendChild(card);
    });

    appendEmptyIfNeeded(
        shelfWant,
        "Nothing here yet. Add a “Want to read” book!"
    );
    appendEmptyIfNeeded(
        shelfReading,
        "No current reads. Move one here to start 📖"
    );
    appendEmptyIfNeeded(
        shelfDone,
        "Finish a book to see it here ✅"
    );

    updateGoalUI();
}

function createBookCard(book) {
    const card = document.createElement("article");
    card.className = "book-card";
    card.draggable = true;
    card.dataset.id = book.id;

    const percent = Math.min(
        100,
        book.totalPages ? Math.round((book.pagesRead / book.totalPages) * 100) : 0
    );

    // tags display
    const tagsHtml =
        book.tags && book.tags.length
            ? `<div class="book-tags">
          ${book.tags
                .map(
                    (t) =>
                        `<span class="tag-pill">${escapeHtml(String(t))}</span>`
                )
                .join("")}
        </div>`
            : "";

    // rating stars
    let starsHtml = "";
    const rating = book.rating || 0;
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating ? "filled" : "";
        starsHtml += `<button type="button" class="star-btn" data-rating="${i}" aria-label="Rate ${i} star"><span class="star ${filled}">★</span></button>`;
    }

    const coverStyle = book.cover
        ? `style="background-image:url('${book.cover}');"`
        : "";

    card.innerHTML = `
    <div class="book-cover" ${coverStyle}></div>
    <div class="book-content">
      <div class="book-main">
        <div class="book-text">
          <div class="book-title">${escapeHtml(book.title)}</div>
          <div class="book-author">by ${escapeHtml(book.author)}</div>
          <div class="book-meta">
            ${book.pagesRead}/${book.totalPages} pages · ${percent}%
          </div>
          ${tagsHtml}
        </div>
        <div class="rating" data-id="${book.id}">
          ${starsHtml}
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-label">
          <span>Progress</span>
          <span>${percent}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percent}%;"></div>
        </div>
      </div>

      <div class="book-actions">
        <select class="status-select" data-id="${book.id}">
          <option value="want" ${book.status === "want" ? "selected" : ""}>Want</option>
          <option value="reading" ${book.status === "reading" ? "selected" : ""}>Reading</option>
          <option value="done" ${book.status === "done" ? "selected" : ""}>Done</option>
        </select>
        <div class="btn-group">
          <button class="btn small ghost" data-action="update-pages" data-id="${book.id}">
            +10 pages
          </button>
          <button class="btn small ghost" data-action="finish-book" data-id="${book.id}">
            Mark finished
          </button>
          <button class="btn small danger" data-action="delete-book" data-id="${book.id}">
            Remove
          </button>
        </div>
      </div>
    </div>
  `;

    // Drag events for card
    card.addEventListener("dragstart", (e) => {
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", book.id);
    });
    card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
    });

    // Status dropdown
    const statusDropdown = card.querySelector(".status-select");
    statusDropdown.addEventListener("change", (e) => {
        updateBookStatus(book.id, e.target.value);
    });

    // Buttons
    const buttons = card.querySelectorAll("button[data-action]");
    buttons.forEach((btn) => {
        const action = btn.dataset.action;
        const id = book.id;
        if (action === "delete-book") {
            btn.addEventListener("click", () => deleteBook(id));
        } else if (action === "finish-book") {
            btn.addEventListener("click", () => finishBook(id));
        } else if (action === "update-pages") {
            btn.addEventListener("click", () => addPages(id, 10));
        }
    });

    // Rating click handlers
    const ratingEl = card.querySelector(".rating");
    ratingEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".star-btn");
        if (!btn) return;
        const newRating = Number(btn.dataset.rating);
        setBookRating(book.id, newRating);
    });

    return card;
}

// === CRUD ===
function addBook(e) {
    e.preventDefault();

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const totalPages = Number(totalPagesInput.value);
    let pagesRead = Number(pagesReadInput.value);
    const status = statusSelect.value;
    const tagsRaw = tagsInput.value;

    if (!title || !author || !totalPages) return;
    if (totalPages < 1) return;

    if (Number.isNaN(pagesRead) || pagesRead < 0) pagesRead = 0;
    if (pagesRead > totalPages) pagesRead = totalPages;

    const tags =
        tagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0) || [];

    const newBookBase = {
        id: Date.now().toString(),
        title,
        author,
        totalPages,
        pagesRead,
        status,
        tags,
        rating: 0,
        cover: null,
        createdAt: new Date().toISOString(),
    };

    // If a cover file was selected, read it as Data URL then save book
    const file = coverInput.files && coverInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const coverDataUrl = event.target?.result;
            const newBook = { ...newBookBase, cover: coverDataUrl };
            books.push(newBook);
            saveBooks();
            renderShelves();
            form.reset();
            pagesReadInput.value = 0;
        };
        reader.readAsDataURL(file);
    } else {
        books.push(newBookBase);
        saveBooks();
        renderShelves();
        form.reset();
        pagesReadInput.value = 0;
    }
}

function deleteBook(id) {
    books = books.filter((b) => b.id !== id);
    saveBooks();
    renderShelves();
}

function finishBook(id) {
    books = books.map((b) =>
        b.id === id ? { ...b, pagesRead: b.totalPages, status: "done" } : b
    );
    saveBooks();
    renderShelves();
}

function addPages(id, amount) {
    books = books.map((b) => {
        if (b.id !== id) return b;
        const newPages = Math.min(b.totalPages, b.pagesRead + amount);
        const newStatus = newPages === b.totalPages ? "done" : b.status;
        return { ...b, pagesRead: newPages, status: newStatus };
    });
    saveBooks();
    renderShelves();
}

function updateBookStatus(id, status) {
    books = books.map((b) => (b.id === id ? { ...b, status } : b));
    saveBooks();
    renderShelves();
}

function setBookRating(id, rating) {
    books = books.map((b) => (b.id === id ? { ...b, rating } : b));
    saveBooks();
    renderShelves();
}

// === Drag & drop shelves ===
function setupShelfDragAndDrop() {
    const shelfLists = document.querySelectorAll(".shelf-list");

    shelfLists.forEach((listEl) => {
        listEl.addEventListener("dragover", (e) => {
            e.preventDefault();
            listEl.classList.add("drag-over");
        });

        listEl.addEventListener("dragleave", () => {
            listEl.classList.remove("drag-over");
        });

        listEl.addEventListener("drop", (e) => {
            e.preventDefault();
            listEl.classList.remove("drag-over");
            const bookId = e.dataTransfer.getData("text/plain");
            if (!bookId) return;

            const status = listEl.parentElement.getAttribute("data-status");
            if (!status) return;

            updateBookStatus(bookId, status);
        });
    });
}

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    applyTheme(settings.theme || "light");

    loadBooks();
    renderShelves();
    setupShelfDragAndDrop();

    // Form submit
    form.addEventListener("submit", addBook);

    // Search / filter
    searchInput.addEventListener("input", (e) =>
        setSearchTerm(e.target.value)
    );
    tagFilterInput.addEventListener("input", (e) =>
        setTagFilter(e.target.value)
    );

    // Theme buttons
    themeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            applyTheme(btn.dataset.theme);
        });
    });

    // Goal
    goalForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const value = Number(goalInput.value);
        if (!value || value < 1) {
            settings.yearlyGoal = null;
        } else {
            settings.yearlyGoal = value;
        }
        saveSettings();
        updateGoalUI();
    });

    updateGoalUI();
});
