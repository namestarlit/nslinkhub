from flask import request
from flask import jsonify

from api import auth
from api.blueprints import endpoints
from linkhub import storage


@endpoints.route('/token', methods=['GET'])
@auth.basic_auth_required
def get_token():
    """Get JWT token"""
    # User authentication passed, generate and return the token
    username = request.authorization.username
    token = auth.generate_auth_token(username)
    return jsonify({'token': token}), 200


@endpoints.route('/status', methods=['GET'])
@auth.token_required
def api_status():
    """Get API Status"""
    return jsonify({'status': 'OK'}), 200


@endpoints.route('/', methods=['GET'])
@auth.token_required
def supported_endpoints():
    """Get supported LinkHub API supported endpoints"""
    # You can construct a dictionary with information about supported endpoints
    endpoints_info = {
        'endpoints': {
            '/users': 'Returns a list of all LinkHub users',
            '/repos': 'Returns a list of all repositories',
            '/resources': 'Returns a list of all resources',
            # Add more as needed
        }
    }
    return jsonify(endpoints_info)

@endpoints.route('/stats', methods=['GET'])
@auth.token_required
def linkhub_stats():
    """Get total number/stats of each LinkHub class objects"""
    classes = ['User', 'Repository', 'Resource', 'Tag']
    keys = ['users', 'repositories', 'resources', 'tags']

    stats = {}
    for i in range(len(classes)):
        stats[keys[i]] = storage.count(classes[i])

    return jsonify(stats)
