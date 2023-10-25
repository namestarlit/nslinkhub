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

from linkhub.resource import resource_tags
from linkhub.repository import repository_tags
from linkhub.linkhub_base import LinkHubBase, Base


class Tag(LinkHubBase, Base):
    """Defines a Tag class for managing tags"""
    __tablename__ = 'tags'
    name = Column(String(32), unique=True, index=True, nullable=False)
    repositories = relationship('Repository',
                                secondary='repository_tags',
                                back_populates='tags')
    resources = relationship('Resource',
                             secondary='resource_tags',
                             back_populates='tags')

    def __init__(self, name, *args, **kwargs):
        """Initializes an instance of a Tag class.

        Args:
            name (str): The name of the tag.
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.
        """
        super().__init__(*args, **kwargs)
        self.name = name

    def __str__(self):
        """String representation of the Tag class"""
        return "[Tag] (id='{}', name='{}')".format(self.id, self.name)
