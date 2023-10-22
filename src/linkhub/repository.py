"""
This module defines a repository class for organizing and managing resources.

In the LinkHub application, the 'Repository' class allows users to create,
manage, and organize collections of resources, such as links or references.
Users can create repositories, assign them relevant names
(e.g., 'Game Development,' 'Machine Learning'), and group related resources
within them.

Key Features:
- Creation and management of repositories to organize resources.
- Repository names provide meaningful categorization (e.g., 'Web Development).
- Resources can be associated with specific repositories.
- Supports efficient organization and retrieval of resources.

Usage Example:
1. Create a repository for 'Game Development.'
2. Add links to game development tutorials and resources to the repository.
3. Quickly access and manage all game development-related resources.

Author: Paul John
"""
from sqlalchemy import Column, Table
from sqlalchemy.orm import relationship
from sqlalchemy import String, ForeignKey

from linkhub.user import User
from linkhub.linkhub_base import LinkHubBase, Base


# Create an association table for repository and tags
repository_tag_association = Table(
        'repository_tag_association',
        Base.metadata,
        Column('repository_id', String(36), ForeignKey('repositories.id')),
        Column('tag_id', String(36), ForeignKey('tags.id'))
        )


class Repository(LinkHubBase, Base):
    """Defines 'Repository' class for organizing and managing resources"""
    __tablename__ = 'repositories'
    name = Column(String(60), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'),
                     nullable=False)
    user = relationship('User', back_populates='repositories')
    resources = relationship('Resource', back_populates='repository',
                             cascade='all, delete-orphan')
    tags = relationship('Tag', secondary='repository_tag_association',
                        back_populates='tags')

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
        self.name = name
        self.user = user

    def __str__(self):
        """String representation of the Repository class"""
        return "[Repository] (id='{}', name='{}')".format(self.id, self.name)
