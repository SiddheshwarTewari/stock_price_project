from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from .config import Config

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize database
    db.init_app(app)
    
    # Initialize caching if available
    try:
        from flask_caching import Cache
        cache = Cache(config={'CACHE_TYPE': 'SimpleCache'})
        cache.init_app(app)
        app.extensions['cache'] = cache
    except ImportError:
        app.logger.warning("Flask-Caching not available. Running without cache.")
    
    with app.app_context():
        db.create_all()

    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app