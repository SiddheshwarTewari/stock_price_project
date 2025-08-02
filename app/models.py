from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class StockQuery(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(10), nullable=False)
    time_frame = db.Column(db.String(10), nullable=False)
    query_date = db.Column(db.DateTime, default=db.func.now())
    
    def __repr__(self):
        return f"<StockQuery {self.symbol} ({self.time_frame})>"