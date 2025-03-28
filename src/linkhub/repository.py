"""
This module defines a repository class for organizing and managing resources.

In the LinkHub application, the 'Repository' class allows users to create,
manage, and organize collections of resources, such as links or references.
Users can create repositories, assign them relevant names
(e.g., 'Game Development,' 'Machine Learning'), and group related resources
within them.

Author: Paul John

"""

import re

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import relationship

from linkhub.linkhub_base import Base, LinkHubBase
from linkhub.user import User

# Create an association table for repository and tags
repository_tags = Table(
    "repository_tags",
    Base.metadata,
    Column("repository_id", String(36), ForeignKey("repositories.id")),
    Column("tag_id", String(36), ForeignKey("tags.id")),
)


class Repository(LinkHubBase, Base):
    """Defines 'Repository' class for organizing and managing resources"""

    __tablename__ = "repositories"
    name = Column(String(60), index=True, nullable=False)
    description = Column(String(255), nullable=True)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    user = relationship("User", back_populates="repositories")
    resources = relationship(
        "Resource",
        back_populates="repository",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tags = relationship(
        "Tag", secondary="repository_tags", back_populates="repositories"
    )

    def __init__(self, name, user: User, *args, **kwargs):
        """Initializes an instance of Repository class

        Args:
            name (str): The name of the repository
            user (cls: User): An instance of a User class
            description (str): The description of the repository
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.

        """
        # Check if user is a User instance
        if not isinstance(user, User):
            raise TypeError("user must be a User instance")

        super().__init__(*args, **kwargs)
        self.set_name(name)
        self.user = user

    def __str__(self):
        """String representation of the Repository class"""
        return "[Repository] (id='{}', name='{}')".format(self.id, self.name)

    def set_name(self, repo_name):
        """Setter method for the repository's name property

        Args:
            repo_name (str): The name of the repository
        """
        if not self.is_valid_repo_name(repo_name):
            raise ValueError("Invalid repository name")
        self.name = repo_name

    def is_valid_repo_name(self, repo_name):
        """Check if the provided repository name is of valid format"""
        # Allow alphanumeric characters, hyphens, and underscores
        pattern = "^[a-z0-9-]+$"
        return bool(re.match(pattern, repo_name))
