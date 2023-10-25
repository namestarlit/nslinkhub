"""
Main LinkHub API application
"""
import os
from flask import g
from api import app
from linkhub import storage


# Function to set custom headers for all responses
def set_custom_headers(response):
    # Set the custom headers
    response.headers['X-API-Version'] = '23.10'
    response.headers['Cache-Control'] = 'public, max-age=15'

    # Check if user_id is available in g, set it to None otherwise
    user_id = g.user_id if hasattr(g, 'user_id') else None
    if user_id is not None:
        response.headers['User-Agent'] = user_id

    return response


@app.teardown_appcontext
def app_teardown(exception):
    """Closes the database session at app teardown"""
    storage.close()


@app.after_request
def after_request(response):
    return set_custom_headers(response)

if __name__ == '__main__':
    # Get host IP and port number
    host = os.getenv('LINKHUB_API_HOST', '0.0.0.0')
    port = os.getenv('LINKHUB_API_PORT', '5000')

    # Run the application
    app.run(host=host, port=port, threaded=True)
