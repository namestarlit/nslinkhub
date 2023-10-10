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
import bcrypt
from sqlalchemy.orm import relationship

from linkhub.repository import Repository
from linkhub.linkhub_base import LinkHubBase, Base


class User(LinkHubBase, Base):
    """Defines a User class for managing user data"""
    __tablename__ = "users"
    username = Column(String(25), unique=True, nullable=False)
    email = Column(String(60), unique=True, nullable=False)
    __password = Column("password", String(60), nullable=False)
    bio = Column(String(256), nullable=True)
    repositories = relationship('Repository', backref='user')

    def __init__(self, username, email, password, bio=None):
        """Initializes an instance of User class"""
        self.username = username
        self.email = email
        self.bio = bio
        self.password = password

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
        return bcrypt.checkpw(password.encode('utf-8'), self.__password)

    def change_password(self, new_password):
        """Change the user's password to a new one"""
        # This will automatically call the setter
        self.password = new_password
