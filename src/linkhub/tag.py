"""
This module defines a 'Tag' class for managing tags.

In the LinkHub application, the 'Tag' class is used to create and manage
tags that can be associated with various entities, such as resources and
repositories. Tags help organize and categorize these entities.

Key Features:
- Creation and management of tags.
- Tags can be associated with resources and repositories.
- Provides a flexible way to categorize and organize content.

Author: Paul John
"""
from sqlalchemy import Column
from sqlalchemy import String
from sqlalchemy.orm import relationship

from linkhub.linkhub_base import LinkHubBase, Base
from linkhub.resource import resource_tag_association
from linkhub.repository import repository_tag_association

class Tag(LinkHubBase, Base):
    """Defines a Tag class for managing tags"""
    __tablename__ = 'tags'
    name = Column(String(32), unique=True, nullable=False)

    # Define the relationship to resources and repositories
    resources = relationship('Resource',
                             secondary=resource_tag_association,
                             backref='tags')
    repositories = relationship('Repository',
                                secondary=repository_tag_association,
                                backref='tags')

    def __init__(self, name, *args, **kwargs):
        """Initializes an instance of a Tag class.

        Args:
            name (str): The name of the tag.
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.
        """
        super().__init__(*args, **kwargs)
        self.name = name
