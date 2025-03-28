"""
Main LinkHub API Application

This module represents the main application for the LinkHub API.

Functions:
- set_custom_headers(response): Sets custom headers for API responses.
- app_teardown(exception): Closes the database session at application teardown.
- after_request(response): Executes after each API request to set API headers

Configuration Options:
- LINKHUB_API_HOST:
  The host IP for the API. Defaults to '0.0.0.0' if not specified
  in the environment.
- LINKHUB_API_PORT:
  The port number for the API. Defaults to '5000' if not specified
  in the environment.

This module serves as the main entry point for the LinkHub API application.
It defines functions for setting custom headers, closing the database session,
and customizing API responses. It also provides configuration options for host
and port settings.

Author: Paul John

"""

import os

from flask import g, jsonify

from api import app
from linkhub import storage


# Function to set custom headers for all responses
def set_custom_headers(response):
    # Set the custom headers
    response.headers["X-API-Version"] = "23.10"
    response.headers["Cache-Control"] = "public, max-age=15, must-revalidate"

    # Check if user_id is available in g, set it to None otherwise
    user_id = getattr(g, "user_id", None)
    if user_id is not None:
        response.headers["User-Agent"] = user_id

    return response


@app.teardown_appcontext
def app_teardown(exception):
    """Closes the database session at app teardown"""
    storage.close()


@app.after_request
def after_request(response):
    return set_custom_headers(response)


@app.route("/", methods=["GET"])
def home():
    response = {
        "title": "nsclinkhub",
        "description": "A web resources managment REST API",
        "links": [
            {"href": "/api", "rel": "api"},
            {
                "href": "https://documenter.getpostman.com/view/29464988/2s9YXiaMvk",
                "rel": "Postman Linkhub REST API Documentation Reference",
            },
            {
                "href": "https://github.com/namestarlit/nsclinkhub",
                "rel": "GitHub Repository",
            },
        ],
    }

    return jsonify(response), 200


if __name__ == "__main__":
    # Get host IP and port number
    host = os.getenv("LINKHUB_API_HOST", "0.0.0.0")
    port = os.getenv("LINKHUB_API_PORT", "5000")

    # Run the application
    app.run(host=host, port=port, threaded=True)
