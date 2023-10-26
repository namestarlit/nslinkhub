from flask import Blueprint

# Instantiate API endpoints blueprint
endpoints = Blueprint('endpoints', __name__, url_prefix='/api')

# Import endpoints blueprint routes from modules
from api.blueprints import init
from api.blueprints import user
from api.blueprints import resource
from api.blueprints import repository
from api.blueprints import resource_tags
from api.blueprints import repository_tags
