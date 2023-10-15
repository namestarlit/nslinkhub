-- prepares a MySQL server for the project

CREATE DATABASE IF NOT EXISTS `linkhub`;
CREATE USER IF NOT EXISTS 'linkhub_dev'@'localhost' IDENTIFIED BY '#LinkHub_1.0';
GRANT ALL PRIVILEGES ON `linkhub`.* TO 'linkhub_dev'@'localhost';
GRANT SELECT ON `performance_schema`.* TO 'linkhub_dev'@'localhost';
FLUSH PRIVILEGES;
