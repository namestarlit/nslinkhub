"""
API Module: Repository Tags

This module defines the endpoints related to managing tags for
repositories in the LinkHub API.

Endpoints:
- GET /repos/{owner}/{repo_name}/tags:
  Returns a list of tags associated with a given repository owned
  by a given owner.
- POST /repos/{owner}/{repo_name}/tags:
  Creates a new tag for the specified repository.
- DELETE /repos/{owner}/{repo_name}/{tag_name}:
  Deletes a tag associated with the repository.

Author: Paul John

"""
from flask import request, abort
from flask import jsonify, make_response

from api import log
from api import auth
from api import util
from api import validate
from linkhub import storage
from linkhub.tag import Tag
from api.blueprints import endpoints


@endpoints.route('/repos/<owner>/<repo_name>/tags', methods=['GET'])
@auth.token_required
def get_repo_tags(owner, repo_name):
    """Retrives a list of a repository tags"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if repo is None:
        abort(404, 'Repository Not Found')

    repo_tags = repo.tags

    if not repo_tags:
        return jsonify({}), 200

    # Append repository tags to tags list
    tags_list = []

    for tag in repo_tags:
        tags_list.append(tag.name)

    return jsonify(
            {
                'owner': user.username,
                'repository': repo.name,
                'tags': tags_list
                }
            ), 200


@endpoints.route('/repos/<owner>/<repo_name>/tags', methods=['POST'])
@auth.token_required
def create_repo_tag(owner, repo_name):
    """Creates a new repository tag"""
    # Get tag data
    tag_data = request.get_json()

    # Handle possible errors
    error_info = None

    if not tag_data:
        abort(415, 'Not a JSON')
    if 'name' not in tag_data:
        error_info = {
                'code': 400,
                'message': 'tag name not provided'
                }

    if error_info is not None:
        return jsonify({'error': error_info}), 400

    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

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

    # Check if tag name is available and valid
    tag_name = tag_data.get('name')
    if not validate.is_tag_name_valid(tag_name):
        return jsonify(
                {'message': 'invalid tag name: tag name must contain '
                 'only lowercase letters and numbers'}
                ), 409
    if not validate.is_repo_tag_available(repo, tag_name):
        return jsonify({'message': 'tag already exists'}), 409

    try:
        # check if tag is in the database
        tag = storage.get_tag_by_name(tag_name)
        # create a new tag if it doesn't exist
        if tag is None:
            tag = Tag(**tag_data)
            storage.new(tag)

        # Add tag to resource
        repo.tags.append(tag)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location Header to the reponse
    response = jsonify({'tag': tag.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_repo_tags',
            owner=user.username, repo_name=repo.name
            )
    response.headers['Location'] = location_url

    return response, 201


@endpoints.route('/repos/<owner>/<repo_name>/tags/<tag_name>',
                 methods=['DELETE'])
@auth.token_required
def delete_repo_tag(owner, repo_name, tag_name):
    """Deletes a repository tag"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if user is None:
        abort(404, 'User Not Found')

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
        # Get tag to delete
        tag = storage.get_tag_by_name(tag_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if tag is None:
        abort(404, 'Tag Not Found')

    try:
        # Remove tag from repository
        repo.tags.remove(tag)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    return jsonify({}), 200
