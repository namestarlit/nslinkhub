"""
Logging mechanism for LinkHub API

The logging module in the LinkHub API is responsible for handling application
logs, both locally and via email. It provides a structured approach to logging
errors and events in the application.

Purpose:
- Local Error Logging: It captures and stores error messages and events
  in a local log file.
- Email Error Notifications: It sends error notifications via email to
  designated recipients.
- Centralized Logging: All log messages are consistently formatted for
  easy analysis.

Key Features:
- Local Error Logging: Errors and events are logged locally with
  timestamps and details.
- Email Notifications: It sends error notifications via email
  when requested.
- Log File Rotation: The local log file is rotated to manage log
  size efficiently.
- Structured Log Format: Log messages include timestamps, log levels,
  and source code references.

Usage:
- The 'Logging' class is initialized to set up logging configurations.
- The 'logerror' method is used to log errors and optionally send
  them via email.

Author: Paul John

"""
import os
import logging
import traceback
from logging.handlers import SMTPHandler
from logging.handlers import RotatingFileHandler

from api import mail
from flask import current_app
from flask_mail import Message


class Logging:
    """Logging class"""
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
            '%(asctime)s %(levelname)s: %(message)s')
                                      )
        file_handler.setLevel(logging.INFO)
        logger.addHandler(file_handler)
        logger.info('LinkHub API Startup')

        return logger

    def logerror(self, error, send_email=False):
        """logs error to log file and sends over an email"""
        # Convert the exception to a string with the full stack trace
        error_message = f"{str(error)}\n\n{traceback.format_exc()}"

        # Log the error locally.
        self.logger.error(error_message)

        if send_email:
            # Send error over email
            if current_app.config.get('MAIL_USERNAME'):
                subject = 'LinkHub API Failure'
                sender = 'no-reply@linkhub.com'
                recipients = current_app.config['ADMINS']

                msg = Message(subject, sender=sender, recipients=recipients)
                msg.body = error_message

                try:
                    mail.send(msg)
                    self.logger.info('Error sent via email')
                except Exception as e:
                    self.logger.info(f'Error sending email: {str(e)}')
