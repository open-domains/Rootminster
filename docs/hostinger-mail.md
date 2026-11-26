# Hostinger Mail

The **Hostinger Mail** module sends platform email (verification links, password resets, request updates, inactivity notices and staff alerts) through the [Hostinger Mail API](https://github.com/hostinger/mail-api-typescript-sdk) instead of SMTP. It uses the official `hostinger-mail-api-sdk` package.

## How it picks a handler

- When Hostinger Mail is enabled and has a token and mailbox, every message goes through it.
- Otherwise the SMTP **Email** module sends, as before.
- With neither enabled, mail is skipped and logged in development.

The **Email** module still holds the shared settings: the contact recipient and whether registration requires email verification. You can leave its SMTP part disabled when Hostinger Mail does the sending. Registration, backup failure alerts and the setup screen count either handler as "email enabled".

## Configure

1. In hPanel, create a Mail API token for the email order that holds your sending mailbox (for example `no-reply@open-domains.com`).
2. Open **Admin → Modules → Hostinger Mail**, paste the token and enable it.
3. Leave **Mailbox resource ID** blank if the token manages one mailbox. On save, Rootminster calls `GET /api/v1/me`, checks the token, and fills in the ID. If the token manages several mailboxes, the error lists them so you can pick one.
4. Optionally set **Sender display name**. It defaults to the name part of the Email module's From address (`Open Domains <…>` gives `Open Domains`).

The From address is always the mailbox address, because the API sends as that mailbox.

Environment fallback (imported like other modules):

```
HOSTINGER_MAIL_API_TOKEN=
HOSTINGER_MAIL_MAILBOX_ID=
HOSTINGER_MAIL_DISPLAY_NAME=
```

## Delivery behaviour

- Messages are sent with `POST /api/v1/mailboxes/{mailboxResourceId}/send`. A `204` means Hostinger accepted the message; it is sent within a few seconds and saved to `INBOX.Sent`. Later bounces are not reported to Rootminster.
- Errors (bad token, wrong mailbox, validation) surface as short messages without the token, and callers record them the same way as SMTP failures.
- Requests time out after 15 seconds.
