# Discord bot

## Getting started

Enable the Discord module in administration and configure the application ID, public key, bot token, and optional guild ID. Set the application's Interactions Endpoint URL to `https://your-host/api/discord/interactions` in the Discord developer portal. Install the application with the `applications.commands` scope and any bot scope needed by your installation.

Commands register when the API starts. Restart the API after deploying or changing module configuration. A configured guild ID registers commands in that server; otherwise registration is global.

Run `/link` and use **Link Rootminster account** to sign in on the site. The private link expires after 15 minutes. Discord permissions do not grant Rootminster staff access: the linked site's account role controls staff functions.

## Commands and buttons

| Command | Experience |
| --- | --- |
| `/panel` | Opens your requests, or the review queue for staff. |
| `/requests` | Lists requests with numbered Open buttons and Previous/Next/Refresh controls. Use `scope:pending` for staff review. |
| `/request-view id:…` | Opens request details, DNS records, project information, and conversation history. |
| `/request` | Submits a request with the existing DNS, project, and preview options, then opens its detail panel. |
| `/request-manage` | Staff shortcut for approval, rejection, questions, and internal notes. Approval opens a confirmation panel. Other actions require a message. |

Request panels provide **Reply** for owners. Open staff requests provide **Approve**, **Reject**, **Ask for info**, and **Internal note**. Rejection, questions, notes, and replies use text-entry forms. Approval requires **Confirm DNS approval** before creating records. The shared backend checks record compatibility and current request status before writing DNS.

**Older messages** and **Newer messages** browse the conversation. Internal notes are visible only to staff. Replies and questions update the same conversation and status used on the website. **Open dashboard** provides full details when long content is shortened in Discord.

All responses are private to the interacting user, and generated messages suppress mentions. Each submitted action rechecks the linked account and its permissions; old controls cannot approve a closed request. Use Refresh if another reviewer has changed a request.

## Bundles and limits

Multiple compatible records appear as one request. Existing unresolved legacy rows are grouped by account and hostname. Lists page through five stored rows at a time; a legacy bundle can appear on adjacent pages. DNS changes always operate on the whole bundle.

The slash submission form currently accepts one DNS record. Use **New request on site** for a multi-record submission. Long record values and messages are shortened in the Discord panel; the dashboard retains the complete content.

## Verification

Run `node server/discord.test.js` and `node server/discord-requests.test.js`. These exercise signatures, replay handling, response types, components, authorization, modal submissions, pagination, and request grouping with mocked Discord and database calls.

The implementation follows Discord's [interaction responses](https://docs.discord.com/developers/interactions/receiving-and-responding) and [component reference](https://docs.discord.com/developers/components/reference). No gateway connection or privileged message-content intent is needed for these interaction flows.
