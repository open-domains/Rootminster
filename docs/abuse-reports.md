# Abuse report triage

Public abuse reports (`/report-abuse`) are grouped and tracked so staff handle one case per site and reporters can follow progress.

## Grouping

Each report records the reported hostname (`normalized_host`), reduced from whatever the reporter typed, so `https://x.example.com/login` and `x.example.com` match. When a report arrives for a host that already has an **open** or **investigating** report, it joins that report instead of creating a new one:

- the report count goes up, and the new text is kept under "Later reports about this site" in **Admin → Abuse Reports**;
- staff are not emailed again.

Once a report is resolved or dismissed, the next report about that host starts a new case.

## Reporter status links

Every reporter gets a private status link, `/report-abuse/status/<report id>.<secret>`. It is shown after submitting, and emailed to reporters who give an address. Only a hash of the secret is stored. The page shows the reported site, the type, and whether the case is received, under investigation or closed. It never shows staff notes, other reporters or the action taken.

## Closing a case

When staff set a report to **Resolved** or **Dismissed**, every reporter who left an email is told the case is closed, once per closed status. A failed email is retried the next time the report is saved.
