"""
API Module: Resources

This module defines the endpoints related to managing resources
in the LinkHub API.

Endpoints:
- GET /repos/{owner}/{repo_name}/resources:
  Returns a list of all resources owned by a repository with given credentials.
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

# Your module code here

