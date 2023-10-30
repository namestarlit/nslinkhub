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
from flask import jsonify
from flask import request, abort

from api import log
from api import auth
from api import util
from api import validate
from linkhub import storage
from api.blueprints import endpoints
from linkhub.repository import Repository


@endpoints.route('/repositories', methods=['GET'])
def get_repositories():
    """Retrives a list of all repositories from linkhub"""
    try:
        repositories = storage.all(Repository).values()
    except Exception as e:
        log.logerror(e, send_email=True)
        abort(500, 'Internal Server Error')

    # Append repositories to repositories list
    repositories_list = []

    for repository in repositories:
        repositories_list.append(repository.to_optimized_dict())

    return jsonify({'Repositories': repositories_list}), 200
