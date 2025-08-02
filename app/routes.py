from flask import Blueprint, render_template, request, redirect, url_for, current_app
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

    if form.validate_on_submit():
        symbol = form.symbol.data.upper()
        time_frame = form.time_frame.data
        return redirect(url_for('main.index', symbol=symbol, time_frame=time_frame))
    
    # Validate symbol
    if not symbol.isalpha() or len(symbol) > 5:
        return render_template('index.html',
                            form=form,
                            error=f"Invalid stock symbol: {symbol}",
                            symbol=symbol,
                            time_frame=time_frame)
    
    data = fetch_stock_data(symbol, time_frame)
    
    if 'Error Message' in data:
        error_msg = data['Error Message']
        if 'Rate Limit' in error_msg:
            return render_template('rate_limit.html',
                                form=form,
                                symbol=symbol,
                                time_frame=time_frame,
                                error=error_msg)
        
        return render_template('index.html',
                            form=form,
                            error=error_msg,
                            symbol=symbol,
                            time_frame=time_frame)
    
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

# Helper functions remain the same as in your original file
# (prepare_chart_data, calculate_stats, get_recent_prices, calculate_price_change)

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
    
    series = data[time_series_key]
    sorted_data = sorted(series.items(), key=lambda x: x[0])
    limited_data = sorted_data[-100:] if len(sorted_data) > 100 else sorted_data
    
    return jsonify({
        'symbol': symbol,
        'time_frame': time_frame,
        'labels': [item[0] for item in limited_data],
        'prices': [float(item[1]['4. close']) for item in limited_data]
    })