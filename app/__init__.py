from flask import Flask
from .config import Config
from .models import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize database
    db.init_app(app)
    
    with app.app_context():
        db.create_all()  # Create tables if they don't exist

    from .routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app