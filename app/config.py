import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Only require the API key
    ALPHA_VANTAGE_API_KEY = os.environ.get('ALPHA_VANTAGE_API_KEY')
    
    # Use a simple default secret key (not for production)
    SECRET_KEY = os.environ.get('SECRET_KEY', 'simple-dev-key')