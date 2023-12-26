"""
Utility Functions for the LinkHub API

The Util class provides a set of utility methods that are used across
various route functions in the LinkHub API. These methods help with common
tasks such as formatting date for headers and generating location URLs.

Purpose:
- Date Formatting: The 'last_modified' method formats a datetime object
  for use in Last-Modified headers in HTTP responses.
- URL Generation: The 'location_url' method generates URLs for use
  in the Location header of HTTP responses.

Key Methods:
- 'last_modified': Formats a datetime object for Last-Modified headers.
- 'location_url': Generates URLs for Location headers.

Usage:
- Create an instance of the 'Util' class to access its utility methods.
- Utilize 'last_modified' to format datetime objects for headers.
- Use 'location_url' to generate URLs for Location headers.

Author: Paul John

"""
from datetime import datetime
from flask import url_for, abort


class Util:
    """Defines helping methods"""

    def last_modified(self, updated_at):
        """Formats last updated_at time to use in Last-Modified header

        Args:
            updated_at (datetime): updated_at time object

        Returns:
            str: formatted time
            
        """
        GMT_FORMAT = "%a, %d %b %Y %H:%M:%S GMT"
        last_modified = datetime.strftime(updated_at, GMT_FORMAT)

        return last_modified

    def parse_datetime(self, date_str):
        """Parses a date string and returns a datetime object

        Args:
            date_str (str): Date string to parse

        Returns:
            datetime: Parsed datetime object

        """
        try:
            GMT_FORMAT = "%a, %d %b %Y %H:%M:%S GMT"
            return datetime.strptime(date_str, GMT_FORMAT)
        except ValueError:
            abort(412, "Precondition Failed: Invalid date format")

    def is_modified_since(self, last_modified, modified_since):
        """Check if a resource has been modified

        Compares a resource's updated_at date with the provided
        date argument.

        Args:
            last_modified (str): The Date a resource was last modifed
            modified_since (str): The Date argument provided

        Returns:
            bool: True if last_modified > modified_since, False otherwise

        """
        # Format last_modified date to GMT format
        last_modified = self.last_modified(last_modified)

        # Parse dates to datetime objects
        last_modified = self.parse_datetime(last_modified)
        modified_since = self.parse_datetime(modified_since)

        # Compare datetime objects
        if last_modified <= modified_since:
            return False
        return True

    def location_url(self, route_name, **kwargs):
        """Creates a URL to use in Location header

        Args:
            route_name (str): Flask Route name
            **kwargs: key-value pair parameters

        Returns:
            str: route url

        """
        if kwargs:
            location_url = url_for(route_name, **kwargs, _external=True)
        else:
            location_url = url_for(route_name, _external=True)

        return location_url
