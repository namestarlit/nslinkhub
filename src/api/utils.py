"""
Defines Util class that contains helping methods
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
