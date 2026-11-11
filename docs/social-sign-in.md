# Social sign-in and linked accounts

Rootminster supports Google, GitHub and Discord sign-in. Each provider is an
optional module under **Admin → Module Settings** (`google_oauth`,
`github_oauth`, `discord_oauth`). A provider appears on the login and register
pages, and under **Settings → Linked accounts**, only when its module is
enabled with a client ID and secret.

## Discord setup

1. In the [Discord developer portal](https://discord.com/developers/applications),
   open (or create) an application and go to **OAuth2**.
2. Add the redirect `https://your-host/api/auth/oauth/discord/callback`.
3. Copy the client ID and client secret into the **Discord OAuth** module, or set
   the legacy environment fallback:

   | Variable | Value |
   | --- | --- |
   | `DISCORD_CLIENT_ID` | OAuth2 client ID |
   | `DISCORD_CLIENT_SECRET` | OAuth2 client secret |

The requested scopes are `identify email`. The same application can also run
the [Discord bot](discord-bot.md); the bot module keeps its own settings.

Google and GitHub use `https://your-host/api/auth/oauth/google/callback` and
`https://your-host/api/auth/oauth/github/callback`.

## How sign-in picks an account

1. If the provider account is linked to a user, that user is signed in, even
   when the provider email differs from the Rootminster email.
2. Otherwise the provider's **verified** email is matched against Rootminster
   accounts (or a new account is created). If the matching account was never
   verified, its pre-registered password, two-factor secret, passkeys,
   sessions and links are discarded first, so whoever typed the address at
   registration cannot keep access. The provider account is then remembered as
   linked.
3. Discord accounts without a verified email can only sign in after they have
   been linked from settings.

Two-factor authentication still applies after any social sign-in.

## Linking and unlinking

Under **Settings → Linked accounts** a signed-in user can link one account per
provider. Linking:

- refuses a provider account that is already linked to a different user
  (including a Discord account linked to someone else's bot `/link`);
- must finish in the same browser session that started it, so a link URL sent
  to someone else cannot attach their account;
- is unavailable during an administrator view-as session;
- for Discord, also links the Discord bot to the account.

Unlinking is refused when it would remove the user's last sign-in method (no
password, passkey or other linked account remains). A user without a password
can set one with **Forgot password**.

Note: unlinking removes the explicit binding only. If the provider's verified
email is the same as the Rootminster email, signing in with that provider still
matches the account by email and links it again.

Link and unlink events are written to the audit log.
