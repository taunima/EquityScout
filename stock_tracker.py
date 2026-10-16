import os
import threading
import time
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from google.api_core.exceptions import NotFound

from stock_db import firebase_db as db

load_dotenv()

FINNHUB_KEY = os.getenv("API_KEY")
POLL_SECONDS = 60

app = Flask(__name__, static_folder="stock_frontend")

def fetch_quote(ticker):
    """Return Finnhub's quote dict for one ticker, e.g.
    {"c": 227.5, "h": 229.1, "l": 225.0, "o": 226.0, "pc": 225.9, "t": 1728480000}
    Returns None if the request fails or the ticker is invalid."""
    resp = requests.get(
        "https://finnhub.io/api/v1/quote",
        params={"symbol": ticker, "token": FINNHUB_KEY},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    # Finnhub returns all zeros for unknown tickers
    if data.get("c") == 0 and data.get("t") == 0:
        return None
    return data


def poll_prices():
    # Runs forever in a background thread while the app is running
    while True:
        tickers = db.get_watchlist()

        for ticker in tickers: # Grabbing one ticker at a time.
            try: # Needed for the event that it returns an error.
                quote = fetch_quote(ticker)
                if quote is not None: # It will then save the ticker and it's data, then show it
                    db.save_quote(ticker, quote)
                    print(f"Saved {ticker}: ${quote['c']}")
                else:
                    print(f"No data for {ticker}")
            except Exception as e:
                print(f"Error with {ticker}: {e}")
        time.sleep(POLL_SECONDS) # The amount of seconds it takes to update.

@app.route("/")
def index():
    return send_from_directory("stock_frontend", "stock.html")

@app.route("/api/watchlist", methods=["GET"]) # To actually fetch the watchlist
def get_watchlist():
   return jsonify(db.get_watchlist())

@app.route("/api/watchlist", methods=["POST"]) # To add to your watchlist
def add_stock():
    ticker = request.json.get("ticker", "").upper()
    quote = fetch_quote(ticker) if ticker else None
    if quote is None:
        return jsonify({"error": f"'{ticker}' is not a valid ticker"}), 400
    db.add_stock(ticker)
    db.save_quote(ticker, quote)
    return jsonify({"added": ticker}, 201)

@app.route("/api/watchlist/<ticker>", methods=["DELETE"]) # To delete from you watchlist
def remove_stock(ticker):
    db.remove_stock(ticker)
    return jsonify({"removed": ticker.upper()})

@app.route("/api/prices/<ticker>", methods=["GET"]) # To grab the prices from the api.
def get_prices(ticker):
    return jsonify(db.get_prices(ticker))


@app.route("/api/notes/<ticker>", methods=["GET"])
def get_notes(ticker):
    return jsonify(db.get_notes(ticker))

@app.route("/api/notes/<ticker>", methods=["POST"])
def add_notes(ticker):
    text = request.json.get("text", "").strip()
    if not text:
        return jsonify({"error": "Note cannot be empty"}), 400
    db.add_note(ticker, text)
    return jsonify({"added": True}), 201

@app.route("/api/notes/<ticker>", methods=["DELETE"])
def delete_note(ticker, note_id):
    db.delete_note(ticker, note_id)
    return jsonify({"removed": note_id})


@app.route("/api/trades/<ticker>", methods=["GET"])
def get_trades(ticker):
    return jsonify(db.get_trades(ticker))

@app.route("/api/trades/<ticker>", methods=["POST"])
def add_trade(ticker):
    data = request.json
    try:
        entry_price = float(data["entry_price"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Entry price must be a number"}), 400
    db.add_trade(ticker, entry_price, data.get("entry_date"))
    return jsonify({"added": True}), 201

@app.route("/api/trades/<ticker>/<trade_id>", methods=["PATCH"])
def close_trade(ticker, trade_id):
    data = request.json
    try:
        exit_price = float(data["exit_price"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Exit price must be a number"}), 401
    try:
        db.close_trade(ticker, trade_id, exit_price, data.get("exit_date"))
    except NotFound:
        return jsonify({"error": "Trade not found"}), 404
    return jsonify({"closed": trade_id})


if __name__ == "__main__":
    # daemon=True means the thread stops when you stop the app (Ctrl+C)
    threading.Thread(target=poll_prices, daemon=True).start()
    # use_reloader=False stops Flask from starting the polling thread twice
    app.run(debug=True, use_reloader=False)
