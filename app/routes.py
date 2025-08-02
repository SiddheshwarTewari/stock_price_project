from flask import Blueprint, render_template, request, jsonify, current_app
from datetime import datetime, timedelta
import requests
from functools import wraps
import json
from .forms import StockForm
from .utils import fetch_stock_data

bp = Blueprint('main', __name__)

def handle_api_errors(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f'API Error: {str(e)}')
            return jsonify({'error': str(e)}), 500
        except Exception as e:
            current_app.logger.error(f'Unexpected error: {str(e)}')
            return jsonify({'error': 'An unexpected error occurred'}), 500
    return wrapper

@bp.route('/', methods=['GET', 'POST'])
def index():
    form = StockForm()
    symbol = request.args.get('symbol', 'AAPL').upper()
    time_frame = request.args.get('time_frame', 'daily')

    # Handle form submission
    if form.validate_on_submit():
        symbol = form.symbol.data.upper()
        time_frame = form.time_frame.data
        return redirect(url_for('main.index', symbol=symbol, time_frame=time_frame))
    
    # Fetch and process data
    data = fetch_stock_data(symbol, time_frame)
    
    if 'Error Message' in data:
        return render_template('index.html', 
                            form=form,
                            error=data['Error Message'],
                            symbol=symbol,
                            time_frame=time_frame)
    
    # Rest of your processing code...
    stats = calculate_stats(data, time_frame)
    recent_prices = get_recent_prices(data, time_frame)
    price_change, price_change_pct = calculate_price_change(data, time_frame)
    chart_data = prepare_chart_data(data, time_frame)
    
    return render_template('results.html',
                        form=form,
                        symbol=symbol,
                        time_frame=time_frame,
                        stats=stats,
                        recent_prices=recent_prices,
                        current_price=stats['current'],
                        price_change=price_change,
                        price_change_pct=price_change_pct,
                        chart_labels=json.dumps(list(chart_data['labels'])),
                        chart_prices=json.dumps(list(chart_data['prices'])))

def prepare_chart_data(data, time_frame):
    """Prepare data specifically for the chart"""
    time_series_key = next((k for k in data.keys() if "Time Series" in k), None)
    if not time_series_key:
        return {'labels': [], 'prices': []}
    
    series = data[time_series_key]
    sorted_data = sorted(series.items(), key=lambda x: x[0])  # Sort by date
    
    # Limit to 100 data points for better performance
    limited_data = sorted_data[-100:] if len(sorted_data) > 100 else sorted_data
    
    return {
        'labels': [item[0] for item in limited_data],
        'prices': [float(item[1]['4. close']) for item in limited_data]
    }

def calculate_stats(data, time_frame):
    time_series_key = next((k for k in data.keys() if "Time Series" in k), None)
    if not time_series_key:
        return {
            'days': 0,
            'minimum': 0,
            'maximum': 0,
            'average': 0,
            'current': 0
        }
    
    series = data[time_series_key]
    closing_prices = [float(v['4. close']) for v in series.values()]
    
    if not closing_prices:
        return {
            'days': 0,
            'minimum': 0,
            'maximum': 0,
            'average': 0,
            'current': 0
        }
    
    latest_date = max(series.keys())
    current_price = float(series[latest_date]['4. close'])
    
    return {
        'days': len(closing_prices),
        'minimum': min(closing_prices),
        'maximum': max(closing_prices),
        'average': sum(closing_prices) / len(closing_prices),
        'current': current_price
    }

def get_recent_prices(data, time_frame, count=10):
    time_series_key = next((k for k in data.keys() if "Time Series" in k), None)
    if not time_series_key:
        return {}
    
    series = data[time_series_key]
    # Get most recent dates
    sorted_dates = sorted(series.keys(), reverse=True)
    return {date: series[date] for date in sorted_dates[:count]}

def calculate_price_change(data, time_frame):
    time_series_key = next((k for k in data.keys() if "Time Series" in k), None)
    if not time_series_key or len(data[time_series_key]) < 2:
        return 0, 0
    
    series = data[time_series_key]
    dates = sorted(series.keys(), reverse=True)
    current = float(series[dates[0]]['4. close'])
    previous = float(series[dates[1]]['4. close'])
    
    change = current - previous
    change_pct = (change / previous) * 100
    
    return change, change_pct

@bp.route('/api/stock/<symbol>')
@handle_api_errors
def api_stock(symbol):
    time_frame = request.args.get('time_frame', 'daily')
    data = fetch_stock_data(symbol, time_frame)
    
    if 'Error Message' in data:
        return jsonify({'error': data['Error Message']}), 400
    
    time_series_key = next((k for k in data.keys() if "Time Series" in k), None)
    if not time_series_key:
        return jsonify({'error': 'No time series data found'}), 404
    
    # Transform data for frontend
    series = data[time_series_key]
    sorted_data = sorted(series.items(), key=lambda x: x[0])
    limited_data = sorted_data[-100:] if len(sorted_data) > 100 else sorted_data
    
    return jsonify({
        'symbol': symbol,
        'time_frame': time_frame,
        'labels': [item[0] for item in limited_data],
        'prices': [float(item[1]['4. close']) for item in limited_data]
    })