# Hub home, saved collections and subscriptions

Status: public hub and owner collection lists are implemented. Subscriptions,
subscriber counts and the home tabs below are planned. Identity follows
[people and hubs](people-and-hubs.md).

## Public hub page

At `/@handle` and `/h/<id>`, the planned public page shows the hub name, handle,
owner attribution, description, **Subscribe** (signed-in visitors), the share row, and
the hub’s published collections. Show a subscriber count only from real data
once subscriptions are implemented.

## Your home

What the owner sees at their own hub, Google-Drive style, switching between:

- **My collections** — every collection in the hub, private ones included.
- **Shared with me** — collections others shared with you (direct shares and
  link shares you opened).
- **Saved** — published collections you saved, like saved documents in Google
  Drive; dormant ones keep their place labelled "Currently unavailable".
- **Subscriptions** — hubs you subscribe to and their latest published collections, like
  YouTube subscriptions.

Settings’ "View your public hub" link shows the page as visitors see it. Managing the
hub happens in [Manage](manage-workspace.md), not here.

## Subscriptions

Subscribing to a hub is like subscribing to a YouTube channel: it adds the hub to
your Subscriptions list, its new published collections to your feed, and sends you
a notification when it publishes. Each subscribed hub has a notifications toggle
(on by default, like YouTube's bell), so you can keep subscribing without the
notices. A person’s subscription targets the hub: it is keyed by the hub’s
immutable id, so it survives handle and name changes, until the
subscriber unsubscribes. Settings live with the rest of the
[notification settings](notifications.md). Owners see
their subscribers in Manage › People; a blocked account cannot subscribe.
