"""
Authentication and Authorization Module

This module contains the `Auth` class, which provides authentication
and authorization methods for the LinkHub API.

Classes:
- Auth: Authentication and Authorization class

Methods and Decorators:
- basic_auth_required: Decorator for basic authentication.
- verify_credentials: Method to verify username and password validity.
- token_required: Decorator for token-based authentication.
- generate_auth_token: Method to generate a JWT token for user authentication.

This module includes methods for basic authentication and
token-based authentication, as well as token generation.

Author: Paul John

"""
import jwt
import datetime
from functools import wraps
from flask import current_app
from flask import request, jsonify, g

from linkhub import storage


class Auth:
    """Authentication and Authorization class"""
    def basic_auth_required(self, f):
        """A wraper for basic_auth_required method"""
        @wraps(f)
        def decorated(*args, **kwargs):
            auth = request.authorization
            if (not auth or not
                    self.verify_credentials(auth.username, auth.password)):
                return jsonify({'message': 'Invalid credentials'}), 401
            return f(*args, **kwargs)
        return decorated

    def verify_credentials(self, username, password):
        """Verify username and password validity"""
        user = storage.get_user_by_username(username)
        if user is not None:
            if user.check_password(password):
                return True
        return False

    def token_required(self, f):
        """A wraper for token_required method"""
        @wraps(f)
        def decorated(*args, **kwargs):
            if "Authorization" in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split('Bearer ')[1]
                else:
                    error_info = {
                            'code': 400,
                            'message': ('Incorrect token format. '
                                        'Format: Bearer your_token_here')
                            }

                    return jsonify({'error': error_info}), 400

            if not token:
                return jsonify({'message': 'Token is missing'}), 401
            try:
                secret_key = current_app.config['SECRET_KEY']
                data = jwt.decode(token, secret_key, algorithms=['HS256'])
            except jwt.ExpiredSignatureError:
                return jsonify({'message': 'Token has Expired'}), 401
            except Exception as e:
                return jsonify({'message': 'Invalid Token'}), 403

            # Set the user ID in a Flask global
            user_id = data.get('sub')
            if user_id is not None:
                g.user_id = user_id

            return f(*args, **kwargs)
        return decorated

    def generate_auth_token(self, username, expiration=3600):
        """Generates JWT token

        Args:
            username (str): The username of the user
            expiration (int): The expiration time of a token in seconds
        Returns:
            str: a JWT token
        """
        user = storage.get_user_by_username(username)
        user_id = user.id
        issued_at = datetime.datetime.utcnow()

        payload = {
                'sub': user_id,
                'iat': issued_at,
                'exp': issued_at + datetime.timedelta(hours=24)
                }
        secret_key = current_app.config['SECRET_KEY']
        token = jwt.encode(payload, secret_key, algorithm='HS256')
        return token
