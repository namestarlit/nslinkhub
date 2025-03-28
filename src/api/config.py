"""
Flask Configuration Module

This module contains the Flask configuration for the LinkHub API.

Classes:
- Config: A Flask configuration class.

Configuration Options:
- SECRET_KEY:
  The secret key for Flask. Defaults to 'you-will-never-guess'
  if not specified in the environment.

This module defines the configuration options for the
Flask application used in the LinkHub API.

Author: Paul John

"""

from os import getenv


class Config:
    """A Flask configuration class."""

    # Get secret key otherwise assign a default value.
    SECRET_KEY = getenv("SECRET_KEY", "you-will-never-guess")

    # Email Server configuration
    MAIL_SERVER = getenv("MAIL_SERVER")
    MAIL_PORT = getenv("MAIL_PORT")
    MAIL_USE_SSL = getenv("MAIL_USE_SSL", "True").lower() == "true"
    MAIL_USERNAME = getenv("MAIL_USERNAME")
    MAIL_PASSWORD = getenv("MAIL_PASSWORD")
    ADMINS = getenv("ADMIN_EMAILS", "").split(", ")

    # JSON Pretty-Printing and formatting
    JSONIFY_PRETTYPRINT_REGULAR = True

    # Swagger configuration
    SWAGGER = {
        "title": "LinkHub API",
        "version": "23.10",
        "description": "LinkHub API Documentation",
        "openapi": "3.0.2",
    }
