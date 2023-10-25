from flask import Blueprint

# Instantiate API endpoints blueprint
endpoints = Blueprint('endpoints', __name__, url_prefix='/api')

from api.blueprints.init import *
from api.blueprints.user import *
from api.blueprints.resource import *
from api.blueprints.repository import *
from api.blueprints.resource_tags import *
from api.blueprints.repository_tags import *
