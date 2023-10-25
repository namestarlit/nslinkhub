from flask import Flask
from flasgger import Swagger
from flask_cors import CORS

from api.auth import Auth
from api.config import Config


# Instantiate flask app object
app = Flask(__name__)
# Set strict slashes to false globally
app.url_map.strict_slashes = False

# Insitantiate Swagger
swagger = Swagger(app)

# Set configuration from Configuration class
app.config.from_object(Config)
# Institatiate authentication object
auth = Auth()

# Import endpoints blueprint
from api.blueprints import endpoints
# Register blueprints to app instance
app.register_blueprint(endpoints)

# Import routes module
from api.routes import error

# Configure CORS to allow all origins
CORS(app, resources={r'/*': {'origins': '*'}})
