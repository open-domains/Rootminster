# Threat intelligence

The **Threat intelligence** module (`threat_intel`, Admin → Module Settings) checks Open Domains subdomains against Google Safe Browsing and public malware and phishing feeds. It is off by default.

## What it checks

| When | What | What happens on a match |
|---|---|---|
| Daily, 05:10 UTC | Every active subdomain, and the targets of its live DNS records | An abuse report is opened for staff (or added to the open one for that site), and staff get a summary email. Nothing is suspended automatically. |
| New request | The requested hostname, its DNS targets and the preview link | The request is kept out of instant approval, the match is shown in the review dialog, and it is added to the Discord notification. The request is still accepted. |
| New DNS record or request | CNAME, MX, NS and SRV hostname targets | If **Refuse new DNS records that point at a listed hostname** is on, the record is refused with the feed's name. |

A match that staff dismiss is not reported again for 30 days. A match already on an open report is not added twice.

## Sources

- **Google Safe Browsing** (Lookup API v4). Add an API key from Google Cloud. The free API is for non-commercial use, which suits Open Domains.
- **URLhaus** malware host list (`https://urlhaus.abuse.ch/downloads/hostfile/`).
- **OpenPhish** community phishing feed (`https://openphish.com/feed.txt`).

Feeds are downloaded daily into the `threat_feed_hosts` table, separate from the staff blocklist. Each entry records its source, and entries a feed stops listing are dropped after **Drop feed entries not seen for** days (default 7). If a feed download fails or comes back empty, the previous entries are kept. The Blocklist page shows how many hosts each feed holds and when it last synced.

## Avoiding false positives

- Only exact hostnames are matched. A listed `bad.github.io` affects that site only.
- Shared hosting suffixes such as `github.io`, `pages.dev`, `vercel.app` and `herokuapp.com` are never imported or blocked as a whole (see `SHARED_HOST_SUFFIXES` in `server/lib/threat-intel.js`).
- Listed IP addresses are flagged but never block a record, because many sites share hosting IPs.
- Add wrongly listed hosts or IPs to **Hosts to ignore**.
