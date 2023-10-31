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
from flask import request
from flask import jsonify

from api import auth
from api import limiter
from linkhub import storage
from api.blueprints import endpoints


@endpoints.route('/user/register', methods=['POST'])
@limiter.limit("2 per month")
def register_user():
    """Register a new user to LinkHub"""
    # Impelment user registration logic
    # 1. Create User
    # 2. Generate user token
    # 3. Send token to their email address (this plays as part of the email verification)
    # 4. User used the token to access the API

    return jsonify({'message': 'This method is yet to be implemented'}), 202


@endpoints.route('/token', methods=['GET'])
@auth.basic_auth_required
def get_token():
    """Get JWT token"""
    # User authentication passed, generate and return the token
    username = request.authorization.username
    token = auth.generate_auth_token(username)
    return jsonify({'token': token}), 200


@endpoints.route('/status', methods=['GET'])
def api_status():
    """Get API Status"""
    return jsonify({'status': 'OK'}), 200


@endpoints.route('/stats', methods=['GET'])
@auth.token_required
def linkhub_stats():
    """Get total number/stats of each LinkHub class objects"""
    classes = ['User', 'Repository', 'Resource', 'Tag']
    keys = ['users', 'repositories', 'resources', 'tags']

    stats = {}
    for i in range(len(classes)):
        stats[keys[i]] = storage.count(classes[i])

    return jsonify(stats), 200


@endpoints.route('/', methods=['GET'])
@auth.token_required
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
                        '/{tag_id}': {
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
