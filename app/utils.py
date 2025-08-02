import requests
from datetime import datetime, timedelta

def fetch_stock_data(symbol, time_frame='daily'):
    api_key = current_app.config['ALPHA_VANTAGE_API_KEY']
    
    if time_frame == 'daily':
        function = 'TIME_SERIES_DAILY'
    elif time_frame == 'weekly':
        function = 'TIME_SERIES_WEEKLY'
    else:
        function = 'TIME_SERIES_MONTHLY'
    
    url = f'https://www.alphavantage.co/query?function={function}&symbol={symbol}&apikey={api_key}'
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data
    except requests.exceptions.RequestException as e:
        return {'Error Message': str(e)}

def calculate_stats(data):
    time_series = data.get('Time Series (Daily)', data.get('Weekly Time Series', data.get('Monthly Time Series', {})))
    closing_prices = []
    
    for date, values in time_series.items():
        closing_price = float(values['4. close'])
        closing_prices.append(closing_price)
    
    if not closing_prices:
        return {
            'days': 0,
            'minimum': 0,
            'maximum': 0,
            'average': 0
        }
    
    return {
        'days': len(closing_prices),
        'minimum': min(closing_prices),
        'maximum': max(closing_prices),
        'average': sum(closing_prices) / len(closing_prices)
    }