from flask import Blueprint

# Instantiate API endpoints blueprint
endpoints = Blueprint("endpoints", __name__)

# Import endpoints blueprint routes from modules
from api.blueprints import (
    init,
    repository,
    repository_tags,
    resource,
    resource_tags,
    user,
)
