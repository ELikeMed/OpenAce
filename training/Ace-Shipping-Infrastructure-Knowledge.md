# Ace Shipping & Infrastructure Knowledge Base
## Domains, Hosting, Deployment, Payments and Keeping It Running

This volume covers everything between "the code works on my machine" and "customers are using
it": domains and DNS, hosting choices, deployment and CI/CD, payments, email, analytics,
monitoring and maintenance.

**Platform pricing, free tiers and product names change frequently.** Treat specifics here as
the shape of the decision and confirm current details with the provider.

---

# SECTION 55: DOMAINS AND DNS

## Registering a Domain

A domain is rented annually from a registrar. Buy it in your own name, on your own account —
domains registered by an agency or a departed contractor are a recurring and painful problem.

**Practical guidance:** a `.com` still carries the most trust for a business; short and
pronounceable beats clever spelling, because people will hear it as often as they read it.
Check for trademark conflicts before committing, and check the matching social handles.

**Enable auto-renew and keep the contact email current.** Expired domains are usually lost to
the same failure — a renewal notice sent to an address nobody reads any more. Enable registrar
lock and privacy protection.

## DNS Records Worth Understanding

**A record** points a domain at an IPv4 address. **AAAA** does the same for IPv6.
**CNAME** points one hostname at another — how most modern hosts want you to point `www`.
**MX** directs email for the domain to a mail provider. **TXT** holds verification strings and
email authentication records.

**Propagation.** DNS changes are cached for the length of the record's TTL, so a change can take
minutes to a day or so to be visible everywhere. Lower the TTL a day before a planned migration
and the cutover becomes far less painful.

**Email authentication matters more than most people realise.** SPF, DKIM and DMARC records tell
receiving servers that mail claiming to be from your domain is genuinely yours. Without them,
your email is much more likely to be filtered as spam — and this is the first thing to check
when someone reports that their emails are not arriving.

## HTTPS

Every site needs it — it is expected by browsers, required for modern features, and a ranking
signal. Certificates are free and automatic on essentially every modern host, so there is no
remaining reason to serve a business site over plain HTTP.

**Redirect HTTP to HTTPS,** and pick one canonical hostname — either `www` or bare domain — and
redirect the other to it, so you are not splitting search authority or confusing analytics.

---

# SECTION 56: HOSTING AND DEPLOYMENT

## Where to Host What

**Static sites and front ends** — Netlify, Vercel, Cloudflare Pages, GitHub Pages. Connect a
repository, and every push deploys. Generous free tiers, global CDN, automatic HTTPS. For a
landing page or brochure site this is essentially free and hard to beat.

**Full-stack applications** — Vercel, Netlify, Render, Railway, Fly.io. Managed platforms that
build from a repository and run a server, database and background jobs without you managing
machines.

**Virtual private server** — DigitalOcean, Linode, Hetzner, or a cloud provider's compute. Full
control and predictable cost; you own the operating system, updates, backups and security. Right
when a platform's limits or pricing genuinely bite.

**The large clouds (AWS, Google Cloud, Azure)** — every capability, and complexity and billing
to match. Powerful when you need it; frequently a poor first choice, and the source of a great
many surprise bills.

**A note on cost:** almost every small project fits comfortably in a managed platform's cheap or
free tier. Paying for and administering a server before you need one costs money and, more
importantly, attention.

## Environments and Configuration

**Keep at least two environments** — production and something that is not production. Testing a
change against live customer data is how data gets destroyed.

**Configuration comes from environment variables,** never from committed code. The same build
artefact should run in every environment with different values.

**Never commit secrets.** Add the environment file to `.gitignore` before the first commit; a
secret pushed to a repository must be rotated, not deleted, because the history keeps it and
automated scrapers find exposed keys within minutes.

**Keep an example file** — `.env.example` listing every required variable with dummy values — so
the next person can start without guessing.

## Deployment and CI/CD

**Continuous integration** runs your checks automatically on every push: install, build, lint,
test. Its value is catching the break before it reaches anyone.

**Continuous deployment** ships automatically once those checks pass. Safe and desirable once
you have tests worth trusting; premature when a failing deploy is discovered by customers.

**A workable pipeline for a small team:** push to a branch → CI installs, builds and tests → open
a pull request → deploy a preview → merge to main → deploy to production automatically.

**Preview deployments per pull request** are among the highest-value things a small team can
adopt: reviewers see the actual change running rather than reading a diff and imagining it.

**Always have a rollback.** The ability to return to the previous version in a minute matters
more than any individual deployment being flawless. Most managed platforms keep previous
deployments and make this a single click — know where that button is before you need it.

**Deploy small and often.** Large infrequent releases bundle many changes, so when something
breaks you cannot tell which change did it. Small deployments are easier to verify and trivial
to reverse.

**Run migrations deliberately.** Schema changes need to be backward-compatible with the running
version, or expect brief downtime. Add a column before writing to it; stop reading a column
before dropping it.

---

# SECTION 57: PAYMENTS

## Taking Money Online

**Use a payment processor; never build card handling yourself.** Stripe, PayPal, Square, Adyen
and their peers handle card data, compliance, fraud screening and payouts. Storing card numbers
puts you inside a compliance regime you do not want and a liability you cannot insure away
cheaply.

**Hosted checkout versus embedded fields.** A hosted checkout page — where the customer is
redirected to the processor — is the fastest to implement and dramatically reduces your
compliance burden, because card details never touch your server. Embedded fields keep the
customer on your site and look more integrated, at the cost of more work. Start hosted.

**Understand the fee structure** — typically a percentage plus a fixed amount per transaction,
with extra for international cards, currency conversion, and chargebacks. On small average
order values the fixed component matters more than the percentage.

## Implementation Essentials

**Webhooks are how you learn what actually happened.** A payment is not confirmed because the
customer reached your success page — they may close the tab, or the card may fail after
redirect. The processor's webhook is the source of truth. Verify webhook signatures, and expect
duplicates: handle events idempotently so processing the same event twice does not grant two
subscriptions or send two receipts.

**Never trust an amount sent from the browser.** Calculate the price on the server from your own
records; a price submitted by the client can be altered.

**Test with the processor's test mode and test card numbers** before going live, including the
failure paths — declined cards, expired cards, and cancelled checkouts.

**Subscriptions add real complexity:** trials, upgrades and downgrades with proration, failed
renewals and dunning, cancellations, and refunds. Use the processor's own subscription product
rather than reimplementing billing cycles.

**Keep a record of every transaction on your side,** tied to a customer and an order. Relying
solely on the processor's dashboard makes reconciliation and support painful.

## Practical Requirements

Publish clear terms, a refund policy and a privacy policy, and make them easy to find — hosted
checkouts and app stores frequently require them. Sales tax and VAT obligations depend on what
you sell and where your customers are, and some processors offer tax handling as a paid feature,
which is usually cheaper than getting it wrong.

---

# SECTION 58: EMAIL, ANALYTICS AND MONITORING

## Sending Application Email

**Transactional email — receipts, password resets, notifications — should go through a
dedicated provider** such as Postmark, SendGrid, Resend or Amazon SES. Sending directly from
your own server lands in spam folders, because reputation is everything in email delivery.

**Configure SPF, DKIM and DMARC for your sending domain.** Without them, delivery suffers badly.
This is the single most common cause of "our emails go to spam".

**Keep transactional and marketing email on separate subdomains or streams.** A marketing
campaign that generates complaints should not be able to stop password reset emails arriving.

**Handle bounces and complaints.** Repeatedly sending to dead addresses damages your reputation
for every other message.

## Analytics

**Decide the question before installing anything.** Analytics that nobody looks at is a privacy
liability with no upside.

**The few numbers that usually matter:** where visitors come from, which pages they land on,
what fraction take the action you care about, and where they drop out. Everything else is
usually curiosity.

**Track conversions, not just traffic.** Traffic without conversion data cannot tell you which
channel is worth money.

**Respect privacy rules.** Cookie consent, honest disclosure of what is collected, and a privacy
policy. Privacy-focused analytics tools avoid much of this by not using cookies or personal
data at all, and are entirely sufficient for most businesses.

## Monitoring and Error Tracking

**Uptime monitoring** — an external service that checks the site regularly and alerts you.
Learning about an outage from a customer is worse than any monitoring you skipped.

**Error tracking** — a service that captures exceptions with stack traces and context, in both
the server and the browser. Without it, you only hear about the errors a user bothers to report,
which is a small fraction of them.

**Structured logs with a request id** so one user's journey can be traced. Log enough to
diagnose and never log passwords, tokens, or full card numbers.

**Alert on what needs a human.** An alert that fires constantly gets ignored, and then the real
one is ignored too.

## Backups and Maintenance

**Back up the database on a schedule, store it somewhere separate from the server, and test a
restore.** An untested backup is a hypothesis. A backup on the same machine as the database is
not a backup.

**Know your recovery point and recovery time** — how much data you can afford to lose, and how
long you can afford to be down. Those two answers determine what your backup strategy needs to
be.

**Keep dependencies updated on a regular cadence.** Most real compromises exploit a known
vulnerability with a patch already available. Small regular updates are far safer and less
disruptive than an annual attempt to close a two-year gap.

**Renew what expires:** domains, certificates where not automatic, API keys, and paid services.
Diary them, because the failure mode is always the same — something silently lapses and the site
goes down at the least convenient moment.

---

*This knowledge base is property of OpenAce. Generated for training the Ace AI model. No
personal data, no client information, no confidential business details — only general technical
knowledge and best practice. Platform features, pricing and policies change; verify current
details with the provider.*
