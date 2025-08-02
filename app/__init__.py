from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_caching import Cache
from .config import Config

db = SQLAlchemy()
cache = Cache()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    db.init_app(app)
    cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache'})
    
    with app.app_context():
        db.create_all()  # Create tables if they don't exist

    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app