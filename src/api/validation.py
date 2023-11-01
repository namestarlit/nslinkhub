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
from api import log
from linkhub import storage
from email_validator import validate_email
from email_validator import EmailNotValidError


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
        try:
            emailinfo = validate_email(email,
                                       check_deliverability=deliverability)
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
        # Define a regular expression pattern for a valid URL
        url_pattern = r'^(https?|ftp)://[^\s/$.?#].[^\s]*$'

        # Use re.match to check if the link matches the pattern
        return bool(re.match(url_pattern, url))

    def is_username_valid(self, username):
        """Checks if a username is of valid format

        Args:
            username (str): The username to check

        Returns:
            bool: True if valid, False otherwise
        """
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
        # Allow alphanumeric characters, hyphens, and underscores
        pattern = "^[a-zA-Z0-9-]+$"
        return bool(re.match(pattern, repo_name))

    def is_username_available(self, username):
        """Checks if a username is available

        Checks a provided username against the database
        to see if it does not exists in the database

        Args:
            username (str): The username to check

        Returns:
            bool: True if does not exist, False otherwise

        """
        try:
            user = storage.get_user_by_username(username)
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, 'Internal Server Error')
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
        try:
            user = storage.get_user_by_email(email)
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, 'Internal Server Error')
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
        try:
            user = storage.get_user_by_username(username)
            # Check if user doesn't exist
            if user is None:
                return False

            # Convert repo_name to lowercase
            repo_name_lower = repo_name.lower()

            # Check if repository exists
            for repo in user.repositories:
                if repo.name.lower() == repo_name_lower:
                    return False

            return True
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, 'Internal Server Error')

    def is_resource_available(self, repo_id, resource_url):
        """Checks if a resource already exists in a repository

        Args:
            repo_id (str): The resource's Repository ID
            resource_id (str): The resource URL to check

        Returns:
            bool: True if does not exist, False otherwise

        """
        try:
            # Get repository
            repo = storage.get('Repository', repo_id)
            if repo is None:
                return False

            for resource in repo.resources:
                if resource.url == resource_url:
                    return False

            return True
        except Exception as e:
            log.logerror(e, send_email=True)
            abort(500, 'Internal Server Error')
