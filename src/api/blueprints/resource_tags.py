"""
API Module: Tags

This module defines the endpoints related to managing tags associated with
resources in the LinkHub API.

Endpoints:
- GET /repos/{owner}/{repo_name}/resources/{resource_id}/tags:
  Returns a list of all the tags associated with a resource with the
  provided ID.
- POST /repos/{owner}/{repo_name}/resources/{resource_id}/tags:
  Creates/adds tags to a resource given the resource ID.
- DELETE /repos/{owner}/{repo_name}/resources/{resource_id}/tags/{tag_name}:
  Removes tags from a given resource provided the ID.

Note: The PUT method is not provided in the resources because tags are meant
only to be created, added, and removed from repositories and resources.

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


@endpoints.route('/repos/<owner>/<repo_name>/resources/<resource_id>/tags',
                 methods=['GET'])
@auth.token_required
def get_resource_tags(owner, repo_name, resource_id):
    """Retrives a list of resource tags"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Check if user is authorized
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
        # Get a repository resource by ID
        resource = storage.get_resource_by_id(repo.id, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if resource is None:
        abort(404, 'Resource Not Found')

    # Get resource tags
    resource_tags = resource.tags

    if not resource_tags:
        return jsonify({}), 200

    # Append tags to tags list
    tags_list = []
    for tag in resource_tags:
        tags_list.append(tag.name)

    return jsonify(
            {
                'owner': user.username,
                'repository': repo.name,
                'resource': resource.title,
                'tags': tags_list
                }
            ), 200


@endpoints.route('/repos/<owner>/<repo_name>/resources/<resource_id>/tags',
                 methods=['POST'])
@auth.token_required
def create_resource_tag(owner, repo_name, resource_id):
    """Creates a resource tag"""
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

    # Check if user is authorized
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
        # Get a repository resource by ID
        resource = storage.get_resource_by_id(repo.id, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if resource is None:
        abort(404, 'Resource Not Found')

    # Check if tag name is available and valid
    tag_name = tag_data.get('name')
    if not validate.is_tag_name_valid(tag_name):
        return jsonify(
                {'message': 'invalid tag name: tag name must contain '
                 'only lowercase letters and numbers'}
                ), 409
    if not validate.is_resource_tag_available(resource, tag_name):
        return jsonify({'message': 'tag already exists'}), 409

    try:
        # check if tag is in the database
        tag = storage.get_tag_by_name(tag_name)
        # create a new tag if it doesn't exist
        if tag is None:
            tag = Tag(**tag_data)
            storage.new(tag)

        # Add tag to resource
        resource.tags.append(tag)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Add Location Header to the reponse
    response = jsonify({'tag': tag.to_optimized_dict()})
    location_url = util.location_url(
            'endpoints.get_resource_tags',
            owner=user.username, repo_name=repo.name,
            resource_id=resource.id
            )
    response.headers['Location'] = location_url

    return response, 201


@endpoints.route(
        '/repos/<owner>/<repo_name>/resources/<resource_id>/tags/<tag_name>',
        methods=['DELETE'])
@auth.token_required
def delete_resource_tag(owner, repo_name, resource_id):
    """Deletes a resource tag"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Check if user is authorized
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
        # Get a repository resource by ID
        resource = storage.get_resource_by_id(repo.id, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if resource is None:
        abort(404, 'Resource Not Found')

    try:
        # Get tag to delete
        tag = storage.get_tag_by_name(tag_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    if tag is None:
        abort(404, 'Tag Not Found')

    try:
        # Remove tag fro resource
        resource.tags.remove(tag)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    return jsonify({}), 200
