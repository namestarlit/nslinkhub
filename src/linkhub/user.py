"""
This module defines a 'User' class for managing user data.

In the LinkHub application, the 'User' class is responsible for managing
user profiles and their associated information. It provides the functionality
to create and maintain user data with essential fields such as usernames,
email addresses, and user IDs.

Key Features:
- Creation and management of user profiles.
- Assign unique user identifiers and usernames.
- Store user email addresses and additional user-specific data.
- Facilitates user data management within the LinkHub platform.

Author: Paul John

"""
import re
import bcrypt
from sqlalchemy import Column
from sqlalchemy import String
from sqlalchemy.orm import relationship

from linkhub.linkhub_base import LinkHubBase, Base


class User(LinkHubBase, Base):
    """Defines a User class for managing user data"""
    __tablename__ = "users"
    username = Column(String(60), unique=True, index=True, nullable=False)
    __email = Column('email', String(100), unique=True, nullable=False)
    __password = Column('password', String(64), nullable=False)
    bio = Column(String(255), nullable=True)
    repositories = relationship('Repository', back_populates='user',
                                cascade='all, delete-orphan',
                                passive_deletes=True)

    def __init__(self, username, email, password, *args, **kwargs):
        """Initializes an instance of User class
        Args:
            username (str): The username of the user
            email (str): The email of the user
            password (str): The password hash of the user password
            bio (str): The short description of the user
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.
        """
        super().__init__(*args, **kwargs)
        self.username = set_username(username)
        self.email = email
        self.password = password

    def __str__(self):
        """String representation of the User class"""
        return "[User] (id='{}', username='{}')".format(self.id, self.username)

    def set_username(self, username):
        """Setter for the username property

        Args:
            username (str): User's username
        """
        if not self.is_valid_username(username):
            raise ValueError('Invalid username')
        self.username = username

    def is_valid_username(self, username):
        """Check if the provided username is of valid format"""
        # Only allow alphanumeric characters and underscores
        pattern = "^[a-z0-9_]+$"
        return bool(re.match(pattern, username))

    @property
    def email(self):
        """Getter for the email property"""
        return self.__email

    @email.setter
    def email(self, new_email):
        """Setter for the email property, with email format validation"""
        if not self.is_valid_email(new_email):
            raise ValueError('Invalid email format')
        self.__email = new_email

    def is_valid_email(self, email):
        """Check if the provided email has a valid format"""
        # A basic email format validation using regular expressions
        email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        return bool(re.match(email_pattern, email))

    @property
    def password(self):
        """Getter for the password property"""
        return self.__password

    @password.setter
    def password(self, new_password):
        """Setter for the password property

        Args:
            new_password (str): password attribute
        Returns:
            str: hashed password
        """
        # Hashes the provided password and stores it
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), salt)
        self.__password = hashed_password

    def check_password(self, password):
        """Verify a provided password against the stored hash"""
        if self.__password:
            hashed_password = self.__password.encode('utf-8')
            password = password.encode('utf-8')
            return bcrypt.checkpw(password, hashed_password)
        return False

    def change_password(self, new_password):
        """Change the user's password to a new one"""
        # This will automatically call the setter
        self.password = new_password
