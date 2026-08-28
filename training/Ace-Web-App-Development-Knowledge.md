# Ace Web & App Development Knowledge Base
## Choosing a Stack and Building Websites, Web Apps and Mobile Apps

This volume covers what to build things with and how to structure them: landing pages and
websites, web applications, mobile and desktop apps, databases, and APIs.

**Framework versions and APIs change quickly.** Use this for the shape of a decision and the
trade-offs involved; confirm exact commands, version numbers and API signatures against current
official documentation before relying on them.

---

# SECTION 51: CHOOSING WHAT TO BUILD WITH

## Match the Tool to the Job

The most common and most expensive early mistake is building a simple thing with a complex
stack. Complexity is a permanent tax on every future change.

**A brochure site, landing page, or portfolio** — plain HTML and CSS, or a static site
generator. No framework, no build step, no server. It will be faster, cheaper to host, more
reliable, and better for search than any JavaScript application doing the same job.

**A content site that non-technical people update** — a content management system or a
site builder. WordPress where plugins and a large ecosystem matter; a hosted builder where
speed of setup and no maintenance matter more than control.

**A web application with accounts, data and logic** — a framework. This is where React, Vue,
Svelte, Next.js, Django, Rails and Laravel earn their complexity.

**An internal tool** — the least impressive option that works. A spreadsheet, a form tool, or
a low-code builder frequently beats a custom application nobody has time to maintain.

**A mobile app** — only when you genuinely need the phone's hardware, offline use, push
notifications, or app store presence. A responsive website reaches everyone immediately with no
download and no review process, and most "we need an app" requirements are met by one.

## No-Code, Low-Code, or Custom

**No-code builders** — fastest to launch, lowest maintenance, no developer required. Limited by
what the platform allows, and you are subject to its pricing and its lifespan. Right for
marketing sites, simple stores, and early validation.

**WordPress** — enormous plugin ecosystem, easy content editing, cheap hosting, widely
understood. The cost is maintenance: plugins and core need regular updating, and unmaintained
installations are among the most commonly compromised things on the internet.

**Custom code** — full control, no platform limits, no per-seat fees. Costs developer time to
build and to keep running. Justified when the product is the business, or when the platform's
limits are blocking something that matters.

**A good default sequence:** validate with no-code, rebuild in custom code once the demand is
proven and the limits are real. Building custom before validating is how budgets get spent on
products nobody wanted.

## The Common Web Stacks

**Static HTML/CSS/JS** — a landing page or brochure site. Deploy anywhere, essentially free,
extremely fast.

**Static site generator** — Astro, Eleventy, Hugo, Jekyll. Content in markdown, output as static
files. Ideal for blogs, documentation and marketing sites that need many pages.

**React** — a library for building interactive interfaces from components. The largest ecosystem
and hiring pool. Not a full framework: you add routing and data fetching yourself.

**Next.js** — React plus routing, server rendering, and API routes. The common default for a
serious React application, and it handles the search-visibility problem that plain React has.

**Vue and Svelte** — alternatives to React, generally regarded as gentler to learn. Svelte
compiles away, producing notably small bundles. Smaller ecosystems and hiring pools.

**Node with Express** — a minimal JavaScript backend. One language across the whole stack.

**Django (Python)** — batteries included: admin interface, authentication, and an ORM out of the
box. Excellent when you want a working back office without building one.

**Rails (Ruby)** and **Laravel (PHP)** — similarly full-featured, strong conventions, very fast
for standard database-backed applications.

**Choosing between them matters far less than people think.** Pick what you or your team already
know. A familiar stack shipped beats an optimal stack half-learned.

## When Rendering Strategy Matters

**Client-side rendering** — the browser downloads JavaScript and builds the page. Fine for
applications behind a login. Bad for anything that needs to rank in search or load fast on a
poor connection.

**Server-side rendering** — the server sends finished HTML. Better first paint, works without
JavaScript, indexes reliably.

**Static generation** — pages built once at deploy time. Fastest and cheapest possible, right
for anything that does not change per-user.

**The rule of thumb:** marketing and content pages should be static or server-rendered;
application screens behind a login can be client-rendered. A marketing site built as a
client-rendered single-page app is the most common self-inflicted SEO problem.

---

# SECTION 52: BUILDING WEBSITES AND LANDING PAGES

## Structure of a Landing Page

Above the fold: what this is, who it is for, the outcome, and one primary action. A visitor
should understand within seconds whether it is for them.

Then, in order: the benefits as outcomes rather than features; proof — testimonials, results,
logos, numbers; how it works in three or four steps; objection handling; and the call to action
repeated. Close with a footer carrying contact details and the legal pages.

**One primary action per page.** Repeat the same action rather than offering competing ones.

**Every claim near the action needs support.** Proof placed next to the button, where the
hesitation actually happens, converts better than a testimonials page nobody visits.

## Making It Responsive

**Mobile first.** Write base styles for narrow screens and add `@media (min-width: …)` for
wider. It yields simpler CSS than overriding a desktop layout downward.

**Use fluid layout primitives.** `max-width` with `margin: 0 auto` for the container, Flexbox
and Grid for arrangement, `clamp()` for type that scales smoothly. `grid-template-columns:
repeat(auto-fit, minmax(260px, 1fr))` gives a responsive card grid with no breakpoints at all.

**Always include the viewport meta tag** — `<meta name="viewport" content="width=device-width,
initial-scale=1">`. Without it a mobile browser renders a desktop-width page zoomed out.

**Test at real sizes:** around 375px wide for a phone, 768px for a tablet, 1440px for a laptop.
Check that nothing overflows horizontally — a page that scrolls sideways on a phone reads as
broken.

**Touch targets around 44px** with space between them, and no hover-only interactions, since
there is no hover on touch.

## CSS Frameworks and Design Systems

**Tailwind CSS** is a utility-first framework: instead of writing CSS classes that describe a
component, you compose small single-purpose classes in the markup — `flex items-center gap-4
rounded-lg px-4 py-2`. The advantages are that you never invent class names, styles cannot leak
between components, the design stays consistent because everything comes from a fixed scale of
spacing, colour and type, and unused CSS is stripped at build time so the shipped file is small.
The cost is verbose markup and a build step, and it is genuinely divisive on readability. It is
the most widely adopted current approach for application interfaces.

**Component libraries** — Bootstrap, Material UI, Chakra, shadcn/ui and similar — ship
ready-made buttons, forms, modals and navigation. They save real time and give you accessibility
work you would otherwise have to do yourself. The trade is that sites built on them look like
each other unless you invest in theming, which frequently costs more than the library saved.

**Plain CSS is more capable than it used to be.** Custom properties (`--brand: #0f766e`) give you
design tokens natively, nesting is now supported, and Grid and Flexbox removed most of the reason
frameworks existed. For a landing page or a small site, plain CSS with a handful of custom
properties is often the better engineering decision — no build step, no dependency, nothing to
upgrade.

**A design system is the tokens plus the components plus the rules** — the spacing scale, the
type scale, the colour ramp, the component variants, and when to use each. It matters once more
than one person is building screens; before that, a consistent set of CSS variables does the same
job with none of the overhead.

**Choosing:** plain CSS with custom properties for sites and small projects, a utility framework
for applications with many screens, a component library when you need breadth quickly and can
live with looking conventional.

## Web Performance

Speed is a conversion and ranking factor, and images are almost always the problem.

**Images:** serve them at the size they display, use modern formats (WebP or AVIF), add
`loading="lazy"` to anything below the fold, and always set `width` and `height` so the layout
does not jump as they load.

**Fonts:** limit families and weights, use `font-display: swap` so text renders immediately, and
self-host or preconnect to the font provider. Web fonts are the second most common cause of slow
pages.

**JavaScript:** the fastest script is the one you do not ship. Question every dependency; a
date-formatting library for one date is a poor trade.

**Serve compressed, cache static assets aggressively,** and put a CDN in front of anything with
a geographically spread audience.

**Measure rather than guess.** Browser dev tools and public page-speed tools will tell you what
is actually slow, which is regularly not what you assumed.

## SEO for Sites and Apps

**The technical baseline:** one `<h1>` per page, descriptive `<title>` and meta description per
page, semantic headings in order, descriptive alt text, clean readable URLs, a sitemap and
robots.txt, canonical tags where content can be reached by multiple URLs, and HTTPS.

**Content is the actual ranking work.** Pages that answer a real question a person searched for,
one clear topic per page.

**Local businesses:** a page per service and per location, consistent name/address/phone
everywhere, and a complete business listing profile — usually higher return than anything
on-site.

**Ensure your content exists in the HTML.** Content that only appears after JavaScript runs
indexes unreliably. This is the practical reason marketing pages should be server-rendered or
static.

---

# SECTION 53: BUILDING WEB APPLICATIONS

## Structuring an Application

**Organise by feature, not by file type.** A folder per feature containing its components,
logic and styles beats separate folders for all components, all hooks and all styles. Features
are what you work on; file types are not.

**Keep components small and focused.** A component doing data fetching, business logic and
rendering is hard to test and hard to reuse. Separate fetching from presentation.

**Colocate what changes together.** If two files always change in the same commit, they belong
next to each other.

## State

**Most state is not global.** Keep it as local as possible; lift it only when something else
genuinely needs it. Reflexively putting everything in a global store is a common source of
tangled applications.

**Four kinds worth distinguishing:** local UI state (a dropdown being open), shared client state
(the current theme), server state (data fetched from an API), and URL state (the current filter
or page).

**Server state is not really state — it is a cache.** It can be stale, it can fail, it needs
refetching and invalidating. Purpose-built data-fetching libraries exist because hand-rolling
loading flags, error handling, caching and revalidation is repetitive and easy to get wrong.

**Put filters, tabs and pagination in the URL.** It makes views shareable, bookmarkable, and
survivable across a refresh — and it is free.

## Data Fetching and APIs

**Handle all four states in the interface:** loading, empty, error, and success. Applications
that only handle success feel broken the first time a request fails or a list is empty.

**An empty state is a design opportunity,** not a blank screen — say what would appear here and
how to create the first one.

**Never trust the client.** Validate and authorise on the server for every request, regardless
of what the interface allows.

**Design the API around resources** with sensible status codes, and version it if external
consumers depend on it. Paginate anything that can grow — an endpoint returning every record
works until the day it does not.

## Databases and Schema Design

**Relational (PostgreSQL, MySQL, SQLite)** — the right default for almost everything. Structured
data, relationships, transactions, and strong consistency. PostgreSQL is the reasonable general
choice; SQLite is genuinely excellent for small applications and single-server deployments and is
routinely dismissed too early.

**Document stores (MongoDB and similar)** — flexible schemas, useful when the shape genuinely
varies. The flexibility is often a false economy: most application data is relational, and you
end up implementing joins by hand.

**Key-value stores (Redis)** — caching, sessions, queues, rate limiting. A complement to a
primary database, not a replacement.

**Schema basics:** every table gets a primary key; use foreign keys so the database enforces
relationships; pick the narrowest correct types; store timestamps in UTC; and index the columns
you filter, join and sort on.

**Normalise first, denormalise deliberately.** Store each fact once. Duplicate only when
measurement shows you need to, and know that you are now responsible for keeping copies in sync.

**Use migrations from the first day.** Schema changes tracked in version control and applied in
order are how a database stays reproducible across machines and environments.

**Never store secrets or card numbers you do not need.** The safest data is data you never
collected.

---

# SECTION 54: MOBILE AND DESKTOP APPS

## Do You Actually Need an App

An app requires a download, app store review, ongoing maintenance against OS updates, and
separate builds per platform. A responsive website has none of that.

**Genuine reasons for an app:** meaningful offline use, camera/GPS/Bluetooth/sensor access, push
notifications, background processing, heavy graphics, or the app store itself as a distribution
channel. **Poor reasons:** wanting an icon on the home screen, or believing an app looks more
serious.

**Progressive web apps** sit in between: a website that can be installed to the home screen,
work offline, and receive notifications on supported platforms. Worth evaluating before
committing to native development.

## Cross-Platform vs Native

**React Native** — one JavaScript/React codebase for iOS and Android, rendering real native
components. Strongest choice when the team already knows React. Native modules are sometimes
needed for platform-specific capability.

**Flutter** — one Dart codebase, drawing its own widgets, which gives very consistent appearance
across platforms and excellent performance. Requires learning Dart; the ecosystem is smaller
than JavaScript's but healthy.

**Native (Swift for iOS, Kotlin for Android)** — best performance, immediate access to new OS
features, and the most platform-appropriate feel. Two codebases and two skill sets.

**The practical guidance:** cross-platform for most business applications, where the saving of a
second codebase outweighs the compromises. Native where performance, deep hardware use, or
platform-specific polish is the point.

**Desktop:** Electron wraps a web application, which is why so many desktop apps are large but
quick to build; Tauri does the same with a much smaller footprint.

## App Store Realities

Both stores review submissions, and rejections are routine — build review time into any launch
plan rather than promising a date that assumes first-time approval.

**Common rejection causes:** broken functionality or crashes, missing or inaccurate privacy
disclosures, no way to delete an account where accounts exist, payment flows that bypass the
store's own purchasing for digital goods, insufficient content in a thin app, and misleading
metadata.

**Prepare in advance:** store listing copy, screenshots at required sizes, an icon, a privacy
policy at a public URL, and an accurate description of what data is collected and why.

**Every update goes through review too,** so a fix cannot ship in minutes the way a web
deployment can. That difference alone is a strong argument for keeping as much as possible on
the web.

---

*This knowledge base is property of OpenAce. Generated for training the Ace AI model. No
personal data, no client information, no confidential business details — only general technical
knowledge and best practice. Frameworks, platform rules and store policies change; verify
specifics against current official documentation.*
