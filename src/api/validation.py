"""
Resource Validation and Availability Checks for LinkHub

The 'Validate' class provides a set of methods for checking the validity and
availability of various LinkHub resources, such as email addresses, usernames,
and repository names. These methods ensure that the resources are valid and
available for use within the LinkHub application.

Key Methods:
- 'is_email_valid': Checks the validity and optionally deliverability
   of an email address.
- 'is_username_available': Verifies if a username is available
   and not already in use.
- 'is_email_available': Determines if an email address is available
   for registration.
- 'is_repo_available': Checks the availability of a repository name
   for a specific user.
- 'is_url_valid': Checks if the URL format of a provided URL is valid

Author: Paul John

"""

import re

from email_validator import EmailNotValidError, validate_email
from flask import abort

from api import log
from linkhub import storage
from linkhub.repository import Repository
from linkhub.resource import Resource


class Validate:
    """A Validate class containing validation methods"""

    def is_email_valid(self, email, deliverability=False):
        """Checks if an email address is valid

        Checks the format of the email address. If deliverability
        is set to True, it checks if the email is available too.

        Args:
            email (str): The email address to check
            deliverability (bool): Check the availability of the email address

        Returns:
            bool: True if email is valid, False otherwise

        """
        if not isinstance(email, str):
            raise TypeError("email address must be a string")
        if not isinstance(deliverability, bool):
            raise TypeError("deliverability must be a True or False")

        try:
            validate_email(email, check_deliverability=deliverability)
        except EmailNotValidError:
            return False
        else:
            return True

    def is_url_valid(self, url):
        """Checks if the url is of valid format

        Args:
            url (str): The url to check it's validity

        Returns:
            bool: True if valid, False otherwise

        """
        if not isinstance(url, str):
            raise TypeError("url must be a string")

        # Define a regular expression pattern for a valid URL
        url_pattern = r"^(https?|ftp)://[^\s/$.?#].[^\s]*$"

        # Use re.match to check if the link matches the pattern
        return bool(re.match(url_pattern, url))

    def is_username_valid(self, username):
        """Checks if a username is of valid format

        Args:
            username (str): The username to check

        Returns:
            bool: True if valid, False otherwise

        """
        if not isinstance(username, str):
            raise TypeError("username must be a string")

        # Only allow alphanumeric characters and underscores
        pattern = "^[a-z0-9_]+$"
        return bool(re.match(pattern, username))

    def is_repo_name_valid(self, repo_name):
        """checks if the repository name is of valid format

        Args:
            repo_name (str): The repository name to check

        Returns:
            bool: True if valid, False otherwise

        """
        if not isinstance(repo_name, str):
            raise TypeError("repository name must be a string")

        # Allow alphanumeric characters, hyphens, and underscores
        pattern = "^[a-z0-9-]+$"
        return bool(re.match(pattern, repo_name))

    def is_tag_name_valid(self, tag_name):
        """Validate a tag name using a regular expression"""
        if not isinstance(tag_name, str):
            raise TypeError("tag name must be a string")

        pattern = r"^[a-zA-Z0-9]+$"
        return bool(re.match(pattern, tag_name))

    def is_username_available(self, username):
        """Checks if a username is available

        Checks a provided username against the database
        to see if it does not exists in the database

        Args:
            username (str): The username to check

        Returns:
            bool: True if does not exist, False otherwise

        """
        if not isinstance(username, str):
            raise TypeError("username must be a string")

        try:
            user = storage.get_user_by_username(username)
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, "Internal Server Error")
        else:
            if user is None:
                return True
            return False

    def is_email_available(self, email):
        """Checks if an email address is available

        Checks the availability of an email address
        by checking if a user owns desired email address

        Args:
            email (str): The email to check its availability

        Returns:
            bool: True if email doesn't exist, False otherwise

        """
        if not isinstance(email, str):
            raise TypeError("email address must be a string")

        try:
            user = storage.get_user_by_email(email)
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, "Internal Server Error")
        else:
            if user is None:
                return True
            return False

    def is_repo_available(self, username, repo_name):
        """Checks if a repository name is available

        Checks if a repository name is available per user
        by checking their repositories

        Args:
            username (str): The username of the repository owner
            repo_name (str): The name to check it's availability

        Returns:
            bool: True if repository doesn't exist, False otherwise

        """
        if not isinstance(username, str):
            raise TypeError("username must be a string")
        if not isinstance(repo_name, str):
            raise TypeError("repository name must be a string")

        try:
            user = storage.get_user_by_username(username)
            # Check if user doesn't exist
            if user is None:
                return False

            # Check if repository exists
            for repo in user.repositories:
                if repo.name == repo_name:
                    return False

            return True
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, "Internal Server Error")

    def is_resource_available(self, repo_id, resource_url):
        """Checks if a resource already exists in a repository

        Args:
            repo_id (str): The resource's Repository ID
            resource_id (str): The resource URL to check

        Returns:
            bool: True if does not exist, False otherwise

        """
        if not isinstance(repo_id, str):
            raise TypeError("Repository ID must be a string")
        if not isinstance(resource_url, str):
            raise TypeError("Resource URL must be a string")

        try:
            # Get repository
            repo = storage.get(Repository, repo_id)
            if repo is None:
                return False

            for resource in repo.resources:
                if resource.url == resource_url:
                    return False

            return True
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, "Internal Server Error")

    def is_repo_tag_available(self, repository, tag_name):
        """checks is a tag already exists in a repository

        Args:
            repository (Repository): Repository class object
            tag_name (str): tag name to check

        Returns:
            bool: True if doesn't exist, False otherwise
        """
        if not isinstance(repository, Repository):
            raise TypeError("repository must be a instance of Repository class")
        if not isinstance(tag_name, str):
            raise TypeError("tag name must be a string")

        try:
            # change tag name to lower
            tag_name_lower = tag_name.lower()

            for tag in repository.tags:
                if tag.name.lower() == tag_name_lower:
                    return False

            return True
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, "Internal Server Error")

    def is_resource_tag_available(self, resource, tag_name):
        """checks is a tag already exists in a resource

        Args:
            resource (Resource): Resource class object
            tag_name (str): tag name to check

        Returns:
            bool: True if doesn't exist, False otherwise
        """
        if not isinstance(resource, Resource):
            raise TypeError("Resource must be an instance of Resource class")
        if not isinstance(tag_name, str):
            raise TypeError("tag name must be a string")

        # convert tag name to lower
        tag_name_lower = tag_name.lower()

        try:
            for tag in resource.tags:
                if tag.name.lower() == tag_name_lower:
                    return False

            return True
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, "Internal Server Error")
