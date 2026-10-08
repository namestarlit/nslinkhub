# ADR-0018: People and hubs are separate identities

**Status:** accepted  
**Date:** 2026-10-08  
**Amends:** ADR-0001 (a hub is optional, created on first use; still one per
person, owned by them, never transferred).

## Context

Every account was a hub: the hub's handle was the person's identity, so
commenters, contributors and invited viewers appeared as hubs, and someone
invited to read one collection got a hub they never asked for. Yet the hub is
the face that owns and publishes everything, while people act — comment,
contribute, are invited by email.

## Options considered

- Keep the account and the hub as one identity (the hub's handle is the
  person's).
- Separate them, as a Google account and a YouTube channel, a Substack reader
  and a publication, or a GitHub user and their repositories are separate.

## Decision

A **person** (the account) has an **@username** and a name; a **hub** is their
optional publishing space, with its own **name** and **@handle**. A person has
at most one hub, created when they first save or curate, owned by them and
never transferred; the hub owns their collections and its subscribers.
People act as themselves: they comment, contribute and are invited by email to
view or contribute, with or without a hub. Others **subscribe to hubs**; people
aren't followed. Hubs live at `/@handle` and people at `/username` — two
namespaces, so a person may give their hub their username or another handle;
top-level usernames never take the app's own route names. Display, routes and
data: [people-and-hubs.md](../design-docs/people-and-hubs.md).

## Rationale

- Readers and collaborators don't need a hub; publishing does.
- A hub can be named and branded on its own; a comment is clearly the person.
- One social graph (subscriptions) instead of two.
- Leaves room for GitHub-style organizations later as another kind of hub
  owner, without reshaping people (ADR-0017 stays rejected for now).

## Constraints to preserve

- At most one hub per person; hubs and collections are owned, people are never
  owned. Hubs aren't transferred; collections are.
- Usernames and handles are separate namespaces with their own addresses
  (`/username`, `/@handle`); reserved words protect app routes; durable
  references use ids (ADR-0002).
- Contributors and viewers are people, never hubs; access never comes from a
  username or handle.

## Links

- [people-and-hubs.md](../design-docs/people-and-hubs.md)
- [ADR-0001](0001-drive-tenancy-model.md), [ADR-0002](0002-immutable-identities.md),
  [ADR-0017](0017-hubs-are-entities-with-members.md)
