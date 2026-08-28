# Ace Design Knowledge Base
## Interfaces, Visual Design, and Documents That Look Deliberate

This volume covers UI and UX design, visual and graphic design fundamentals, and the design of
printed documents. It is tool-agnostic — the principles apply whether the output is a web page,
an app screen, a logo, a slide, or a PDF invoice.

---

# SECTION 48: UX FUNDAMENTALS

## Design for the Task, Not the Screen

Users do not want to use software; they want an outcome. Every screen should be judged by
whether it moves someone toward what they came to do.

**Identify the primary task of every screen** and make it the most prominent thing. If
everything is equally prominent, nothing is. A screen with three equally-weighted calls to
action has no primary task and will convert worse than one that picks.

**Reduce the number of decisions.** Every choice costs attention. Sensible defaults, pre-filled
values, and fewer options produce faster completion than flexibility does.

**Show the state of the system.** People need to know what happened. A button that does nothing
visible for two seconds reads as broken. Acknowledge immediately — a spinner, a disabled state,
a confirmation.

**Match the user's language.** Interface copy should use the words the user would use, not
internal or technical terms. "Deactivate entity" means nothing to someone trying to archive a
customer.

## Hierarchy — The Core Skill

Visual hierarchy is the order in which things get noticed, and it is the difference between a
design that works and one that merely contains the right elements.

**Four tools, in rough order of strength:** size, weight, colour and contrast, and position.
A large bold dark item at the top left of a block will be seen first in left-to-right reading
cultures.

**Establish three levels and stop:** primary (the one thing), secondary (supporting), tertiary
(available but quiet). More levels than that stop being distinguishable.

**Test it by squinting.** Blur the design until you cannot read it. What still stands out is
your real hierarchy. If it is not what you intended, the design is not working, regardless of
how good the individual pieces look.

**One primary action per screen.** Style it as the only filled, high-contrast button. Secondary
actions get outline or text treatment. Two competing primary buttons make the user think.

## Layout and Spacing

**Whitespace is not wasted space** — it is what creates grouping and focus. Cramped designs read
as cheap and are harder to scan. The most common improvement available to an amateur design is
simply more space.

**Proximity signals relationship.** Things that belong together sit close; things that do not
get separated. A label far from its field, or equal spacing between everything, destroys
meaning. Space *between* groups should exceed space *within* a group — this single rule fixes a
large share of confusing layouts.

**Use a spacing scale, not arbitrary numbers.** Pick a base — commonly 4 or 8 pixels — and use
multiples: 4, 8, 16, 24, 32, 48. Consistent spacing is most of what makes a design look
professional, and it removes a hundred small decisions.

**Align things.** Every element should line up with something else. Ragged edges read as
careless. A grid, even an implicit one, does most of the work.

**Limit line length.** Roughly 50–75 characters per line for body text. Full-width text on a
wide screen is genuinely harder to read because the eye loses its place on the return.

## Forms

Forms are where most products lose people, and they are highly improvable.

**Ask for as little as possible.** Every field costs completions. Justify each one — if you will
not use it soon, do not ask now.

**One column.** Multi-column forms cause skipped fields and confuse tab order. The exception is
genuinely paired data such as city and postcode.

**Labels above fields,** always visible. Placeholder-as-label disappears the moment someone
types and leaves them unable to check what a field was for.

**Validate helpfully and at the right time.** Check on leaving a field, not on every keystroke.
Say what is wrong and how to fix it: "Password needs at least 8 characters", not "Invalid input".
Put the message next to the field, not only at the top.

**Never clear the form on error.** Making someone retype everything because one field failed is
among the most resented interactions in software.

**Mark optional fields rather than required ones** when most are required — it reduces visual
noise.

## Accessibility

Accessible design is better design for everyone, and in many contexts it is a legal requirement.

**Contrast:** body text needs a contrast ratio of at least 4.5:1 against its background; large
text at least 3:1. Light grey text on white is the most common failure and it fails for everyone
in bright light, not only for people with low vision.

**Never use colour alone to carry meaning.** Red and green look identical to many people — pair
colour with an icon, a label, or a pattern.

**Everything must work by keyboard.** Tab order should follow visual order, and focus must be
visibly indicated. Removing focus outlines without replacing them makes a site unusable for
keyboard and screen-reader users.

**Touch targets around 44×44 points minimum,** with space between them.

**Respect user settings** — text that scales, and reduced-motion preferences honoured.

## Common Interface Mistakes

Modal dialogs for things that are not urgent. Hidden navigation on desktop where there is room
to show it. Infinite scroll where people need to find something specific again. Carousels, which
are largely ignored past the first slide. Disabled buttons with no explanation of what would
enable them. Destructive actions without confirmation — or with so many confirmations that
people stop reading them.

---

# SECTION 49: VISUAL AND GRAPHIC DESIGN

## Typography

Typography carries more of a design's quality than any other element, and it is the easiest to
get quietly wrong.

**Two typefaces is plenty; one used well is fine.** More reads as unresolved. If pairing, make
them clearly different — a serif with a sans-serif — rather than two similar sans-serifs, which
looks like a mistake.

**Set a type scale rather than picking sizes ad hoc.** Multiply a base size by a consistent
ratio — around 1.25 for a restrained scale, 1.5 for a dramatic one — producing something like
14 / 16 / 20 / 25 / 31 / 39. Consistent size relationships are a large part of looking designed.

**Line height:** roughly 1.4–1.6 for body text, tighter (1.1–1.25) for large headings. Default
single spacing is too tight for comfortable reading at body sizes.

**Body text around 16px on screen, 10–12pt in print.** Smaller is a common amateur error; text
set at 12px because it "looks neater" is simply harder to read.

**Limit weights to two or three** — commonly regular for body, semibold or bold for emphasis.

**Avoid all-caps for anything longer than a short label.** Capitals remove the word shapes
readers rely on. Where used, add letter-spacing.

**Left-align body text.** Justified text without proper hyphenation creates rivers of white
space; centred text is hard to read beyond a couple of lines.

## Colour

**Start with one colour, not a palette.** A single brand colour, a neutral grey range, plus
semantic colours for success, warning, and error is enough for most work.

**The 60/30/10 guide:** roughly 60% dominant neutral, 30% secondary, 10% accent. The accent is
what draws the eye, which is why the primary button gets it and little else does.

**Neutrals do most of the work.** A design is mostly greys and whites with colour used sparingly
for emphasis. Beginners use too much colour and end up with nothing standing out.

**Build a range of greys, not one.** Text, secondary text, borders, and backgrounds each need
their own value. Pure black text on pure white is harsh — very dark grey usually reads better.

**Colour carries meaning that varies by context and culture,** but in business interfaces red
signals error or destruction, green success, amber warning. Do not use red for a primary action
that is not destructive.

**Check contrast as you choose, not afterwards.** Brand colours frequently fail contrast when
used for text, which is why they often belong on buttons rather than in body copy.

## Composition and Layout

**Alignment, proximity, repetition, contrast.** Nearly all visual design quality reduces to
these four: line things up, group related things, repeat consistent patterns, and make different
things clearly different rather than slightly different.

**Slightly different is the enemy.** Two greys that are almost the same, two spacings a few
pixels apart — these read as errors. Either make them the same or make the difference obvious.

**Give the composition a focal point** and let everything else support it.

**Consistency across screens matters more than perfection on one.** The same button in the same
place behaving the same way is what makes a product feel solid.

## Logos and Brand Basics

**A logo must work small, in one colour, and without the wordmark.** Test it at favicon size
before falling in love with the detail.

**Simple outlasts fashionable.** Gradients, bevels, and intricate illustration date quickly and
reproduce badly at small sizes or in a single colour.

**A brand is a system, not a logo:** the typefaces, the colour range, the spacing, the tone of
the writing, the way photographs are treated. Consistency across those is what creates
recognition.

**Keep clear space around a logo** and never stretch it non-proportionally, recolour it
arbitrarily, or place it on a background that kills its contrast.

## Working With Images

**Quality and consistency beat quantity.** A few good photographs treated the same way look far
better than many inconsistent ones.

**Real beats stock.** Actual premises, actual team, actual work outperforms generic imagery in
both trust and conversion.

**Mind the file:** photographs as JPEG or WebP, graphics and screenshots as PNG, logos and icons
as SVG so they stay sharp at any size. Oversized images are the most common cause of slow pages.

**Ensure text over an image stays readable** with an overlay or a scrim — text placed directly
on a busy photograph fails as soon as the image changes.

---

# SECTION 50: DOCUMENT AND PRINT DESIGN

## Documents Are Not Web Pages

A printed document has fixed page boundaries, no scrolling, no interaction, and is often read in
a different posture than a screen. Design accordingly.

**Set sensible margins** — around 0.75 to 1 inch. Text running close to the page edge looks
cheap and can be cut by printers.

**Use points for print type.** Body text at 10–12pt; below 9pt is uncomfortable for most readers
and inaccessible for some.

**Control page breaks deliberately.** A heading must not sit alone at the foot of a page, a
table row should not split across pages, and a paragraph should not leave a single line stranded.
In CSS: `break-after: avoid` on headings, `break-inside: avoid` on rows and list items.

**Design in black and white first.** Documents get printed on monochrome printers and
photocopied. If the design depends on colour to be understood, it will fail — and colour-coded
information must also be distinguishable without colour.

**Right-align numbers in tables** and use tabular figures so digits line up in columns. Money
columns that do not align are the clearest signal of an amateur document.

## Structuring a Business Document

**Lead with what it is.** A masthead naming the document type and carrying the reference number
and date. A reader picking up a page should identify it in a second.

**Put the important information where it is looked for.** Invoices: amount due and due date,
prominently. Proposals: the outcome and the price. Reports: the conclusion first, evidence after
— business readers rarely read to the end before deciding.

**One idea per section, with headings that say something.** "Findings" tells the reader nothing;
"Response times are costing roughly $4,000 a month" tells them everything.

**Keep it as short as it can be.** A one-page proposal that gets read beats a twelve-page one
that gets skimmed.

## The Common Documents

**Invoice.** Document type and number, issue date, due date and terms, sender details, recipient
details, itemised lines with quantity and rate, total prominently, payment instructions. Every
figure must be arithmetically correct and the total unmistakable.

**Quote or estimate.** As an invoice, but clearly labelled as a quote, with validity period and
a statement of what is and is not included. Ambiguous scope in a quote becomes a dispute later.

**Proposal.** Their situation as you understand it, the cost of leaving it, what you propose,
what it produces, what it costs, what happens next. Written about them, not about you — a
proposal that opens with your company history is answering a question nobody asked.

**Contract or agreement.** Parties, scope and exclusions, price and payment schedule, timeline,
ownership of work, termination and notice, liability, and dispute resolution. Numbered clauses
so they can be referred to.

**Report.** Summary and conclusion first, then method, findings, and recommendations. Charts
labelled so they stand alone without the surrounding text.

**Letter.** Sender and recipient details, date, a clear subject line, one purpose, and a specific
requested action.

## Practical Print CSS

Define the page with `@page { size: Letter; margin: 0.75in; }` and switch to `A4` outside the
US. Use `-webkit-print-color-adjust: exact` where background colour genuinely matters, since
browsers strip backgrounds when printing by default. Force a new page with `break-before: page`.
Keep headings with their content and rows intact using the break properties above. Test by
printing to PDF and looking at every page — page-break problems are invisible until you do.

---

*This knowledge base is property of OpenAce. Generated for training the Ace AI model. No
personal data, no client information, no confidential business details — only general design
knowledge and best practice.*
