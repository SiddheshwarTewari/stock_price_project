import requests
import json

# Replace with your API key
API_KEY = '1N72LEZEXDE3FMJR'
STOCK_SYMBOL = 'AAPL'  # Apple stock
API_URL = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={STOCK_SYMBOL}&apikey={API_KEY}'

# Step 1: Fetch data
response = requests.get(API_URL)
data = response.json()

# Step 2: Get daily prices
time_series = data['Time Series (Daily)']
closing_prices = []

for date, values in time_series.items():
    closing_price = float(values['4. close'])
    closing_prices.append(closing_price)

# Step 3: Calculate min, max, avg
minimum = min(closing_prices)
maximum = max(closing_prices)
average = sum(closing_prices) / len(closing_prices)

# Step 4: Print results
print(f"Stock: {STOCK_SYMBOL}")
print(f"Number of days: {len(closing_prices)}")
print(f"Min Closing Price: ${minimum:.2f}")
print(f"Max Closing Price: ${maximum:.2f}")
print(f"Average Closing Price: ${average:.2f}")
