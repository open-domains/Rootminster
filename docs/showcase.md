# Public showcase

`/showcase` lists projects that owners chose to show, each reviewed by staff first.

## Owners

In the DNS manager for a subdomain they own, an owner can **Add to showcase** with a title (up to 60 characters), a one-line description (up to 160), up to five tags, and an optional "show my name" switch (off by default). Listings are text only and may not contain links; each one links to the subdomain itself.

A new listing, or any change to its text or tags, goes to staff as **pending**. Turning the name on or off does not need another review. Owners can remove a listing at any time. If a subdomain changes hands, the previous owner's listing is deleted.

## Staff

Pending submissions appear at the top of **Admin → Requests** under "Showcase submissions". Approve or reject with an optional note; the owner is emailed either way.

## When a listing is hidden

An approved listing is left out of the public page while:

- its subdomain is suspended or no longer owned by the person who listed it;
- an abuse report about the site is open or under investigation;
- the daily DNS health check (05:40 UTC) last returned a warning. A resolver outage does not hide listings.

The public endpoint (`getShowcase`) returns only the hostname, title, description, tags, listing date and, when the owner opted in, their display name. Links use `rel="nofollow ugc noopener noreferrer"`.
