"""
This module defines a 'DBStorage' class for managing database operations

In the LinkHub application, the 'DBStorage' class is the central module
responsible for handling database interactions using SQLAlchemy.
It facilitates a wide range of database operations, including retrieving data
for all classes, adding and removing objects, and managing the LinkHub database

Key Features:
- Centralized database operations using SQLAlchemy.
- Supports retrieval of data for all application classes
- Provides methods for adding, updating, and removing objects in the database.
- Enables efficient management of the LinkHub database.

Author: Paul John
"""
from os import getenv
import inspect
from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker, scoped_session

from linkhub.tag import Tag
from linkhub.user import User
from linkhub.linkhub_base import Base
from linkhub.resource import Resource
from linkhub.repository import Repository


def import_models():
    """Dynamic import of models"""
    return {
            'Tag': Tag,
            'User': User,
            'Resource': Resource,
            'Repository': Repository
            }


class DBStorage:
    """Defines DBStorage class

    This class defines methods for all the neccessary
    operations that can be performed on data and database
    configuration
    """
    __engine = None
    __session = None
    model_mapping = import_models()

    def __init__(self):
        """Initializes database connection"""
        # Get database credentials from environment variables
        DB_URL = URL.create(
                'mysql+mysqldb',
                username=getenv('LINKHUB_USER'),
                password=getenv('LINKHUB_PWD'),
                host=getenv('LINKHUB_HOST'),
                database=getenv('LINKHUB_DB')
                )

        # Create database Engine object
        self.__engine = create_engine(DB_URL, pool_recycle=3600)

        # Reset database on development environment
        if getenv('LINKHUB_ENV') == 'developement':
            Base.metadata.drop_all(bind=self.__engine)

    def reload(self):
        """Creates all tables in the database and a database session"""
        if self.__session is None:
            Base.metadata.create_all(self.__engine)
            Session = sessionmaker(bind=self.__engine, expire_on_commit=False)
            Session = scoped_session(Session)
            self.__session = Session()

    def all(self, cls=None):
        """Retrives objects of a class or all classes

        Args:
            cls (class, str): a class name, or class
        Returns:
            obj_dictionary (dict): a dictionary of objects
        """
        objs_dict = {}

        try:
            if cls is None:
                # Return objects from all classes
                cls_objs = list(self.model_mapping.values())
                objects = []
                for cls_obj in cls_objs:
                    objects.extend(self.__session.query(cls_obj).all())
            elif isinstance(cls, str):
                # Map class name to class object using model_mapping
                if cls in self.model_mapping:
                    cls = self.model_mapping[cls]
                    objects = self.__session.query(cls).all()
                else:
                    raise ValueError(f"Class name: {cls} not found in"
                                     " model_mapping")
            elif inspect.isclass(cls):
                # cls is already a class object, retrive objects
                objects = self.__session.query(cls).all()
            else:
                raise ValueError("Invalid input for cls. Please provide"
                                 " a class name or class object.")

            # Append all the objects to the objs_dict
            for obj in objects:
                key = "{}.{}".format(obj.__class__.__name__, obj.id)
                objs_dict[key] = obj

            return objs_dict

        except Exception as e:
            # Handle exceptions. log the errors
            print(f"Error: {e}")

    def new(self, obj):
        """Adds the object to the current database session

        Args:
            obj: instance of a class (object) or a list of objects
        """
        if obj:
            if isinstance(obj, list):
                self.__session.add_all(obj)
            else:
                self.__session.add(obj)

    def save(self):
        """Commits all changes of the current database session"""
        self.__session.commit()

    def delete(self, obj=None):
        """Deletes an object from the current database session

        Args:
            obj: instance of a class (object) to delete
        """
        if obj is not None:
            self.__session.delete(obj)

    def close(self):
        """Closes a database session"""
        self.__session.close()

    def get(self, cls=None, id=None):
        """Retrives object by ID

        Args:
            cls (obj, str): class object or class name
            id (str): Object ID
        Returns:
            obj: object
        """
        if cls is None or id is None:
            return None
        if isinstance(cls, str):
            key = "{}.{}".format(cls, id)
        else:
            key = "{}.{}".format(cls.__name__, id)

        objs = self.all(cls)
        if objs is None:
            return None
        return objs.get(key)

    def count(self, cls=None):
        """Gets the number of class objects"""
        if cls is None:
            return len(self.all())
        return len(self.all(cls))

    def get_user_by_username(self, username=None):
        """Retrieve a user by their username.

        Args:
            username (str): The username of the user to retrieve.

        Returns:
            User: The user object with the specified username
            or None if not found.

        Raises:
            TypeError: If the username is not a string.
        """
        if username is None:
            return None

        if not isinstance(username, str):
            raise TypeError('username must be a string')

        try:
            user = (
                    self.__session.query(User)
                    .filter_by(username=username)
                    .first()
                    )
            return user
        except Exception as e:
            print(f"Error: {e}")


    def get_repo_by_name(self, name=None):
        """Retrieve a repository by its name.

        Args:
            name (str): The name of the repository to retrieve.

        Returns:
            Repository: The repository object with the specified name
            or None if not found.

        Raises:
            TypeError: If the name is not a string.
        """
        if name is None:
            return None

        if not isinstance(name, str):
            raise TypeError('Repository name must be a string')

        try:
            repository = (
                    self.__session.query(Repository)
                    .filter_by(name=name)
                    .first()
                    )
            return repository
        except Exception as e:
            print(f"Error: {e}")

    def delete_unused_tags(self):
        try:
            unused_tags = (
                    self.__session.query(Tag)
                    .filter(~Tag.repositories.any(), ~Tag.resources.any())
                    .all()
                    )

            for tag in unused_tags:
                self.delete(tag)
        except Exception as e:
            print(f"Error: {e}")
