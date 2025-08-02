import requests
from flask import current_app
import json

def fetch_stock_data(symbol, time_frame='daily'):
    """Fetch stock data from Alpha Vantage API with comprehensive error handling"""
    api_key = current_app.config['ALPHA_VANTAGE_API_KEY']
    
    if not api_key:
        current_app.logger.error("Alpha Vantage API key not configured")
        return {'Error Message': 'Alpha Vantage API key not configured'}
    
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
    
    current_app.logger.info(f"Fetching data for {symbol} ({time_frame}) from: {url.split('apikey')[0]}...")
    
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        # Log the raw response for debugging
        current_app.logger.debug(f"Raw API response for {symbol}: {json.dumps(data, indent=2)}")
        
        # Check for API errors or rate limiting
        if 'Error Message' in data:
            error_msg = data['Error Message']
            current_app.logger.error(f"Alpha Vantage Error for {symbol}: {error_msg}")
            return {'Error Message': f"API Error: {error_msg}"}
            
        if 'Note' in data:
            error_msg = data['Note']
            current_app.logger.error(f"Alpha Vantage Rate Limit for {symbol}: {error_msg}")
            return {'Error Message': f"API Rate Limit: {error_msg}"}
            
        # Check for valid time series data
        time_series_key = next(
            (key for key in data.keys() if "Time Series" in key),
            None
        )
        
        if not time_series_key:
            current_app.logger.error(f"No time series data found for {symbol}. Response keys: {list(data.keys())}")
            return {
                'Error Message': f"No price data available for {symbol}",
                'Debug': {
                    'ResponseKeys': list(data.keys()),
                    'Symbol': symbol,
                    'TimeFrame': time_frame
                }
            }
            
        # Verify we have actual data points
        if not data[time_series_key]:
            current_app.logger.error(f"Empty time series data for {symbol}")
            return {'Error Message': f"No price data points available for {symbol}"}
            
        return data
        
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Request failed for {symbol}: {str(e)}")
        return {
            'Error Message': f"Failed to fetch data for {symbol}",
            'Debug': {
                'Exception': str(e),
                'Symbol': symbol,
                'TimeFrame': time_frame
            }
        }
    except json.JSONDecodeError as e:
        current_app.logger.error(f"Invalid JSON response for {symbol}: {str(e)}")
        return {
            'Error Message': f"Invalid data received for {symbol}",
            'Debug': {
                'Exception': str(e),
                'Symbol': symbol,
                'TimeFrame': time_frame
            }
        }