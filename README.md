# Stock Price Stats Project 📈

This Python script fetches daily stock prices using the Alpha Vantage API and calculates:

- Minimum closing price
- Maximum closing price
- Average closing price

## How to Run
1. Install dependencies: pip install requests
2. Replace `API_KEY` in `fetch_stock.py` with your Alpha Vantage API key.
3. Replace `STOCK_SYMBOL` in `fetch_stock.py` with the ticker symbol of your choice (Default is Apple, replace with any ticker you want)
4. Run: python fetch_stocks.py

## Example Output
Stock: AAPL
Number of days: 100
Min Closing Price: $155.12
Max Closing Price: $182.91
Average Closing Price: $168.77
