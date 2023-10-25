"""This module contains Flask routes

It contains routes for handling erros
"""
from flask import jsonify
from api import app


@app.errorhandler(404)
def not_found(error):
    """Handle 404 error"""
    return jsonify({'error': 'Not found'}), 404
