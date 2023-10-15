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
from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker, scoped_session

from linkhub.user import User
from linkhub.linkhub_base import Base
from linkhub.resource import Resource
from linkhub.repository import Repository
from linkhub.tag import Tag


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
            with self.__session as session:
                if cls is None:
                    # Return objects from all classes
                    cls_objs = list(self.model_mapping.values())
                    objects = []
                    for cls_obj in cls_objs:
                        objects.extend(session.query(cls_obj).all())
                elif isinstance(cls, str):
                    # Map class name to class object using model_mapping
                    if cls in model_mapping:
                        cls = model_mapping[cls]
                        objects = session.query(cls).all()
                    else:
                        raise ValueError(f"Class name: {cls} not found in"
                                         " model_mapping")
                elif inspect.isclass(cls):
                    # cls is already a class object, retrive objects
                    objects = session.query(cls).all()
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
            pass

    def new(self, obj):
        """Adds the object to the current database session

        Args:
            obj: instance of a class (object)
        """
        if obj:
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
        self.__session.remove()

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
        return objs.get(key)

    def count(self, cls=None):
        """Gets the number of class objects"""
        if cls is None:
            return len(self.all())
        return len(self.all(cls))
