"""
API Module: Tags

This module defines the endpoints related to managing tags associated with
resources in the LinkHub API.

Endpoints:
- GET /repos/{owner}/{repo_name}/resources/{resource_id}/tags:
  Returns a list of all the tags associated with a resource with the provided ID.
- POST /repos/{owner}/{repo_name}/resources/{resource_id}/tags:
  Creates/adds tags to a resource given the resource ID.
- DELETE /repos/{owner}/{repo_name}/resources/{resource_id}/tags/{tag_id}:
  Removes tags from a given resource provided the ID.

Note: The PUT method is not provided in the resources because tags are meant
only to be created, added, and removed from repositories and resources.

Author: Paul John

"""

# Your module code here

