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

import inspect
from os import getenv

from sqlalchemy import URL, create_engine, text
from sqlalchemy.orm import scoped_session, sessionmaker

from linkhub.linkhub_base import Base
from linkhub.repository import Repository
from linkhub.resource import Resource
from linkhub.tag import Tag
from linkhub.user import User


def import_models():
    """Dynamic import of models"""
    return {"Tag": Tag, "User": User, "Resource": Resource, "Repository": Repository}


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
            "mysql+mysqldb",
            username=getenv("LINKHUB_USER"),
            password=getenv("LINKHUB_PWD"),
            host=getenv("LINKHUB_HOST"),
            database=getenv("LINKHUB_DB"),
        )

        # Create database Engine object
        self.__engine = create_engine(DB_URL, pool_recycle=3600)

        # Reset database on development environment
        if getenv("LINKHUB_ENV") == "developement":
            Base.metadata.drop_all(bind=self.__engine)

    def reload(self):
        """Creates all tables in the database and a database session"""
        if self.__session is not None:
            self.close()
        Base.metadata.create_all(self.__engine)
        Session = sessionmaker(bind=self.__engine, expire_on_commit=False)
        Session = scoped_session(Session)
        self.__session = Session()

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
                    raise ValueError(f"Class name: {cls} not found in model_mapping")
            elif inspect.isclass(cls):
                # cls is already a class object, retrive objects
                objects = self.__session.query(cls).all()
            else:
                raise TypeError(
                    "Invalid input for cls. Please provide"
                    " a class name or class object."
                )

            # Append all the objects to the objs_dict
            for obj in objects:
                key = "{}.{}".format(obj.__class__.__name__, obj.id)
                objs_dict[key] = obj

            return objs_dict

        except Exception as e:
            # Note: Handle exceptions in production.
            # where you use linkhub package
            # like logging the exceptions raised
            raise e

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
            raise TypeError("username must be a string")

        try:
            user = self.__session.query(User).filter_by(username=username).first()
            return user
        except Exception as e:
            raise e

    def get_user_by_email(self, email=None):
        """Retrieve a user by their email.

        Args:
            email (str): The email of the user to retrieve.

        Returns:
            User: The user object with the specified email or None if not found

        Raises:
            TypeError: If the email is not a string.

        """
        if email is None:
            return None

        if not isinstance(email, str):
            raise TypeError("Email must be a string")

        try:
            query = text("SELECT * FROM users WHERE email = :email")
            result = self.__session.execute(query, {"email": email})
            user = result.fetchone()
        except Exception as e:
            raise e

        return user

    def get_repo_by_name(self, username=None, repo_name=None):
        """Retrives a repository owned by a user by name

        Args:
            username (str): Repository owner's username
            repo_name (str): The name of the repository to retrive

        Returns:
            Repository: Repository object if available, else None

        """
        if username is None or repo_name is None:
            return None
        if not isinstance(username, str):
            raise TypeError("username must be a string")
        if not isinstance(repo_name, str):
            raise TypeError("repository name must be a string")

        try:
            # Get user
            user = self.get_user_by_username(username)
            if user is None:
                return None

            for repo in user.repositories:
                if repo.name == repo_name:
                    return repo

            return None
        except Exception as e:
            raise e

    def get_resource_by_id(self, repo_id=None, resource_id=None):
        """Retrives a repository resource by ID

        Args:
            repo_id (str): The ID of the repository with the resource
            resource_id (str): The ID of the resource to get

        Returns:
            Resource: Resource object

        """
        if repo_id is None or resource_id is None:
            return None
        if not isinstance(repo_id, str):
            raise TypeError("Repository ID must be a string")
        if not isinstance(resource_id, str):
            raise TypeError("Resource ID must be a string")

        try:
            # Get repository
            repo = self.get(Repository, repo_id)
            if repo is None:
                return None

            for resource in repo.resources:
                if resource.id == resource_id:
                    return resource

            return None
        except Exception as e:
            raise e

    def delete_unused_tags(self):
        """Delete all tags not linked to any resource or repository"""
        try:
            unused_tags = (
                self.__session.query(Tag)
                .filter(~Tag.repositories.any(), ~Tag.resources.any())
                .all()
            )

            for tag in unused_tags:
                self.delete(tag)
        except Exception as e:
            raise e

    def get_tag_by_name(self, name=None):
        """Retrives a tag object by name"""
        if name is None:
            return None

        if not isinstance(name, str):
            raise TypeError("tag name must be a string")

        try:
            tag = self.__session.query(Tag).filter_by(name=name).first()
            return tag
        except Exception as e:
            raise e


# ToDO: sorted(self, objects, sort_key) - method to sort objects
#       paginate(self, objects, page_number, page_size) - methods to paginate
#       objects
