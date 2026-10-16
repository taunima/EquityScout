"""
Firestore data layer for the stock tracker.
Replaces stock_schema.sql (SQLite). Firestore has no CREATE TABLE step:
collections are created automatically the first time you write to them.

Structure (SQL table -> Firestore):
    watchlist                -> watchlist/{TICKER}
    price_tracking           -> watchlist/{TICKER}/price_tracking/{auto_id}
    notes                    -> watchlist/{TICKER}/notes/{auto_id}
    trade_table              -> watchlist/{TICKER}/trades/{auto_id}

The ticker is the document ID, so the ticker_symbol_id foreign keys go away:
child records live *under* the stock they belong to.

Setup:
    pip install firebase-admin python-dotenv
    Firebase console -> Project settings -> Service accounts -> Generate new private key
    Save the file as serviceAccountKey.json in the project root (it's in .gitignore)
    or point FIREBASE_KEY_PATH in .env at it.
"""

import os

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

load_dotenv()

_KEY_PATH = os.getenv("FIREBASE_KEY_PATH", "serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(_KEY_PATH))

db = firestore.client()


def _stock(ticker):
    return db.collection("watchlist").document(ticker.upper())

def add_stock(ticker):
    """INSERT INTO watchlist (ticker_symbol) VALUES (?)"""
    _stock(ticker).set({
        "ticker_symbol": ticker.upper(),
        "added_at": firestore.SERVER_TIMESTAMP,
    })

def get_watchlist():
    """SELECT ticker_symbol FROM watchlist  (used by the Finnhub polling loop)"""
    return [doc.id for doc in db.collection("watchlist").stream()]

def remove_stock(ticker):
    """DELETE FROM watchlist WHERE ticker_symbol = ?
    Firestore doesn't delete subcollections with their parent, so
    recursive_delete removes the stock's prices, notes, and trades as well."""
    db.recursive_delete(_stock(ticker))

def save_quote(ticker, quote):
    """Save one Finnhub /quote response as a snapshot.
    Finnhub keys: o=open, h=high, l=low, c=current, pc=previous close, t=unix time"""
    _stock(ticker).collection("price_tracking").add({
        "open": quote["o"],
        "high": quote["h"],
        "low": quote["l"],
        "current_price": quote["c"],
        "previous_close": quote["pc"],
        "timestamp": quote["t"],
    })

def get_prices(ticker, limit=100):
    """Most recent snapshots first."""
    query = (_stock(ticker).collection("price_tracking")
             .order_by("timestamp", direction=firestore.Query.DESCENDING)
             .limit(limit))
    return [doc.to_dict() for doc in query.stream()]


def add_note(ticker, text):
    _stock(ticker).collection("notes").add({
        "personal_notes": text,
        "created_at": firestore.SERVER_TIMESTAMP,
    })

def get_notes(ticker):
    return [{"id": d.id, **d.to_dict()}
            for d in _stock(ticker).collection("notes").stream()]

def delete_note(ticker, note_id):
    _stock(ticker).collection("notes").document(note_id).delete()

def add_trade(ticker, entry_price, entry_date, exit_price=None, exit_date=None):
    _stock(ticker).collection("trades").add({
        "entry_price": entry_price,
        "entry_date": entry_date,
        "exit_price": exit_price,
        "exit_date": exit_date,
    })

def close_trade(ticker, trade_id, exit_price, exit_date):
    """UPDATE trade_table SET exit_price = ?, exit_date = ? WHERE id = ?"""
    _stock(ticker).collection("trades").document(trade_id).update({
        "exit_price": exit_price,
        "exit_date": exit_date,
    })

def get_trades(ticker):
    return [{"id": d.id, **d.to_dict()}
            for d in _stock(ticker).collection("trades").stream()]


if __name__ == "__main__":
    add_stock("AAPL")
    print("Watchlist:", get_watchlist())
