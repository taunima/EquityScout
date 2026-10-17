# EquityScout

Creating a watchlist that has a cloud database that will allow me to track, edit and delete stocks that I am interested in.

## Instructions for Build and Use

Steps to build and/or run the software:

1. Clone this repository and install the Python libraries: `pip3 install -r requirements.txt`
2. Create a free account at [Finnhub](https://finnhub.io) and copy your API key. Create a `.env` file in the project folder containing: `API_KEY=your_finnhub_key`
3. Create a project in the [Firebase console](https://console.firebase.google.com) and create a Firestore database.
4. In Firebase, go to Project settings → Service accounts → Generate new private key. Save the file as `serviceAccountKey.json` in the project folder.

Instructions for using the software:

1. In the terminal, from the project folder, run `python3 stock_tracker.py` (Mac) or `python stock_tracker.py` (Windows).
2. The app opens in your browser at `http://127.0.0.1:5001`.
3. Type a ticker (e.x. AAPL) in the search bar and click **Add**. Click a stock to open its notes and trade journal.
4. To stop the app, press **Control + C** in the terminal.

## Development Environment

To recreate the development environment, you need the following software and/or libraries with the specified versions:

* Python 3.13
* Flask
* firebase-admin (Firebase Admin SDK for Python)
* requests
* python-dotenv
* HTML, CSS, and JavaScript for the frontend
* Finnhub API (free tier) for stock data

## Useful Websites to Learn More

I found these websites useful in developing this software:

* [Firebase Tutorial](https://firebase.google.com/docs/firestore)
* [Firebase Use API](https://firebase.google.com/docs/firestore/use-rest-api)
* [Finnhub API Documentation](https://finnhub.io/docs/api)
* [Flask Documentation](https://flask.palletsprojects.com)

## Future Work

The following items I plan to fix, improve, and/or add to this project in the future:

* [ ] Implementing a chart of the live trades in with each of the stocks that you plan to watch.
* [ ] Skip hours that the market is closed and have live data when the market is open
* [ ] Implement user authentication