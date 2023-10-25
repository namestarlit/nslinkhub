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
    SECRET_KEY = getenv('SECRET_KEY', 'you-will-never-guess')
