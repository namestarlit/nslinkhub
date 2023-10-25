import os
from api import app
from linkhub import storage


@app.teardown_appcontext
def app_teardown(exception):
    """method to handle app teardown"""
    storage.close()


if __name__ == '__main__':
    # Get host IP and port number
    host = os.getenv('LINKHUB_API_HOST', '0.0.0.0')
    port = os.getenv('LINKHUB_API_PORT', '5000')

    # Run the application
    app.run(host=host, port=port, threaded=True)
