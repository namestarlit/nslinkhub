"""
Checks validity and availability of linkhub resources

Contains a Class with methods to check the availability
of different LinkHub resources fields like username, email
and repository names. Also the validity of fields like email.

Author: Paul John
"""
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
            raise e
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
            raise e
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
        except Exception as e:
            raise e
        else:
            if user is not None:
                for repo in user.repositories:
                    if repo.name == repo_name:
                        return False
                    break

            # Return False if user doesn't exist
            if user is None:
                return False
            return True
