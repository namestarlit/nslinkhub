"""This modele contains flask configuration"""
from os import getenv


class Config:
    """A Flask configuration class."""
    # Get secret key otherwise assign a default value.
    SECRET_KEY = getenv('SECRET_KEY', 'you-will-never-guess')
