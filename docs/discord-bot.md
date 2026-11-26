# Discord bot

## Getting started

Enable the Discord module in administration and configure the application ID, public key, bot token, and optional guild ID. Set the application's Interactions Endpoint URL to `https://your-host/api/discord/interactions` in the Discord developer portal. Install the application with the `applications.commands` scope and any bot scope needed by your installation.

Commands register when the API starts. Restart the API after deploying or changing module configuration. A configured guild ID registers commands in that server; otherwise registration is global.

Users who sign in with Discord, or link Discord under **Settings → Linked accounts**, are linked to the bot automatically (see [social sign-in](social-sign-in.md)). Otherwise, run `/link` and use **Link Rootminster account** to sign in on the site. The private link expires after 15 minutes. Discord permissions do not grant Rootminster staff access: the linked site's account role controls staff functions.

## Commands and buttons

| Command | Experience |
| --- | --- |
| `/panel` | Opens your requests, or the review queue for staff. |
| `/requests` | Lists requests with numbered Open buttons and Previous/Next/Refresh controls. Use `scope:pending` for staff review. |
| `/request-view id:…` | Opens request details, DNS records, project information, and conversation history. |
| `/request` | Submits a request with the existing DNS, project, and preview options, then opens its detail panel. |
| `/request-manage` | Staff shortcut for approval, rejection, questions, and internal notes. Approval opens a confirmation panel. Other actions require a message. |
| `/ticket` | Opens a support ticket. See [Support tickets](#support-tickets). |
| `/tickets` | Lists your tickets, or open tickets for staff. |
| `/ticket-panel` | Staff: posts an **Open a ticket** button in the current channel. |

Request panels provide **Reply** for owners. Open staff requests provide **Approve**, **Reject**, **Ask for info**, and **Internal note**. Rejection, questions, notes, and replies use text-entry forms. Approval requires **Confirm DNS approval** before creating records. The shared backend checks record compatibility and current request status before writing DNS.

**Older messages** and **Newer messages** browse the conversation. Internal notes are visible only to staff. Replies and questions update the same conversation and status used on the website. **Open dashboard** provides full details when long content is shortened in Discord.

All responses are private to the interacting user, and generated messages suppress mentions. Each submitted action rechecks the linked account and its permissions; old controls cannot approve a closed request. Use Refresh if another reviewer has changed a request.

## Support tickets

Tickets let a linked user open a private support channel with staff. Enable the **Discord tickets** module (it needs the Discord bot module too) and set:

| Setting | Purpose |
| --- | --- |
| Open tickets category ID | New ticket channels are created here. |
| Closed tickets category ID | Closed ticket channels move here. |
| Staff role ID | Can see and reply in every open ticket, and is pinged when one opens. Optional. |
| Transcript log channel ID | Receives a `.txt` transcript when a ticket closes. Optional. |
| Open tickets per user | Default 3. |
| Delete closed ticket channels after (days) | Default 14; `0` keeps them. A Discord category holds at most 50 channels. |
| Categories and questions | One category per line, `Name: first question \| second question`. Up to 10 categories and 5 questions each. |

In the Discord server, give the bot **Manage Channels**, **Manage Roles**, **View Channel**, **Send Messages**, **Embed Links** and **Read Message History** on both categories. In the developer portal, turn on the **Message Content** intent for the bot (under *Bot → Privileged Gateway Intents*), otherwise transcripts are saved without message text. No gateway connection is needed: the bot reads the channel history once, when the ticket closes.

How a ticket works:

1. The user runs `/ticket`, or clicks **Open a ticket** on a panel staff post with `/ticket-panel` (needs Manage Server in Discord, and a staff or admin Rootminster account). Unlinked users get the `/link` button instead.
2. They pick a category, then one of their own subdomains (live DNS records and open requests on their linked account, up to 24) or **Not about a specific subdomain**.
3. A form asks that category's questions. On submit, the server re-checks the linked account, that the subdomain is on it, and the open ticket limit.
4. The bot creates `ticket-0042-username` in the open category. `@everyone` cannot see it; the opener and the staff role can view and send. The first message shows the answers, the subdomain's DNS records and the Rootminster account, with **Claim** and **Close ticket** buttons.
5. **Close ticket** (the opener or staff) asks for an optional reason, saves the transcript, moves the channel to the closed category and makes it read-only: the opener loses access and staff can read but not post. Staff can **Reopen**, which moves it back and restores the opener's access.

`/tickets` lists your tickets, or every open ticket for staff. On the website, users see their tickets under **Support Tickets** (`/tickets`) and staff see every ticket with answers and transcripts under **Discord Tickets** (`/admin-tickets`). Tickets are deleted with the account that opened them.

Discord permissions never grant ticket staff powers: Claim, Reopen and the panel check the linked Rootminster account's role.

## Bundles and limits

Multiple compatible records appear as one request. Existing unresolved legacy rows are grouped by account and hostname. Lists page through five stored rows at a time; a legacy bundle can appear on adjacent pages. DNS changes always operate on the whole bundle.

The slash submission form currently accepts one DNS record. Use **New request on site** for a multi-record submission. Long record values and messages are shortened in the Discord panel; the dashboard retains the complete content.

## Verification

If every command fails, check the API logs. `Discord command failed` identifies a failure while loading account data or running the action. `Discord response update failed` means the reply could not be delivered; the action may already have completed. These entries include the command or control and interaction ID. Response failures also include Discord's error code and field validation errors when available. For rejected link buttons, check that `APP_URL` is the public HTTPS address of the site and restart the API after correcting it. Check the dashboard before repeating a write action.

Run `node --test tests/server/discord.test.js tests/server/discord-requests.test.js tests/server/discord-tickets.test.js`. These exercise signatures, replay handling, response types, components, authorization, modal submissions, pagination, and request grouping with mocked Discord and database calls.

The implementation follows Discord's [interaction responses](https://docs.discord.com/developers/interactions/receiving-and-responding) and [component reference](https://docs.discord.com/developers/components/reference). No gateway connection is needed. The Message Content intent is only needed for ticket transcripts.
