"""This module contains Flask routes

It contains routes for handling erros
"""
from flask import jsonify
from api import app


@app.errorhandler(404)
def not_found(error):
    """Handle 404 error"""
    error_info = {
            'code': 404,
            'message': 'Not Found'
            }

    return jsonify({'error': error_info}), 404


@app.errorhandler(415)
def unsupported_media_type(error):
    """Handles unsupporeted media type error"""
    error_info = {
            'code': 415,
            'message': 'The API only accepts data in JSON format'
            }

    return jsonify({'error': error_info}), 415
