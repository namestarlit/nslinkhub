"""
This module defines a 'Tag' class for managing tags.

In the LinkHub application, the 'Tag' class is used to create and manage
tags that can be associated with various entities, such as resources and
repositories. Tags help organize and categorize these entities.

Author: Paul John

"""
import re

from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from linkhub.linkhub_base import Base, LinkHubBase
from linkhub.repository import repository_tags
from linkhub.resource import resource_tags


class Tag(LinkHubBase, Base):
    """Defines a Tag class for managing tags"""

    __tablename__ = "tags"
    name = Column(String(32), unique=True, index=True, nullable=False)
    repositories = relationship(
        "Repository", secondary="repository_tags", back_populates="tags"
    )
    resources = relationship(
        "Resource", secondary="resource_tags", back_populates="tags"
    )

    def __init__(self, name, *args, **kwargs):
        """Initializes an instance of a Tag class.

        Args:
            name (str): The name of the tag.
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.

        """
        super().__init__(*args, **kwargs)
        self.set_name(name)

    def __str__(self):
        """String representation of the Tag class"""
        return "[Tag] (id='{}', name='{}')".format(self.id, self.name)

    def set_name(self, name):
        """Setter for tag name property"""
        if not self.is_valid_tag_name(name):
            raise ValueError("invalid tag name")
        self.name = name

    def is_valid_tag_name(self, tag_name):
        """Validate a tag name using a regular expression"""
        pattern = r"^[a-zA-Z0-9]+$"
        return bool(re.match(pattern, tag_name))
