"""This module contains Flask routes

It contains routes for handling erros
"""
from flask import jsonify

from api import app


@app.errorhandler(400)
def bad_request(error):
    """Handles Bad Request error"""
    error_info = {"code": 400, "message": f"{error.description}"}

    return jsonify({"error": error_info}), 400


@app.errorhandler(403)
def forbidden(error):
    """Handles Authorization error; Forbidden"""
    error_info = {"code": 403, "message": "Forbidden"}

    return jsonify({"error": error_info}), 403


@app.errorhandler(404)
def not_found(error):
    """Handle 404 error"""
    error_info = {"code": 404, "message": f"{error.description}"}

    return jsonify({"error": error_info}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """Handles Method Not Allowed error"""
    error_info = {"code": 405, "message": "Method Not Allowed"}

    return jsonify({"error": error_info}), 405


@app.errorhandler(415)
def unsupported_media_type(error):
    """Handles unsupporeted media type error"""
    error_info = {"code": 415, "message": "The API only accepts data in JSON format"}

    return jsonify({"error": error_info}), 415


@app.errorhandler(429)
def ratelimit_handler(error):
    """Handles Too many request error on rate limit breach"""
    error_info = {"code": 429, "message": f"ratelimit exceeded {error.description}"}

    return jsonify({"error": error_info}), 429


@app.errorhandler(500)
def internal_server_error(error):
    """Handles Internal Server Error"""
    error_info = {
        "code": 500,
        "message": "Internal Server Error: API got an unexpected error :(",
    }

    return jsonify({"error": error_info}), 500
