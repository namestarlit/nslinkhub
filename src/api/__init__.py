"""
LinkHub API Initialization

This module initializes the LinkHub API application. It connects and configures
various components of the API, including authentication, configuration
settings, blueprints, error routes, and CORS support.

Components:
- `app`: The Flask application instance.
- `swagger`: Swagger integration for API documentation.
- `auth`: Authentication object for user and token verification.
- `endpoints`: Blueprint for API endpoints.
- `error`: Module for handling error routes.
- CORS configuration: Allows all origins for cross-origin requests.

Initialization Steps:
1. Create a Flask application instance.
2. Disable strict slashes globally.
3. Instantiate Swagger for API documentation.
4. Set configuration from the `Config` class.
5. Instantiate the `Auth` object for authentication.
6. Register the `endpoints` blueprint to the application.
7. Import and configure the `error` module for handling errors.
8. Configure CORS to allow requests from all origins.

This module serves as the entry point for initializing the LinkHub API
application and connecting its components.

"""

__author__ = 'Paul John'
__version__ = '23.10'

from flask import Flask
from flasgger import Swagger
from flask_cors import CORS

from api.auth import Auth
from api.utils import Util
from api.config import Config
from api.validation import Validate


# Instantiate flask app object
app = Flask(__name__)
# Set strict slashes to false globally
app.url_map.strict_slashes = False

# Insitantiate Swagger
swagger = Swagger(app)

# Set configuration from Configuration class
app.config.from_object(Config)
# Institatiate authentication and validation objects
auth = Auth()
validate = Validate()
util = Util()

# Import endpoints blueprint
from api.blueprints import endpoints
# Register blueprints to app instance
app.register_blueprint(endpoints)

# Import routes module
from api.routes import error

# Configure CORS to allow all origins
CORS(app, resources={r'/*': {'origins': '*'}})
