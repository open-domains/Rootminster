# Redeploy from Discord

`/deploy` lets admins, or staff if you allow it, redeploy the latest version of the site from Discord without SSH. It runs your existing update script on the server through a small host-side service, the **deploy runner**.

## How it works

1. Someone runs `/deploy`. The bot checks the linked Rootminster account's role and shows a private confirmation panel with the last run.
2. **Confirm redeploy** records the run, writes an audit log entry (who, from which Discord user) and sends a signed request to the runner.
3. The runner starts the update script from its own configuration. Rootminster never sends a command or arguments, so a leaked secret can only start the same script.
4. The update script restarts the app. When the new app starts, it picks up the run and checks the runner every 10 seconds.
5. When the script finishes, the bot edits the original message with the result. After Discord's 15-minute limit on that message, it sends the requester a DM instead. The log channel, if set, gets a message when a run starts and when it ends.

Only one run can be active. The database allows one active row, and the runner refuses a second run with 409, including one started by someone else at the same time. A run with no result after 45 minutes is marked unknown so it cannot block later redeploys. The runner stops a script after `DEPLOY_RUNNER_TIMEOUT` seconds (30 minutes by default).

Discord permissions never grant this: the Rootminster role decides. Every button press re-checks the role and the module setting.

## Server setup

The runner is one Python file that uses only the standard library. Python 3.8 or newer is on every current Ubuntu and Debian release.

```bash
sudo install -d /opt/rootminster-deploy-runner
sudo install -m 755 scripts/deploy-runner/rootminster-deploy-runner.py /opt/rootminster-deploy-runner/
sudo install -m 600 scripts/deploy-runner/rootminster-deploy-runner.env.example /etc/rootminster-deploy-runner.env
sudo install -m 644 scripts/deploy-runner/rootminster-deploy-runner.service /etc/systemd/system/
```

Edit `/etc/rootminster-deploy-runner.env`:

- `DEPLOY_RUNNER_SECRET`: generate with `openssl rand -hex 32`.
- `DEPLOY_RUNNER_SCRIPT`: the absolute path of your update script. It must be executable (`chmod +x`). It runs as root by default, from its own directory, with `ROOTMINSTER_DEPLOY_ID` and `ROOTMINSTER_DEPLOY_REQUESTED_BY` set. Exit code 0 means success.
- `DEPLOY_RUNNER_BIND`: keep the default `172.17.0.1` (the Docker bridge). Containers can reach it and the internet cannot. Never bind it to a public address.

Then start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rootminster-deploy-runner
curl http://172.17.0.1:9787/health   # {"ok": true}
```

If the host uses `ufw`, let containers reach the port: `sudo ufw allow from 172.16.0.0/12 to any port 9787 proto tcp`.

`compose.yml` gives the app `host.docker.internal`, which points at the Docker bridge. Recreate the app once after pulling this change (`docker compose up -d app`).

Run history and script output are kept in `/var/lib/rootminster-deploy-runner` (the last 50 runs). Follow the runner with `journalctl -u rootminster-deploy-runner -f`.

## Rootminster setup

In **Administration → Modules → Discord deploy**:

| Setting | Value |
| --- | --- |
| Deploy runner URL | `http://host.docker.internal:9787` |
| Runner shared secret | The same value as `DEPLOY_RUNNER_SECRET`. |
| Who can redeploy | **Admins only** (default) or **Staff and admins**. |
| Deploy log channel ID | Optional staff channel for start and finish messages. |

The Discord bot module must be enabled. The `/deploy` command is registered when the API starts. To hide it from most members in Discord, limit it under **Server Settings → Integrations** as well; the server-side role check applies either way.

The same settings can come from `DEPLOY_RUNNER_URL`, `DEPLOY_RUNNER_SECRET`, `DEPLOY_ALLOWED_ROLES` and `DEPLOY_LOG_CHANNEL_ID`.

## Failure output

By default the bot reports only the exit code, because script output can contain secrets. Set `DEPLOY_RUNNER_SHARE_LOG=1` on the server to include the last 15 lines of a failed run in the result. Only do this if your script prints nothing sensitive.

## Security notes

- Every request except `/health` is signed with HMAC-SHA256 over the timestamp, a random nonce, the method, the path and the body. The runner refuses timestamps more than 60 seconds off and nonces it has already seen.
- The runner removes `DEPLOY_RUNNER_SECRET` from the script's environment.
- A second runner process cannot start on the same state directory.
- If the runner restarts during a run, it marks that run failed. The script itself keeps going (`KillMode=process`), so check the server before retrying.

## Verification

Run `node --test tests/server/discord-deploy.test.js tests/server/deploy-runner.test.js`. The runner test starts the real Python service with a stub script and checks signing, replay protection, the one-run lock and result reporting.
