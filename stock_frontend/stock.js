const REFRESH_MS = 60000;

const list = document.getElementById("watchlist");
const form = document.getElementById("add-form");
const input = document.getElementById("ticker-input");
const message = document.getElementById("message");
const updated = document.getElementById("updated");


async function loadWatchlist() {
    const res = await fetch("/api/watchlist");
    const tickers = await res.json();

    if (tickers.length === 0) {
        list.innerHTML = '<li class="empty">Your watchlist is empty. Add a ticker above.</li>';
    } else {
        const rows = await Promise.all(tickers.map(buildRow));
        list.replaceChildren(...rows);
    }

    updated.textContent = "Last updated " + new Date().toLocaleTimeString();
    highlightSelected();
}


async function buildRow(ticker) {
    const res = await fetch(`/api/prices/${ticker}`);
    const prices = await res.json();
    const latest = prices[0];

    const row = document.createElement("li");
    row.className = "stock";
    row.dataset.ticker = ticker;

    let quoteHtml = '<span class="waiting">Waiting for first price…</span>';
    if (latest) {
        const change = latest.current_price - latest.previous_close;
        const percent = (change / latest.previous_close) * 100;
        const direction = change >= 0 ? "up" : "down";
        const sign = change >= 0 ? "+" : "";
        quoteHtml = `
            <span class="price">$${latest.current_price.toFixed(2)}</span>
            <span class="change ${direction}">${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)</span>`;
    }

    row.innerHTML = `
        <span class="ticker">${ticker}</span>
        <span class="quote">${quoteHtml}</span>
        <button class="remove" title="Remove ${ticker}">✕</button>`;

    row.addEventListener("click", () => openDetail(ticker));
    row.querySelector(".remove").addEventListener("click", (event) => {
        event.stopPropagation();
        removeStock(ticker);
    });
    return row;
}


form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ticker = input.value.trim().toUpperCase();
    if (!ticker) return;

    message.textContent = `Adding ${ticker}…`;
    const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker }),
    });
    const data = await res.json();

    if (res.ok) {
        message.textContent = `Added ${ticker}.`;
        input.value = "";
        loadWatchlist();
    } else {
        message.textContent = data.error;
    }
});


async function removeStock(ticker) {
    await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
    message.textContent = `Removed ${ticker}.`;
    if (ticker === selectedTicker) closeDetail();
    loadWatchlist();
}

// Writen with the help of Claude.
// ---------- Detail panel: notes + trades ----------

const detail = document.getElementById("detail");
const detailTicker = document.getElementById("detail-ticker");
const detailMessage = document.getElementById("detail-message");
const notesList = document.getElementById("notes-list");
const tradesList = document.getElementById("trades-list");
const noteForm = document.getElementById("note-form");
const noteInput = document.getElementById("note-input");
const tradeForm = document.getElementById("trade-form");
const entryPrice = document.getElementById("entry-price");
const entryDate = document.getElementById("entry-date");

let selectedTicker = null;


function today() {
    return new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD in local time
}


function openDetail(ticker) {
    selectedTicker = ticker;
    detailTicker.textContent = ticker;
    detailMessage.textContent = "";
    entryDate.value = today();
    detail.hidden = false;
    highlightSelected();
    loadNotes();
    loadTrades();
    detail.scrollIntoView({ behavior: "smooth" });
}


function closeDetail() {
    selectedTicker = null;
    detail.hidden = true;
    highlightSelected();
}


function highlightSelected() {
    for (const row of list.querySelectorAll(".stock")) {
        row.classList.toggle("selected", row.dataset.ticker === selectedTicker);
    }
}


document.getElementById("detail-close").addEventListener("click", closeDetail);


// ----- notes -----

async function loadNotes() {
    const res = await fetch(`/api/notes/${selectedTicker}`);
    const notes = await res.json();
    notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    notesList.replaceChildren();
    if (notes.length === 0) {
        notesList.innerHTML = '<li class="empty">No notes yet.</li>';
        return;
    }

    for (const note of notes) {
        const li = document.createElement("li");
        li.className = "note";

        const text = document.createElement("p");
        text.textContent = note.personal_notes;

        const meta = document.createElement("span");
        meta.className = "meta";
        meta.textContent = note.created_at ? new Date(note.created_at).toLocaleString() : "";

        const del = document.createElement("button");
        del.className = "remove";
        del.title = "Delete note";
        del.textContent = "✕";
        del.addEventListener("click", () => deleteNote(note.id));

        li.append(text, meta, del);
        notesList.appendChild(li);
    }
}


noteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = noteInput.value.trim();
    if (!text) return;

    const res = await fetch(`/api/notes/${selectedTicker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
    });

    if (res.ok) {
        noteInput.value = "";
        detailMessage.textContent = "Note added.";
        loadNotes();
    } else {
        const data = await res.json();
        detailMessage.textContent = data.error;
    }
});


async function deleteNote(noteId) {
    await fetch(`/api/notes/${selectedTicker}/${noteId}`, { method: "DELETE" });
    detailMessage.textContent = "Note deleted.";
    loadNotes();
}


// ----- trades -----

async function loadTrades() {
    const res = await fetch(`/api/trades/${selectedTicker}`);
    const trades = await res.json();
    trades.sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""));

    tradesList.replaceChildren();
    if (trades.length === 0) {
        tradesList.innerHTML = '<li class="empty">No trades yet.</li>';
        return;
    }

    for (const trade of trades) {
        tradesList.appendChild(buildTradeRow(trade));
    }
}


function buildTradeRow(trade) {
    const li = document.createElement("li");
    li.className = "trade";

    const entry = document.createElement("span");
    entry.textContent = `Entry $${trade.entry_price.toFixed(2)} on ${trade.entry_date || "?"}`;
    li.appendChild(entry);

    if (trade.exit_price != null) {
        const profit = trade.exit_price - trade.entry_price;
        const percent = (profit / trade.entry_price) * 100;
        const sign = profit >= 0 ? "+" : "";

        const result = document.createElement("span");
        result.className = "change " + (profit >= 0 ? "up" : "down");
        result.textContent = `Exit $${trade.exit_price.toFixed(2)} on ${trade.exit_date || "?"} · ` +
            `${sign}${profit.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
        li.appendChild(result);
    } else {
        const form = document.createElement("form");
        form.className = "inline-form";
        form.innerHTML = `
            <input type="number" step="0.01" min="0" placeholder="Exit price" required>
            <input type="date" required>
            <button type="submit">Close trade</button>`;
        const [priceInput, dateInput] = form.querySelectorAll("input");
        dateInput.value = today();

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            closeTrade(trade.id, priceInput.value, dateInput.value);
        });
        li.appendChild(form);
    }

    return li;
}


tradeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const res = await fetch(`/api/trades/${selectedTicker}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_price: entryPrice.value, entry_date: entryDate.value }),
    });

    if (res.ok) {
        entryPrice.value = "";
        detailMessage.textContent = "Trade added.";
        loadTrades();
    } else {
        const data = await res.json();
        detailMessage.textContent = data.error;
    }
});


async function closeTrade(tradeId, exitPrice, exitDate) {
    const res = await fetch(`/api/trades/${selectedTicker}/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exit_price: exitPrice, exit_date: exitDate }),
    });

    if (res.ok) {
        detailMessage.textContent = "Trade closed.";
        loadTrades();
    } else {
        const data = await res.json();
        detailMessage.textContent = data.error;
    }
}


loadWatchlist();
setInterval(loadWatchlist, REFRESH_MS);
