# Notifications

Status: designed, not built. Today `/notifications` lists service-role
invitations only, derived from the invitations themselves; this design
generalizes it.

Notifications are one inbox for everything that happened that concerns you,
with settings in the same place. Like [Manage](manage-workspace.md), the kinds
you see and can configure follow your roles.

## Kinds

| Kind | Who receives it | Example |
| --- | --- | --- |
| Following | Followers of a hub | "@namestarlit published *Backend building blocks*" |
| Comments | Owner and editors of the collection; the author of the comment replied to | "@reader asked a question on *How the web reaches you*"; "@curator replied to your comment"; "Your reply was marked as the answer" |
| Saves and follows | Hub owner | "@reader saved *Accessibility from the start*"; "@reader followed your hub" |
| Sharing | The person shared with | "@namestarlit shared *Code style* with you (Can edit)" |
| Invitations | Invited people | "You're invited to be a service admin" |
| Imports | The importing owner | "Your import is ready to review: 184 ready, 12 need attention" |
| Service | Operators and admins | Invitation accepted or declined; a held collection was corrected by its owner |

New kinds are added here with their recipients. A notification never reveals
anything its recipient couldn't otherwise read: a comment notice for a
collection you lost access to drops out of your inbox.

## Settings

The Notifications page has an inbox and a **Settings** view
(`/notifications/settings`):

- one switch per kind you can receive (for example, turn off "Saves and
  follows");
- **Following**: each followed hub with its own switch (on by default, like
  YouTube's bell), also reachable from the hub's Follow button;
- invitations and security notices (sign-in and account changes) are always
  on.

Settings save as they are changed, like the rest of Settings.

## Delivery

In-app first: a notification row per recipient, written by the same
transaction as the event when there are few recipients, and fanned out by the
worker when there are many (a hub's followers). Email stays for what already
uses it (codes, invitations, targeted shares).

## Open questions

- Which kinds, if any, also send email, and whether email is a per-kind choice.
