import os
from flask import Flask, render_template, request, jsonify
import requests
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
from io import BytesIO
import base64

app = Flask(__name__)

# Hardcoded Alpha Vantage API Key
ALPHA_VANTAGE_API_KEY = "RBXMFITJ8OMCM8HA"

def get_stock_data(symbol, outputsize='compact'):
    """Fetch daily time series data from Alpha Vantage"""
    url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize={outputsize}&apikey={ALPHA_VANTAGE_API_KEY}"
    response = requests.get(url)
    data = response.json()
    
    if 'Note' in data:
        raise Exception("API rate limit reached")
    if 'Error Message' in data:
        raise Exception(data['Error Message'])
    
    return data

def process_stock_data(raw_data):
    """Process raw API data into a more usable format"""
    time_series = raw_data.get('Time Series (Daily)', {})
    processed_data = []
    
    for date, values in time_series.items():
        processed_data.append({
            'date': date,
            'open': float(values['1. open']),
            'high': float(values['2. high']),
            'low': float(values['3. low']),
            'close': float(values['4. close']),
            'volume': int(values['5. volume'])
        })
    
    # Sort by date (newest first)
    processed_data.sort(key=lambda x: x['date'], reverse=True)
    return processed_data

def generate_chart(stock_data, symbol):
    """Generate a price chart from the stock data"""
    dates = [entry['date'] for entry in stock_data[:30]]  # Last 30 days
    closes = [entry['close'] for entry in stock_data[:30]]
    
    plt.figure(figsize=(10, 5))
    plt.plot(dates[::-1], closes[::-1], marker='o', color='#0ff0fc', linewidth=2)
    plt.title(f'{symbol} Stock Price (Last 30 Days)')
    plt.xlabel('Date')
    plt.ylabel('Price ($)')
    plt.xticks(rotation=45)
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.tight_layout()
    
    # Save plot to a bytes buffer
    buffer = BytesIO()
    plt.savefig(buffer, format='png')
    buffer.seek(0)
    plt.close()
    
    # Convert to base64 for HTML embedding
    image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
    return f"data:image/png;base64,{image_base64}"

def calculate_statistics(stock_data):
    """Calculate basic statistics from the stock data"""
    if not stock_data:
        return {}
    
    closes = [entry['close'] for entry in stock_data]
    volumes = [entry['volume'] for entry in stock_data]
    
    return {
        'latest_price': stock_data[0]['close'],
        'latest_date': stock_data[0]['date'],
        'min_price': min(closes),
        'max_price': max(closes),
        'avg_price': sum(closes) / len(closes),
        'total_volume': sum(volumes),
        'days_analyzed': len(stock_data)
    }

@app.route('/', methods=['GET', 'POST'])
def index():
    symbol = request.args.get('symbol', 'IBM')  # Default to IBM
    error = None
    chart = None
    stats = None
    processed_data = []
    
    try:
        if request.method == 'GET' and symbol:
            raw_data = get_stock_data(symbol)
            processed_data = process_stock_data(raw_data)
            chart = generate_chart(processed_data, symbol)
            stats = calculate_statistics(processed_data)
    except Exception as e:
        error = str(e)
    
    return render_template('index.html', 
                         symbol=symbol,
                         chart=chart,
                         stats=stats,
                         error=error,
                         data=processed_data[:10])  # Show only last 10 days

@app.route('/api/stock/<symbol>')
def stock_api(symbol):
    try:
        raw_data = get_stock_data(symbol)
        processed_data = process_stock_data(raw_data)
        return jsonify({
            'symbol': symbol,
            'data': processed_data[:30],  # Last 30 days
            'stats': calculate_statistics(processed_data)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))