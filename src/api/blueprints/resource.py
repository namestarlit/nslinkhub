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


@endpoints.route('/repos/<owner>/<repo_name>/resources', methods=['GET'])
@auth.token_required
def get_repo_resources(owner, repo_name):
    pass


@endpoints.route('/repos/<owner>/<repo_name>/resources/<resource_id>',
                 methods=['GET'])
@auth.token_required
def get_repo_resource_by_id(owner, repo_name, resource_id):
    pass


@endpoints.route('/repos/<owner>/<repo_name>/resources', methods=['POST'])
@auth.token_required
def create_resource(owner, repo_name):
    pass


@endpoints.route('/repos/<owner>/<repo_name>/resources/<resource_id>',
                 methods=['PUT'])
@auth.token_required
def update_resource(owner, repo_name, resource_id):
    pass


@endpoints.route('/repos/<owner>/<repo_name>/resources/<resource_id>',
                 methods=['DELETE'])
@auth.token_required
def delete_resource(owner, repo_name, resource_id):
    pass


@endpoints.route('/resources', methods=['GET'])
def get_resources():
    pass


@endpoints.route('/resources/<resource_id>', methods=['GET'])
def get_resource_by_id(resource_id):
    pass
