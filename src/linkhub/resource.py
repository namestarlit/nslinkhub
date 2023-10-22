"""
This module defines a 'Resource' class for creating link resources.

In the LinkHub application, the 'Resource' class is used exclusively
for creating link resources. It allows users to define and manage
link resources with essential fields such as URLs and titles.

Key Features:
- Creation and management of link resources.
- Assign unique identifiers for each link resource.
- Set titles and URLs for easy access.
- Streamlined functionality for working with link data.

Author: Paul John
"""
from sqlalchemy import Table
from sqlalchemy.orm import relationship
from sqlalchemy import Column, String, ForeignKey

from linkhub.repository import Repository
from linkhub.linkhub_base import LinkHubBase, Base


# Create an association table for resources and tags
resource_tag_association = Table(
        'resource_tag_association',
        Base.metadata,
        Column('resource_id', String(36), ForeignKey('resources.id')),
        Column('tag_id', String(36), ForeignKey('tags.id'))
        )


class Resource(LinkHubBase, Base):
    """Defines a 'Resource' class for creating link resources"""
    __tablename__ = 'resources'
    title = Column(String(128), nullable=False)
    url = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    repository_id = Column(String(36),
                           ForeignKey('repositories.id', ondelete='CASCADE'),
                           nullable=False)
    repository = relationship('Repository', back_populates='resources')
    tags = relationship('Tag', secondary='resource_tag_association',
                        back_populates='resources')

    def __init__(self, title, url, repository: Repository, *args, **kwargs):
        """Initializes an instance of Resource class

        Args:
            title (str): The title of the resource/link
            url (str): The URL to the
            repository (cls: Repository): An instance of a Repository class
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.
        """
        # Check if repository is None or a Repository instance
        if not isinstance(repository, Repository):
            raise TypeError("repository must be a Repository instance")

        super().__init__(*args, **kwargs)
        self.title = title
        self.url = url
        self.repository = repository

    def __str__(self):
        """String representation of the Resource class"""
        return ("[Resource] (id='{}', title='{}', URL='{}')"
                .format(self.id, self.title, self.url))
