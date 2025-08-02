from flask import Blueprint, render_template, request, jsonify, current_app
from datetime import datetime, timedelta
import requests
from functools import wraps

bp = Blueprint('main', __name__)

def handle_api_errors(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except requests.exceptions.RequestException as e:
            return jsonify({'error': str(e)}), 500
        except KeyError as e:
            return jsonify({'error': f'Missing data in API response: {str(e)}'}), 500
        except Exception as e:
            current_app.logger.error(f'Unexpected error: {str(e)}')
            return jsonify({'error': 'An unexpected error occurred'}), 500
    return wrapper

@bp.route('/', methods=['GET', 'POST'])
def index():
    symbol = request.args.get('symbol', 'AAPL').upper()
    time_frame = request.args.get('time_frame', 'daily')
    
    if request.method == 'POST':
        symbol = request.form.get('symbol', 'AAPL').upper()
        time_frame = request.form.get('time_frame', 'daily')
    
    data = fetch_stock_data(symbol, time_frame)
    
    if 'Error Message' in data:
        return render_template('index.html', 
                             error=data['Error Message'],
                             symbol=symbol,
                             time_frame=time_frame)
    
    stats = calculate_stats(data, time_frame)
    recent_prices = get_recent_prices(data, time_frame)
    price_change, price_change_pct = calculate_price_change(data, time_frame)
    
    return render_template('results.html',
                         symbol=symbol,
                         time_frame=time_frame,
                         stats=stats,
                         recent_prices=recent_prices,
                         current_price=stats['current'],
                         price_change=price_change,
                         price_change_pct=price_change_pct)

@bp.route('/api/stock/<symbol>')
@handle_api_errors
def api_stock(symbol):
    time_frame = request.args.get('time_frame', 'daily')
    data = fetch_stock_data(symbol, time_frame)
    return jsonify(data)

def fetch_stock_data(symbol, time_frame='daily'):
    api_key = current_app.config['ALPHA_VANTAGE_API_KEY']
    
    function_map = {
        'daily': 'TIME_SERIES_DAILY',
        'weekly': 'TIME_SERIES_WEEKLY',
        'monthly': 'TIME_SERIES_MONTHLY'
    }
    
    url = (
        f'https://www.alphavantage.co/query?'
        f'function={function_map.get(time_frame, "TIME_SERIES_DAILY")}'
        f'&symbol={symbol}'
        f'&apikey={api_key}'
        f'&outputsize=compact'
    )
    
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def calculate_stats(data, time_frame):
    time_series_key = {
        'daily': 'Time Series (Daily)',
        'weekly': 'Weekly Time Series',
        'monthly': 'Monthly Time Series'
    }.get(time_frame, 'Time Series (Daily)')
    
    time_series = data.get(time_series_key, {})
    closing_prices = []
    
    for values in time_series.values():
        try:
            closing_prices.append(float(values['4. close']))
        except (KeyError, ValueError):
            continue
    
    if not closing_prices:
        return {
            'days': 0,
            'minimum': 0,
            'maximum': 0,
            'average': 0,
            'current': 0
        }
    
    latest_date = next(iter(time_series))
    current_price = float(time_series[latest_date]['4. close'])
    
    return {
        'days': len(closing_prices),
        'minimum': min(closing_prices),
        'maximum': max(closing_prices),
        'average': sum(closing_prices) / len(closing_prices),
        'current': current_price
    }

def get_recent_prices(data, time_frame, count=10):
    time_series_key = {
        'daily': 'Time Series (Daily)',
        'weekly': 'Weekly Time Series',
        'monthly': 'Monthly Time Series'
    }.get(time_frame, 'Time Series (Daily)')
    
    time_series = data.get(time_series_key, {})
    return dict(list(time_series.items())[:count])

def calculate_price_change(data, time_frame):
    time_series_key = {
        'daily': 'Time Series (Daily)',
        'weekly': 'Weekly Time Series',
        'monthly': 'Monthly Time Series'
    }.get(time_frame, 'Time Series (Daily)')
    
    time_series = data.get(time_series_key, {})
    if len(time_series) < 2:
        return 0, 0
    
    dates = sorted(time_series.keys(), reverse=True)
    current = float(time_series[dates[0]]['4. close'])
    previous = float(time_series[dates[1]]['4. close'])
    
    change = current - previous
    change_pct = (change / previous) * 100
    
    return change, change_pct