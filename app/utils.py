import requests
from flask import current_app
import json

def fetch_stock_data(symbol, time_frame='daily'):
    """Fetch stock data from Alpha Vantage API with better error handling"""
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
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Debug: Log the API response
        current_app.logger.info(f"API Response: {json.dumps(data, indent=2)}")
        
        if 'Error Message' in data:
            current_app.logger.error(f"API Error: {data['Error Message']}")
            return data
        
        # Check if we got valid data
        time_series_key = next(
            (key for key in data.keys() if "Time Series" in key),
            None
        )
        
        if not time_series_key:
            return {'Error Message': 'No time series data found in response'}
            
        return data
        
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Request failed: {str(e)}")
        return {'Error Message': str(e)}