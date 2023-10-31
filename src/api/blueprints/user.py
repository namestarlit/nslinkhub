"""
API Module: Users

This module defines the endpoints related to users in the LinkHub API.

Endpoints:
- GET /users:
  Returns a list of all LinkHub users.
- POST /users:
  Creates a new user and adds them to the database.
- GET /users/{username}:
  Returns a user with public information: username, id, created_at,
  updated_at, and bio.
- PUT /users/{username}:
  Update/replace user information.
- DELETE /users/{username}:
  Delete a user and all their associated data, including repositories
  and resources.

Submodules:
- auth: Contains authentication and authorization related methods.
- storage: Contains database data management methods to work with database.

Author: Paul John

"""
from flask import request, abort
from flask import jsonify, make_response

from api import log
from api import auth
from api import util
from api import validate
from linkhub import storage
from linkhub.user import User
from api.blueprints import endpoints


@endpoints.route('/users', methods=['GET'])
def get_users():
    """Retrives a list of all users from linkhub database"""
    try:
        users = storage.all(User).values()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Check if users don't exist
    if not users:
        return jsonify({}), 200

    # Append users to users list
    users_list = []

    for user in users:
        users_list.append(user.to_optimized_dict())

    return jsonify({'Users': users_list}), 200


@endpoints.route('/users/<username>', methods=['GET'])
@auth.token_required
def get_user_by_username(username):
    """Retrives a user by their username"""
    try:
        user = storage.get_user_by_username(username)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

    # Check the If-Modified-Since header
    if 'If-Modified-Since' in request.headers:
        modified_since = request.headers['If-Modified-Since']

        # check if a resource has been modified
        if not util.is_modified_since(user.updated_at, modified_since):
            return make_response('', 304)

    # Add Last-Modified header to the response
    response = jsonify({'User': user.to_optimized_dict()})
    response.headers['Last-Modified'] = util.last_modified(user.updated_at)

    return response, 200


@endpoints.route('/users', methods=['POST'])
@auth.secured
@auth.token_required
def create_user():
    """Creates a new user"""
    user = request.get_json()

    # Handle possible exceptions/errors
    error_info = None
    if not user:
        abort(415, 'Not a JSON')
    if 'username' not in user:
        error_info = {'code': 400, 'message': 'username not provided'}
    if 'email' not in user:
        error_info = {'code': 400, 'message': 'email not provided'}
    if 'password' not in user:
        error_info = {'code': 400, 'message': 'password not provided'}

    if error_info is not None:
        return jsonify({'error': error_info}), 400

    # Check email validity and if it already exists
    email = user.get('email')
    if not validate.is_email_valid(email):
        error_info = {'code': 400, 'message': 'invalid email address'}
        return jsonify({'error': error_info}), 400
    if not validate.is_email_available(email):
        return jsonify({'message': 'email already exists'}), 409

    # check if the username is available and valid
    username = user.get('username')
    if not validate.is_username_valid(username):
        return jsonify(
                {'message': 'invalid username format: '
                 'username can only contain lowercase letters, '
                 'numbers and underscores (_)'}), 409
    if not validate.is_username_available(username):
        return jsonify({'message': 'username exists, '
                        'please choose another username'}), 409

    try:
        # Create new user
        new_user = User(**user)
        storage.new(new_user)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location Header to the response
    response = jsonify({'User': new_user.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_user_by_username', username=new_user.username
            )
    response.headers['Location'] = location_url

    return response, 201


@endpoints.route('/users/<username>', methods=['PUT'])
@auth.token_required
def update_user(username):
    """Updates user by their username"""
    # Get user data
    user_info = request.get_json()

    # Handle possible exceptions
    if not user_info:
        abort(415, 'Not JSON')

    try:
        # Get user if they exist
        user = storage.get_user_by_username(username)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not found')

    # Check if the user owns the account
    if not auth.is_authorized(user.id):
        abort(403, 'Forbidden')

    # check if username is available and valid
    if 'username' in user_info:
        new_username = user_info.get('username')
        if username != new_username:
            if not validate.is_username_valid(new_username):
                return jsonify(
                        {'message': 'invalid username format: '
                         'username can only contain lowercase letters, '
                         'numbers and underscores (_)'}), 409
            if not validate.is_username_available(new_username):
                return jsonify(
                        {'message': 'username already exists. '
                         'Please choose a another one'}), 409

    # check if new email already exists
    if 'email' in user_info:
        new_email = user_info.get('email')
        if user.email != new_email:
            if not validate.is_email_valid(new_email):
                error_info = {'code': 400, 'message': 'invalid email address'}
                return jsonify({'error': error_info}), 400
            if not validate.is_email_available(new_email):
                return jsonify({'message': 'new email already exist'}), 409

    try:
        # Update user info
        for key, value in user_info.items():
            if key not in ['id', 'created_at', 'updated_at']:
                setattr(user, key, value)
        user.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location header to the response
    response = jsonify({'User': user.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_user_by_username', username=user.username
            )
    response.headers['Location'] = location_url

    return response, 200


@endpoints.route('/users/<username>', methods=['DELETE'])
@auth.token_required
def delete_user(username):
    """Deletes a user from linkhub"""
    try:
        user = storage.get_user_by_username(username)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Handle possible errors and authorization
    if user is None:
        abort(404, 'User Not Found')
    if not auth.is_authorized(user.id):
        abort(403, 'Forbidden')

    try:
        storage.delete(user)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    return jsonify({}), 200
