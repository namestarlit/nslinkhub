# People and hubs

Status: designed, not built. Decision:
[ADR-0018](../engineering-decisions/0018-people-and-hubs-are-separate.md).
Built next, before the collaborator rename.

## Two identities

| | Person (the account) | Hub (their publishing space) |
| --- | --- | --- |
| Identity | **username** and a name | **Hub name** and its own **@handle** |
| Has one? | Everyone with an account | Optional — created on first save or first collection; at most one per person |
| Owns | Nothing directly | Every collection in it, and its subscribers |
| Shows up as | Commenters, contributors, History entries (`username`, linking to `/username`); invited viewers and contributors in the owner's access list (name and email) | Collection pages, Discover, its own page (`Hub name @handle`, at `/@handle`) |
| Others can | Invite them by email to view or contribute | **Subscribe** |
| Transferable | — | Never (collections are) |

The hub is the face: wherever something it owns appears, it shows as the hub.
People act as themselves.

## Namespaces and routes

Like YouTube channels (`/@handle`) and GitHub people (`/username`):

- **Hubs** live at `/@handle`; **people** at `/username`. They are separate
  namespaces (lowercase `[a-z0-9-]`, 3–60), so a person may give their hub
  their own username (`/@paul`) or another handle (`/@webcornerhub`).
- Usernames sit at the top level, so the app's own route words are reserved
  (`home`, `settings`, `profile`, `notifications`, `discover`, `platform`,
  `manage`, `capture`, `sign-in`, `support`, `c`, `h`, `api`, `forms`, … plus a
  buffer for future routes), as handles already reserve words.
- **The hub page** (`/@handle`) credits its owner — "by Paul John" when they
  show their name, linking to `/paul`.
- **The profile** (`/username`) is minimal: the name if shown, the username,
  their hub if they have one, and the public collections they have contributed
  to. Saved collections stay private (a public-saves opt-in can come later if
  wanted).
- Permanent addresses keep using ids: `/h/<hubId>`, `/c/<id>`; readable
  collection addresses stay `/@handle/<slug>`, with `?item=<itemId>` for one
  item.

In the interface hubs read as **@handle** and people as their plain
**username**, both linked, so the two never look alike.

## Names

- A person's name appears where they choose to show it: their profile and the
  credit on their hub page; and in the owner's access list (always, with
  email, since the owner invited them by email). Elsewhere people appear by
  their username.
- A hub page reads "Hub name", then "@handle", or "@handle by Owner Name" when
  the owner shows their name.

## Signing in, saving and the hub

| Action | Result |
| --- | --- |
| **Sign in** (new or returning) | The account only. The person can read public collections, save collections, subscribe to hubs, comment, and accept invitations to view or contribute. No hub yet |
| **Save your first link** | Sign in (or sign up) **and add the link**. No hub yet: it is created on the spot with a first private collection holding the link. A hub with collections: the person chooses the collection (or a new one), as on Save a link. Existing accounts are never turned away |
| **Save a link** / creating a collection (signed in) | The same rule: the hub is created if missing, otherwise the link goes where the person chooses |

- Sign-up derives the username from the name, or a readable random one; never
  from the email.
- A new hub is named from the person by default and takes their username as its
  handle when free; both can be changed later.
- Someone who only reads or contributes by invitation never gets a hub.
- Curator accounts (ADR-0016) upgrade the person and their hub.

## Subscriptions

People subscribe to hubs (like YouTube), with a per-hub notifications toggle;
subscriptions belong to the person, subscribers to the hub. People are not
followed. (`hub-home-and-following.md` uses "follow"; it reads as subscribe.)

## Data

- `users.username` (unique, reserved words blocked); `hubs.handle` stays
  unique in its own namespace.
- `hubs.owner_user_id` stays unique (one hub per person); a user may have none.
- Existing accounts: `username` is backfilled from their hub's handle, so
  nothing visible changes for current data; hub creation moves from sign-up to
  first save.
- Person references in the API (`PersonRef`) carry the person's username
  instead of a hub handle; hub references carry the hub's id, name and handle.
