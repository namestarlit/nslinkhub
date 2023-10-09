"""
Initialization of the LinkHub Database Storage

This module initializes the LinkHub Database Storage, providing
a central entry point to manage the database using SQLAlchemy.
It automatically creates a database session and loads essential
data when the LinkHub package is imported.

Key Features:
- Database setup and session creation upon package import.
- Automatic reloading of database configuration.
- Centralized access to the database through the 'storage' object.

Example Usage:
--------------
To access the LinkHub database, simply import the 'storage' object
from this module:

    from linkhub import storage

This will give you access to the database session and operations.

Author: Paul John
"""

# Import the DBStorage class from the engine module
from linkhub.engine.db_storage import DBStorage

# Create an instance of the DBStorage class
storage = DBStorage()

# Automatically reload the database configuration
storage.reload()
