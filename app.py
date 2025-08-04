# Add this at the top of app.py
import warnings
warnings.filterwarnings("ignore", message="The 'unit' keyword in Timestamp construction is deprecated")
import os
from flask import Flask, render_template, request, jsonify
import yfinance as yf
from datetime import datetime, timedelta
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from io import BytesIO
import base64
import pandas as pd

app = Flask(__name__)

# Cyberpunk color scheme
CYBERPUNK_COLORS = {
    'neon_blue': '#0ff0fc',
    'neon_pink': '#ff2a6d',
    'neon_purple': '#d300c5',
    'dark_bg': '#0a0a12',
    'card_bg': 'rgba(15, 15, 25, 0.8)'
}

def get_stock_data(symbol, period='1y'):
    """Fetch stock data using yfinance"""
    try:
        stock = yf.Ticker(symbol)
        hist = stock.history(period=period)
        
        if hist.empty:
            return None, "No data found for this symbol"
            
        # Convert to list of dicts
        data = []
        for date, row in hist.iterrows():
            data.append({
                'date': date.strftime('%Y-%m-%d'),
                'open': round(row['Open'], 2),
                'high': round(row['High'], 2),
                'low': round(row['Low'], 2),
                'close': round(row['Close'], 2),
                'volume': int(row['Volume'])
            })
            
        # Get additional info
        info = stock.info
        return {
            'history': data,
            'info': info,
            'symbol': symbol.upper()
        }, None
    except Exception as e:
        return None, str(e)

def generate_chart(data, symbol):
    """Generate cyberpunk-style price chart"""
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(12, 6), 
                        facecolor=CYBERPUNK_COLORS['dark_bg'])
    
    dates = [d['date'] for d in data][::-1]
    closes = [d['close'] for d in data][::-1]
    
    # Main price line
    ax.plot(dates, closes, 
           color=CYBERPUNK_COLORS['neon_blue'], 
           linewidth=2,
           marker='o',
           markersize=3,
           markerfacecolor=CYBERPUNK_COLORS['neon_pink'])
    
    # Grid and styling
    ax.set_facecolor(CYBERPUNK_COLORS['dark_bg'])
    ax.grid(True, linestyle='--', alpha=0.3, color=CYBERPUNK_COLORS['neon_blue'])
    ax.set_title(f'{symbol} PRICE CHART', 
                color=CYBERPUNK_COLORS['neon_blue'],
                fontweight='bold')
    ax.set_xlabel('DATE', color=CYBERPUNK_COLORS['neon_purple'])
    ax.set_ylabel('PRICE (USD)', color=CYBERPUNK_COLORS['neon_purple'])
    plt.xticks(rotation=45, color=CYBERPUNK_COLORS['neon_purple'])
    plt.yticks(color=CYBERPUNK_COLORS['neon_purple'])
    plt.tight_layout()
    
    # Save to buffer
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=100, facecolor=CYBERPUNK_COLORS['dark_bg'])
    plt.close()
    buf.seek(0)
    
    return f"data:image/png;base64,{base64.b64encode(buf.read()).decode('utf-8')}"

def calculate_stats(data):
    """Calculate key statistics"""
    if not data:
        return {}
    
    closes = [d['close'] for d in data]
    volumes = [d['volume'] for d in data]
    
    return {
        'current': closes[0],
        'high_52w': max(closes),
        'low_52w': min(closes),
        'avg_volume': int(sum(volumes)/len(volumes)),
        'last_update': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

@app.route('/', methods=['GET', 'POST'])
def index():
    symbol = request.args.get('symbol', 'AAPL')
    period = request.args.get('period', '1y')
    error = None
    stock_data = None
    chart = None
    stats = None
    info = None
    
    if symbol:
        stock_data, error = get_stock_data(symbol, period)
        if stock_data:
            chart = generate_chart(stock_data['history'][-30:], stock_data['symbol'])
            stats = calculate_stats(stock_data['history'])
            info = stock_data['info']
    
    return render_template('index.html',
                         symbol=symbol,
                         period=period,
                         chart=chart,
                         stats=stats,
                         info=info,
                         error=error,
                         data=stock_data['history'][-10:] if stock_data else [],
                         colors=CYBERPUNK_COLORS)

@app.route('/api/stock/<symbol>')
def api_stock(symbol):
    stock_data, error = get_stock_data(symbol)
    if error:
        return jsonify({'error': error}), 400
    return jsonify(stock_data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))