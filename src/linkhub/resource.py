"""
This module defines a 'Resource' class for creating link resources.

In the LinkHub application, the 'Resource' class is used exclusively
for creating link resources. It allows users to define and manage
link resources with essential fields such as URLs and titles.

Key Features:
- Creation and management of link resources.
- Assign unique identifiers for each link resource.
- Set titles and URLs for easy access.
- Streamlined functionality for working with link data.

Author: Paul John
"""
from linkhub.linkhub_base import LinkHubBase, Base


class Resource(LinkHubBase, Base):
    pass
