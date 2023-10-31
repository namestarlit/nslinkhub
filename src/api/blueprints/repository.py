"""
API Module: Repositories

This module defines the endpoints related to repositories in the LinkHub API.

Endpoints:
- GET /users/{owner}/repos:
  Returns a list of all repositories owned by a given owner
  (identified by username).
- POST /users/{owner}/repos:
  Creates a new repository belonging to the given owner
  (identified by username).
- GET /repos/{owner}/{repo_name}:
  Returns a repository given a repository’s name and owner’s username.
- PUT /repos/{owner}/{repo_name}:
  Updates/replaces a repository given a repository’s name and owner’s
  username.
- DELETE /repos/{owner}/{repo_name}:
  Deletes a repository given a repository’s name and owner’s username.

/repos/{owner}/{repo_name}/resources
- GET: Returns a list of all resources from a repository
  with provided credentials.
- POST: Creates a new resource in a given repository with
  provided credentials.

- GET /repositories:
  Returns a list of all the repositories across the LinkHub database.
- GET /repositories/{repository_id}:
  Returns a repository with a given repository ID from across
  the LinkHub database.

Author: Paul John

"""
from flask import request, abort
from flask import jsonify, make_response

from api import log
from api import auth
from api import util
from api import validate
from linkhub import storage
from api.blueprints import endpoints
from linkhub.repository import Repository


@endpoints.route('/users/<owner>/repos', methods=['GET'])
@auth.token_required
def get_user_repos(owner):
    """Retrives a list of repositories owned by a user

    Args:
        owner (str): repositories owner's username
    """
    try:
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User not Found')
    try:
        # Get user's repositories list
        user_repos = user.repositories
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # check if there are no repositories
    if not user_repos:
        return jsonify({}), 200

    # Append user repos to a repos list
    repos_list = []

    for repo in user_repos:
        repos_list.append(repo.to_optimized_dict())

    return jsonify({'Repositories': repos_list}), 200


@endpoints.route('/repos/<owner>/<repo_name>', methods=['GET'])
@auth.token_required
def get_repository_by_name(owner, repo_name):
    """Retrives user's repository by name"""
    try:
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(3, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

    # Get repository requested
    try:
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if repo is None:
        abort(404, 'Repository Not Found')

    # Check the If-Modified-Since header
    if 'If-Modified-Since' in request.headers:
        modified_since = request.headers['If-Modified-Since']

        # check if a resource has been modified
        if not util.is_modified_since(repo.updated_at, modified_since):
            return make_response('', 304)

    # Add Last-Modified Header to the response
    response = jsonify({'Repository': repo.to_optimized_dict()})
    response.headers['Last-Modified'] = util.last_modified(repo.updated_at)

    return response, 200


@endpoints.route('/users/<owner>/repos', methods=['POST'])
@auth.token_required
def create_repository(owner):
    """Creates a repository owned by user

    Args:
        owner (str): repository owner's username
    """
    repo_info = request.get_json()

    # Handle possible errors
    error_info = None

    if 'name' not in repo_info:
        error_info = {
                'code': 400,
                'message': 'repository name not provided'
                }

    if error_info is not None:
        return jsonify({'error': error_info}), 400

    # Get user from database
    try:
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

    # Check if user owns the repository
    if not auth.is_authorized(user.id):
        abort(403, 'Forbidden')

    # check if repository name is available and valid
    repo_name = repo_info.get('name')
    if not validate.is_repo_name_valid(repo_name):
        return jsonify(
                {'message': 'invalid repository name: '
                 'repository name can only contain lowercase letters, '
                 'uppercase letters, numbers, and hypen (-)'}
                ), 409
    if not validate.is_repo_available(user.username, repo_name):
        return jsonify({'message': 'repository name already exists'}), 409

    try:
        # Create the repository
        new_repo = Repository(user=user, **repo_info)
        storage.new(new_repo)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location Header to the reponse
    response = jsonify({'Repository': new_repo.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_repository_by_name',
            owner=user.username, repo_name=new_repo.name
            )
    response.headers['Location'] = location_url

    return response, 201


@endpoints.route('/repos/<owner>/<repo_name>', methods=['PUT'])
@auth.token_required
def update_repository(owner, repo_name):
    """Updates repository information"""
    # Get repository data
    repo_info = request.get_json()

    # Handle possible errors
    if not repo_info:
        abort(415, 'Not JSON')

    try:
        # Get user if they exist
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

    # Check if user is the owner of the repository or admin
    if not auth.is_authorized(user.id):
        abort(403, 'Forbidden')

    try:
        # Get the repository if it exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if repo is None:
        abort(404, 'Repository Not Found')

    # Check if repository name is available and valid
    if 'name' in repo_info:
        new_repo_name = repo_info.get('name')
        if repo_name != new_repo_name:
            if not validate.is_repo_name_valid(new_repo_name):
                return jsonify(
                        {'message': 'invalid repository name: '
                         'repository name can only contain lowercase letters, '
                         'uppercase letters, numbers, and hypen (-)'}
                        ), 409
            if not validate.is_repo_available(user.username, new_repo_name):
                return jsonify(
                        {'message': 'repository name already exists'}
                        ), 409

    try:
        # Update repository info
        for key, value in repo_info.items():
            if key not in ['id', 'created_at', 'updated_at']:
                setattr(repo, key, value)
        repo.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location header to the response
    response = jsonify({'Repository': repo.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_repository_by_name',
            owner=user.username, repo_name=repo.name
            )
    response.headers['Location'] = location_url

    return response, 200


@endpoints.route('/repos/<owner>/<repo_name>', methods=['DELETE'])
@auth.token_required
def delete_repository(owner, repo_name):
    """Deletes a repository"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

    # Check if user is authorized
    if not auth.is_authorized(user.id):
        abort(403, 'Forbidden')

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if repo is None:
        abort(404, 'Repository Not Found')

    try:
        # Delete repository
        storage.delete(repo)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    return jsonify({}), 200


@endpoints.route('/repositories', methods=['GET'])
def get_repositories():
    """Retrives a list of all repositories from linkhub"""
    try:
        repositories = storage.all(Repository).values()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # check if repositories do not exist
    if not repositories:
        return jsonify({}), 200

    # Append repositories to repositories list
    repositories_list = []

    for repository in repositories:
        repositories_list.append(repository.to_optimized_dict())

    return jsonify({'Repositories': repositories_list}), 200
