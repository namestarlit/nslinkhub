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

/users/{username}/repos
- GET: Returns a list of all repositories owned by the user with
  the given username.
- POST: Create new repositories owned by the user.

Submodules:
- auth: Contains authentication and authorization related methods.
- storage: Contains database data management methods to work with database.

Author: Paul John

"""
from flask import jsonify
from flask import request, abort, url_for
from email_validator import validate_email, EmailNotValidError

from api import auth
from linkhub import storage
from linkhub.user import User
from api.blueprints import endpoints


@endpoints.route('/users', methods=['GET'])
@auth.token_required
def get_users():
    """Retrives a list of all users from linkhub database"""
    try:
        users = storage.all(User).values()
    except Exception:
        abort(500)
    users_list = []

    # Append users to users list
    for user in users:
        users_list.append(user.to_optimized_dict())

    return jsonify({'Users': users_list}), 200


@endpoints.route('/users/<username>', methods=['GET'])
@auth.token_required
def get_user_by_username(username):
    """Retrives a user by their username"""
    try:
        user = storage.get_user_by_username(username)
    except Exception:
        abort(500)
    if user is None:
        abort(404, 'User Not Found')

    return jsonify({'User': user.to_optimized_dict()}), 200


@endpoints.route('/users', methods=['POST'])
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

    # Check email validity and if it does not exist
    email = user.get('email')
    try:
        emailinfo = validate_email(email, check_deliverability=False)
        user['email'] = emailinfo.normalized
    except EmailNotValidError as e:
        error_info = {'code': 400, 'message': 'invalid email address'}
        return jsonify({'error': error_info}), 400

    # Check if user's email already exists
    if user.get_user_by_email(user['email']) is not None:
        return jsonify({'message': 'email already exists'}), 409

    # Check is username already exists
    username = user.get('username')
    if storage.get_user_by_username(username) is not None:
        return jsonify({'message': 'username exists, '
                        'please choose another username'}), 409

    # Check if the email already exists
    email = user.get('email')
    print(email)
    print(storage.get_user_by_email(email))
    if storage.get_user_by_email(email) is not None:
        return jsonify({'message': 'Email already exists'}), 409

    # Create new user
    try:
        new_user = User(**user)
        storage.new(new_user)
        storage.save()
    except Exception as e:
        abort(500)

    # Set Location Header to the URL of the newly created user
    response = jsonify({'User': new_user.to_optimized_dict()})
    location_url = url_for('endpoints.get_user_by_username',
                           username=username, _external=True)
    response.headers['Location'] = location_url

    return response, 201
