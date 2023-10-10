"""
This module defines a base class for common functionality used across modules.

In the LinkHub application, various classes in the 'user', 'repository',
and 'resource' modules inherit from this base class. It encapsulates shared
methods and attributes to promote code reusability and maintainability.

Key Features:
- Common methods and attributes for handling database interactions.
- Provides a foundation for user, repository, and resource classes.
- Encourages consistent data modeling and database operations.

Author: Paul John
"""
from uuid import uuid4
from datetime import datetime
from sqlalchemy import Column, func
from sqlalchemy import DateTime, String
from sqlalchemy.orm import declarative_base

import linkhub

# Base: SQLAlchemy's declarative base for ORM models
Base = declarative_base()


class LinkHubBase:
    """Defines a LinkHubBase class for common functionality across modules"""
    # Define common columns of tables across classes
    id = Column(String(60), primary_key=True, default=str(uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=func.now())

    def __init__(self, *args, **kwargs):
        """Initializes instances of LinkHubBase class.

        Args:
            id (str): A unique identifier.
            created_at (datetime): Creation timestamp.
            updated_at (datetime): Last update timestamp.
            **kwargs (dict): Keyworded parameters for additional attributes.
        """
        # Set a random unique ID to the instance attribute 'id'
        self.id = str(uuid4())

        # Handle additional keyword arguments
        if kwargs:
            ISO_FORMAT = '%Y-%m-%dT%H:%M:%S.%f'
            for key, value in kwargs.items():
                if key == 'created_at' or key == 'updated_at':
                    try:
                        value = datetime.strptime(value, ISO_FORMAT)
                    except ValueError:
                        # Handle datetime string parsing error
                        pass
                if key == '__class__':
                    continue
                setattr(self, key, value)
        else:
            self.created_at = datetime.utcnow()
            self.updated_at = datetime.utcnow()

    def __repr__(self):
        """Formal string representation of the LinkHubBase class."""
        return ("<{}: (id='{}', created_at='{}', updated_at='{}')>"
                .format(self.__class__.__name__,
                        self.id, self.created_at, self.updated_at))

    def __str__(self):
        """String representation of the BaseModel class"""
        return ("[{}] ({}) {}"
                .format(self.__class__.__name__, self.id, self.__dict__))

    def save(self):
        """Updates the 'updated_at' attribute and saves the object."""
        self.updated_at = datetime.utcnow()
        linkhub.storage.save()

    def delete(self):
        """Deletes the current instance from the storage."""
        linkhub.storage.delete(self)

    def to_dict(self):
        """Returns a dictionary of all the key/value pairs."""
        # Copy the instance's dictionary
        new_dict = dict(self.__dict__)

        # Convert 'created_at' and 'updated_at' into ISO format.
        if 'created_at' in new_dict:
            new_dict['created_at'] = new_dict['created_at'].isoformat()
        if 'updated_at' in new_dict:
            new_dict['updated_at'] = new_dict['updated_at'].isoformat()

        # Set the '__class__' key
        new_dict['__class__'] = self.__class__.__name__

        # Delete unwanted keys
        for key in ['password', '_sa_instance_state']:
            new_dict.pop(key, None)

        return new_dict
