import requests
from flask import current_app
from datetime import datetime

def fetch_stock_data(symbol, time_frame='daily'):
    """Fetch stock data from Alpha Vantage API"""
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
    )
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Check for API errors
        if 'Error Message' in data:
            current_app.logger.error(f"API Error: {data['Error Message']}")
            return data
        
        return data
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Request failed: {str(e)}")
        return {'Error Message': str(e)}