from flask_wtf import FlaskForm
from wtforms import StringField, SelectField
from wtforms.validators import DataRequired

class StockForm(FlaskForm):
    symbol = StringField('Stock Symbol', validators=[DataRequired()])
    time_frame = SelectField('Time Frame', 
                          choices=[('daily', 'Daily'), 
                                  ('weekly', 'Weekly'), 
                                  ('monthly', 'Monthly')],
                          default='daily')