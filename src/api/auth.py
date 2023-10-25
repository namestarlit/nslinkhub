"""This module contains a Authentication class"""
import jwt
import datetime
from flask import request
from functools import wraps
from flask import current_app

from linkhub import storage


class Auth:
    """Authentication and Authorization class"""
    pass
