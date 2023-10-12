"""
This module define a 'Tag' class
"""
from linkhub.linkhub_bas import LinkHubBase, Base


class Tag(LinkHubBase, Base):
    """Defines a Tag class for managing tags"""
    __tablename__ = 'tags'
    name = Column(String(32), unique=True, nullable=False)

    def __init__(self, name, *args, **kwargs):
        """Initializes an instance of a Tag class.

        Args:
            name (str): The name of the tag.
            *args: Additional non-keyword arguments.
            **kwargs: Additional keyword arguments.
        """
        super().__init__(*args, **kwargs)
        self.name = name
