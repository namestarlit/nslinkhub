"""
API Module: Methods

This module defines the various methods/actions endpoints in the LinkHub API.

Endpoints:
- GET /token:
  Returns a token to be used to authenticate users to the API service.
- GET /status:
  Returns the API status - OK.
- GET /api:
  Returns a list of all supported endpoints in the LinkHub API.
- GET /stats:
  Returns the total number/stats of each LinkHub class object,
  including User, Repository, Resource, and Tag.
- DELETE /tags/clear-tags:
  Deletes all unused tags (tags not linked to any repository or resource).

Note: These methods are protected by different levels of authentication
and authorization, as specified in the decorators applied to each endpoint.

Author: Paul John

"""
from flask import jsonify
from flask import request, abort

from api import log
from api import auth
from api import util
from api import limiter
from api import validate
from linkhub import storage
from linkhub.user import User
from api.blueprints import endpoints


@endpoints.route('/user/register', methods=['POST'])
@limiter.limit("3 per month")
def register_user():
    """Register a new user to LinkHub"""
    # Impelment user registration logic
    # 1. Create User
    # Get  user data
    user_data = request.get_json()

    # Handle possible exceptions/errors
    error_info = None
    if not user_data:
        abort(415, 'Not a JSON')
    if 'username' not in user_data:
        error_info = {'code': 400, 'message': 'username not provided'}
    if 'email' not in user_data:
        error_info = {'code': 400, 'message': 'email not provided'}
    if 'password' not in user_data:
        error_info = {'code': 400, 'message': 'password not provided'}

    if error_info is not None:
        return jsonify({'error': error_info}), 400

    # Check email validity and if it already exists
    email = user_data.get('email')
    if not validate.is_email_valid(email):
        error_info = {'code': 400, 'message': 'invalid email address'}
        return jsonify({'error': error_info}), 400
    if not validate.is_email_available(email):
        return jsonify({'message': 'email already exists'}), 409

    # check if the username is available and valid
    username = user_data.get('username')
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
        new_user = User(**user_data)
        storage.new(new_user)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location Header to the response
    response = jsonify({'user': new_user.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_user_by_username', username=new_user.username
            )
    response.headers['Location'] = location_url

    return response, 201


@endpoints.route('/token', methods=['GET'])
@auth.basic_auth_required
def get_token():
    """Get JWT token"""
    try:
        # User authentication passed, generate and return the token
        username = request.authorization.username
        token = auth.generate_auth_token(username)
        return jsonify({'token': token}), 200
    except Exception as e:
        log.logerror(e)
        abort(500)


@endpoints.route('/status', methods=['GET'])
def api_status():
    """Get API Status"""
    return jsonify({'status': 'OK'}), 200


@endpoints.route('/stats', methods=['GET'])
def linkhub_stats():
    """Get total number/stats of each LinkHub class objects"""
    classes = ['User', 'Repository', 'Resource', 'Tag']
    keys = ['users', 'repositories', 'resources', 'tags']

    stats = {}
    for i in range(len(classes)):
        stats[keys[i]] = storage.count(classes[i])

    return jsonify({'LinkHub stats': stats}), 200


@endpoints.route('/tags/delete-tags', methods=['DELETE'])
@auth.secured
def delete_unused_tags():
    """Deletes tags not associated with any resource or repository"""
    storage.delete_unused_tags()
    return jsonify({}), 200


@endpoints.route('/api', methods=['GET'])
def supported_endpoints():
    """Get supported LinkHub API supported endpoints"""
    # Construct a dictionary with information about supported endpoints
    endpoints_info = {
        'LinkHub API endpoints': {
            '/users': {
                'GET': 'Returns a list of all LinkHub users',
                'POST': 'Creates a new user and adds them to the database',
                '/{username}': {
                    'GET': 'Returns a user with public information: username, id, created_at, updated_at, and bio',
                    'PUT': 'Update/replace user information',
                    'DELETE': 'Delete user and all their associated data: repositories and resources'
                },
                '/{username}/repos': {
                    'GET': 'Returns a list of all repositories owned by the user with a given username',
                    'POST': 'Create new repositories owned by the user'
                }
            },
            '/repos': {
                'GET': 'Returns a list of all repositories',
                '/{owner}/{repo_name}': {
                    'GET': 'Returns a repository given a repository’s name and owner’s username',
                    'PUT': 'Updates/replaces a repository given a repository’s name and owner’s username',
                    'DELETE': 'Deletes a repository given a repository’s name and owner’s username',
                    '/tags': 'GET: Returns a list of tags associated with a given repository owned by a given owner'
                },
                '/{owner}/{repo_name}/resources': {
                    'GET': 'Returns a list of all resources from a given repository with provided credentials',
                    'POST': 'Creates a new resource in a given repository with provided credentials'
                }
            },
            '/repositories': {
                'GET': 'Returns a list of all the repositories across the LinkHub database',
                '/{repository_id}': {
                    'GET': 'Returns a repository with a given repository ID from across the LinkHub database'
                }
            },
            '/resources': {
                '/{owner}/{repo_name}': {
                    '/{resource_id}': {
                        'GET': 'Returns a list of all the tags associated with a resource with the provided ID',
                        'POST': 'Creates/adds tags to a resource given the resource ID',
                        '/{tag_name}': {
                            'DELETE': 'Removes tags from a given resource provided the ID'
                        }
                    },
                    'GET': 'Returns a list of all resources owned by a repository with given credentials',
                    'POST': 'Creates a new resource in a repository with given credentials',
                    '/{resource_id}': {
                        'PUT': 'Updates/replaces a resource in a given repository provided the resource ID',
                        'DELETE': 'Deletes a resource from a given repository provided the resource ID'
                    }
                },
                'GET': 'Returns a list of all the resources across the LinkHub database',
                '/{resource_id}': {
                    'GET': 'Returns a resource from the LinkHub database provided the resource ID'
                }
            },
            '/tags/clear-tags': {
                'DELETE': 'Deletes all unused tags (tags not linked to any repository or resource)'
            },
            '/token': {
                'GET': 'Returns a token to be used to authenticate users to the API service'
            },
            '/status': {
                'GET': 'Returns the API status - OK'
            },
            '/api': {
                'GET': 'Returns a list of all supported endpoints'
            }
        }
    }
    return jsonify(endpoints_info), 200
