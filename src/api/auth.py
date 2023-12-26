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
import os
import jwt
import datetime
from functools import wraps
from flask import current_app, g
from flask import request, jsonify, abort

from linkhub import storage


class Auth:
    """Authentication and Authorization class"""

    __ADMINS = os.getenv("ADMINS").split(":")

    @property
    def admins(self):
        """Retrives admins"""
        return self.__ADMINS

    def is_authorized(self, owner_id):
        """Checks if the user is authorized

        Checks if the current user owns a resource
        associated with a provided user_id or is in the admins group

        Args:
            user_id (str): The user_id associated with a resource

        Returns:
            bool: True if condition passed, otherwise False

        """
        # Get user-agent
        user_agent = g.user_id if hasattr(g, "user_id") else None

        # Return False is User-Agent is None
        if user_agent is None:
            return False

        # Return True if User-Agent owns the resource
        if user_agent == owner_id:
            return True

        # Return True if user is an admin
        if user_agent in self.admins:
            return True

        return False

    def basic_auth_required(self, f):
        """A wraper for basic_auth_required method"""

        @wraps(f)
        def decorated(*args, **kwargs):
            auth = request.authorization
            if not auth or not self.verify_credentials(auth.username, auth.password):
                return jsonify({"message": "Invalid credentials"}), 401
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
            token = None
            if "Authorization" in request.headers:
                auth_header = request.headers["Authorization"]
                if auth_header.startswith("Bearer "):
                    token = auth_header.split("Bearer ")[1]
                else:
                    error_info = {
                        "code": 400,
                        "message": (
                            "Incorrect token format. " "Format: Bearer your_token_here"
                        ),
                    }

                    return jsonify({"error": error_info}), 400

            if token is None:
                return jsonify({"message": "Token is missing"}), 401
            try:
                secret_key = current_app.config["SECRET_KEY"]
                data = jwt.decode(token, secret_key, algorithms=["HS256"])
            except jwt.ExpiredSignatureError:
                return jsonify({"message": "Token has Expired"}), 401
            except Exception as e:
                return jsonify({"message": "Invalid Token"}), 403

            # Set the user ID in a Flask global
            user_id = data.get("sub")
            if user_id is not None:
                g.user_id = user_id

            return f(*args, **kwargs)

        return decorated

    def generate_auth_token(self, username, expiration=24):
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
            "sub": user_id,
            "iat": issued_at,
            "exp": issued_at + datetime.timedelta(hours=expiration),
        }
        secret_key = current_app.config["SECRET_KEY"]
        token = jwt.encode(payload, secret_key, algorithm="HS256")
        return token

    def secured(self, f):
        """A wraper for secured methods [only-admins methods]"""

        @wraps(f)
        def decorated(*args, **kwargs):
            user_agent = g.user_id if hasattr(g, "user_id") else None

            if user_agent is not None:
                if user_agent in self.admins:
                    return f(*args, **kwargs)
            abort(403, "Forbidden")

        return decorated
