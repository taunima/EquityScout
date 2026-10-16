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
}


async function buildRow(ticker) {
    const res = await fetch(`/api/prices/${ticker}`);
    const prices = await res.json();
    const latest = prices[0];

    const row = document.createElement("li");
    row.className = "stock";

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

    row.querySelector(".remove").addEventListener("click", () => removeStock(ticker));
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
    loadWatchlist();
}


loadWatchlist();
setInterval(loadWatchlist, REFRESH_MS);