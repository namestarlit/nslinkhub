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
from sqlalchemy.orm import Table
from sqlalchemy.orm import ForeignKey
from sqlalchemy.orm import relationship

from linkhub.tag import Tag
from linkhub.resource import Resource
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
    name = Column(String(60), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    user_id = Column(String(36), ForeignKey('users.id'))
    resources = relationship('Resource', backref='repository')
    tags = relationship('Tag', secondary=repository_tag_association,
                        backref='repositories')

    def __init__(self, name, description=None, *args, **kwargs):
        """Initializes an instance of Repository class

        Args:
            name (str): The name of the repository
            description (str): The description of the repository
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.
        """
        super().__init__(*args, **kwargs)
        self.name = name
        self.description = description
