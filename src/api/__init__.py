from flask import Flask
from flask_cors import CORS
from api.auth import Auth
from api.config import Config


app = Flask(__name__)
# Set strict slashes to false globally
app.url_map.strict_slashes = False
# Set configuration from Configuration class
app.config.from_object(Config)

# Import endpoints blueprint
from api.blueprints import endpoints
# Register blueprints to app instance
app.register_blueprint(endpoints)

# Configure CORS to allow all origins
CORS(app, resources={r'/*': {'origins': '*'}})
