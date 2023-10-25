"""
API Module: Users

This module defines the endpoints related to users in the LinkHub API.

Endpoints:
- GET /users:
  Returns a list of all LinkHub users.
- POST /users:
  Creates a new user and adds them to the database.
- GET /users/{username}:
  Returns a user with public information: username, id, created_at, updated_at, and bio.
- PUT /users/{username}:
  Update/replace user information.
- DELETE /users/{username}:
  Delete a user and all their associated data, including repositories and resources.

/users/{username}/repos
- GET: Returns a list of all repositories owned by the user with the given username.
- POST: Create new repositories owned by the user.

Submodules:
- auth: Contains authentication and authorization related methods.
- storage: Contains database data management methods to work with database.

Author: Paul John

"""

# Your module code here

