"""
This module defines a 'Resource' class for creating link resources.

In the LinkHub application, the 'Resource' class is used exclusively
for creating link resources. It allows users to define and manage
link resources with essential fields such as URLs and titles.

Author: Paul John

"""

import re

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import relationship

from linkhub.linkhub_base import Base, LinkHubBase
from linkhub.repository import Repository

# Create an association table for resources and tags
resource_tags = Table(
    "resource_tags",
    Base.metadata,
    Column("resource_id", String(36), ForeignKey("resources.id")),
    Column("tag_id", String(36), ForeignKey("tags.id")),
)


class Resource(LinkHubBase, Base):
    """Defines a 'Resource' class for creating link resources"""

    __tablename__ = "resources"
    title = Column(String(128), nullable=False)
    url = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    repository_id = Column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False
    )
    repository = relationship("Repository", back_populates="resources")
    tags = relationship("Tag", secondary="resource_tags", back_populates="resources")

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
        self.set_url(url)
        self.repository = repository

    def __str__(self):
        """String representation of the Resource class"""
        return "[Resource] (id='{}', title='{}', url='{}')".format(
            self.id, self.title, self.url
        )

    def set_url(self, url):
        """Setter method for the url property, with URL format validation"""
        if not self.is_valid_url(url):
            raise ValueError("Invalid URL format")
        self.url = url

    def is_valid_url(self, url):
        """Check if the provided URL has a valid format"""
        # A basic URL format validation using regular expression
        url_pattern = r"^(https?|ftp)://[^\s/$.?#].[^\s]*$"
        return bool(re.match(url_pattern, url))
