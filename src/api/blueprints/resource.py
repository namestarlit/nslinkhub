"""
API Module: Resources

This module defines the endpoints related to managing resources
in the LinkHub API.

Endpoints:
- GET /repos/{owner}/{repo_name}/resources:
  Returns a list of all resources owned by a repository with given credentials.
- GET /repos/{owner}/{repo_name}/resources/{resource_id}
  Returns a resource with the provided resource ID
- POST /repos/{owner}/{repo_name}/resources:
  Creates a new resource in a repository with given credentials.
- PUT /repos/{owner}/{repo_name}/resources/{resource_id}:
  Updates/replaces a resource in a given repository provided the resource ID.
- DELETE /repos/{owner}/{repo_name}/resources/{resource_id}:
  Deletes a resource from a given repository provided the resource ID.

- GET /resources:
  Returns a list of all the resources across the LinkHub database.
- GET /resources/{resource_id}:
  Returns a resource from the LinkHub database provided the resource ID.

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
from linkhub.resource import Resource


@endpoints.route("/repos/<owner>/<repo_name>/resources", methods=["GET"])
@auth.token_required
def get_repo_resources(owner, repo_name):
    """Retrives a list of repository resources"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if user is None:
        abort(404, "User Not Found")

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if repo is None:
        abort(404, "Repository Not Found")

    # Get a list of repository resources
    repo_resources = repo.resources
    if not repo_resources:
        return jsonify({}), 200

    resources_list = []
    for resource in repo_resources:
        resources_list.append(resource.to_optimized_dict())

    return (
        jsonify(
            {
                "owner": user.username,
                "repository": repo.name,
                "resources": resources_list,
            }
        ),
        200,
    )


@endpoints.route("/repos/<owner>/<repo_name>/resources/<resource_id>", methods=["GET"])
@auth.token_required
def get_repo_resource_by_id(owner, repo_name, resource_id):
    """Get repository resource by ID"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if user is None:
        abort(404, "User Not Found")

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if repo is None:
        abort(404, "Repository Not Found")

    try:
        # Get a repository resource by ID
        resource = storage.get_resource_by_id(repo.id, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if resource is None:
        abort(404, "Resource Not Found")

    # Check the If-Modified-Since header
    if "If-Modified-Since" in request.headers:
        modified_since = request.headers["If-Modified-Since"]

        # check if a resource has been modified
        if not util.is_modified_since(resource.updated_at, modified_since):
            return make_response("", 304)

    # Add Last-Modified Header to the response
    response = jsonify(
        {
            "owner": user.username,
            "repository": repo.name,
            "resource": resource.to_optimized_dict(),
        }
    )
    response.headers["Last-Modified"] = util.last_modified(resource.updated_at)

    return response, 200


@endpoints.route("/repos/<owner>/<repo_name>/resources", methods=["POST"])
@auth.token_required
def create_resource(owner, repo_name):
    """Create a new resource"""
    # Get resource data
    resource_data = request.get_json()

    # Handle possible errors
    error_info = None

    if not resource_data:
        abort(415, "Not a JSON")
    if "title" not in resource_data:
        error_info = {"code": 400, "message": "resource title not provided"}
    if "url" not in resource_data:
        error_info = {"code": 400, "message": "resource URL not provided"}

    if error_info is not None:
        return jsonify({"error": error_info}), 400

    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if user is None:
        abort(404, "User Not Found")

    # Check if user is authorized
    if not auth.is_authorized(user.id):
        abort(403, "Forbidden")

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if repo is None:
        abort(404, "Repository Not Found")

    # Check if resource is available and valid
    resource_url = resource_data.get("url")
    if not validate.is_url_valid(resource_url):
        return jsonify({"message": "invalid resource URL"}), 409
    if not validate.is_resource_available(repo.id, resource_url):
        return jsonify({"message": "resource already exists"}), 409

    try:
        new_resource = Resource(repository=repo, **resource_data)
        storage.new(new_resource)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    # Add Location Header to the reponse
    response = jsonify({"resource": new_resource.to_optimized_dict()})
    location_url = util.location_url(
        "endpoints.get_repo_resource_by_id",
        owner=user.username,
        repo_name=repo.name,
        resource_id=new_resource.id,
    )
    response.headers["Location"] = location_url

    return response, 201


@endpoints.route("/repos/<owner>/<repo_name>/resources/<resource_id>", methods=["PUT"])
@auth.token_required
def update_resource(owner, repo_name, resource_id):
    """Updates a resource"""
    # Get resource data
    resource_data = request.get_json()

    # Handle possible errors
    if not resource_data:
        abort(415, "Not a JSON")

    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    # Check if user is authorized
    if user is None:
        abort(404, "User Not Found")

    if not auth.is_authorized(user.id):
        abort(403, "Forbidden")

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if repo is None:
        abort(404, "Repository Not Found")

    try:
        # Get a repository resource by ID
        resource = storage.get_resource_by_id(repo.id, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if resource is None:
        abort(404, "Resource Not Found")

    # Check if resource URL is available and valid
    if "url" in resource_data:
        resource_url = resource_data.get("url")
        if resource_url != resource.url:
            if not validate.is_url_valid(resource_url):
                return jsonify({"message": "invalid resource URL"}), 409
            if not validate.is_resource_available(repo.id, resource_url):
                return jsonify({"message": "resource already exists"}), 409

    try:
        # Update resource data
        for key, value in resource_data.items():
            if key not in ["id", "created_at", "updated_at"]:
                setattr(resource, key, value)
        resource.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    # Add Location Header to the reponse
    response = jsonify({"resource": resource.to_optimized_dict()})
    location_url = util.location_url(
        "endpoints.get_repo_resource_by_id",
        owner=user.username,
        repo_name=repo.name,
        resource_id=resource.id,
    )
    response.headers["Location"] = location_url

    return response, 200


@endpoints.route(
    "/repos/<owner>/<repo_name>/resources/<resource_id>", methods=["DELETE"]
)
@auth.token_required
def delete_resource(owner, repo_name, resource_id):
    """Deletes a resource"""
    try:
        # Get user if exists
        user = storage.get_user_by_username(owner)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if user is None:
        abort(404, "User Not Found")

    # Check if user is authorized
    if not auth.is_authorized(user.id):
        abort(403, "Forbidden")

    try:
        # Get repository if exists
        repo = storage.get_repo_by_name(user.username, repo_name)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if repo is None:
        abort(404, "Repository Not Found")

    try:
        # Get a repository resource by ID
        resource = storage.get_resource_by_id(repo.id, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if resource is None:
        abort(404, "Resource Not Found")

    try:
        # Delete a resource
        storage.delete(resource)
        storage.save()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    return jsonify({}), 200


@endpoints.route("/resources", methods=["GET"])
def get_resources():
    """Retrives a list of all resources from linkhub"""
    try:
        # Get all resources from linkhub
        resources = storage.all(Resource).values()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    # check if resources do not exist
    if not resources:
        return jsonify({}), 200

    # Append resources to resources list
    resources_list = []

    for resource in resources:
        resources_list.append(resource.to_optimized_dict())

    return jsonify({"resources": resources_list}), 200


@endpoints.route("/resources/<resource_id>", methods=["GET"])
def get_resource_by_id(resource_id):
    """Get resource by ID"""
    try:
        # Get resource if exists
        resource = storage.get(Resource, resource_id)
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, "Internal Server Error")

    if resource is None:
        abort(404, "Resource Not Found")

    # Check the If-Modified-Since header
    if "If-Modified-Since" in request.headers:
        modified_since = request.headers["If-Modified-Since"]

        # check if a resource has been modified
        if not util.is_modified_since(resource.updated_at, modified_since):
            return make_response("", 304)

    # Add Last-Modified Header to the response
    response = jsonify({"resource": resource.to_optimized_dict()})
    response.headers["Last-Modified"] = util.last_modified(resource.updated_at)

    return response, 200
