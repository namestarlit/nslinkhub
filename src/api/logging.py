import os
import logging
import traceback
from logging.handlers import SMTPHandler
from logging.handlers import RotatingFileHandler

from api import mail
from flask import current_app
from flask_mail import Message

class Logging:
    def __init__(self):
        self.logger = self.setup_logger()

    def setup_logger(self):
        logger = logging.getLogger('linkhub_api')
        logger.setLevel(logging.INFO)

        # Always log the error locally to a file.
        basedir = os.path.abspath(os.path.dirname('api'))
        logdir = os.path.join(basedir, 'logs')
        if not os.path.exists(logdir):
            os.mkdir(logdir)

        file_handler = RotatingFileHandler('logs/linkhub_api.log',
                                           maxBytes=10240,
                                           backupCount=10
                                           )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s '
            '[in %(pathname)s:%(lineno)d]')
                                      )
        file_handler.setLevel(logging.INFO)
        logger.addHandler(file_handler)
        logger.info('LinkHub API Startup')

        return logger

    def logerror(self, error, send_email=False):
        # Log the error locally.
        self.logger.error(str(error))

        if send_email:
            # Send error over email
                if current_app.config.get('MAIL_USERNAME'):
                    subject = 'LinkHub API Failure'
                    sender = 'no-reply@linkhub.com'
                    recipients = current_app.config['ADMINS']

                    # Convert the exception to a string with the full stack trace
                    error_message = f"{str(error)}\n\n{traceback.format_exc()}"

                    msg = Message(subject, sender=sender, recipients=recipients)
                    msg.body = error_message

                    try:
                        mail.send(msg)
                        self.logger.info('Error sent via email')
                    except Exception as e:
                        self.logger.info(f'Error sending email: {str(e)}')
