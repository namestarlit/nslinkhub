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
from flask import url_for


class Util:
    """Defines helping methods"""
    def last_modified(self, updated_at):
        """Formats last updated_at time to use in Last-Modified header

        Args:
            updated_at (datetime): updated_at time object

        Returns:
            str: formatted time
        """
        GMT_FORMAT = '%a, %d %b %Y %H:%M:%S GMT'
        last_modified = datetime.strftime(updated_at, GMT_FORMAT)

        return last_modified

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
