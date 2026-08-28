# Ace Software Engineering Knowledge Base
## Writing, Debugging, and Shipping Software

This volume covers programming fundamentals that transfer across languages, the idioms of
the languages most often encountered, web and database basics, debugging method, testing,
security, and deployment.

**A standing rule for code.** Never present code as tested when it has not been run. Never
invent an API, a function signature, a package name, or a configuration key — if the exact
name is uncertain, say so and point to the documentation. A confident wrong answer costs a
developer more time than an honest "I'm not sure, check the docs for X."

---

# SECTION 41: FUNDAMENTALS THAT TRANSFER

## Naming

Naming is the highest-leverage habit in programming because code is read far more often than
written. A good name removes the need for a comment.

**Name for what it means, not what it is.** `userEmail` not `str1`. `isEligible` not `flag`.
`retryCount` not `n`.

**Booleans read as questions:** `isActive`, `hasPermission`, `canRetry`, `shouldRetry`.
**Functions read as actions:** `calculateTotal`, `fetchUser`, `validateInput`. A function
named as a noun usually should have been a variable.

**Length should scale with scope.** A loop index living for two lines can be `i`. A module-level
value needs a full descriptive name.

**Be consistent within a codebase** — if it is `fetchUser` in one place it is not `getUser` in
another. Consistency matters more than which convention you picked.

## Functions

**A function should do one thing at one level of abstraction.** If you cannot describe it
without "and", it is probably two functions.

**Prefer few parameters.** Beyond three, pass an options object — it makes call sites
self-documenting and lets you add parameters without breaking callers.

**Avoid boolean parameters.** `render(true)` tells the reader nothing. Either two named
functions or an options object.

**Return early.** Guard clauses at the top for invalid cases keep the main path unindented and
readable. Deeply nested conditionals are usually a missing early return.

**Pure where possible.** A function that takes inputs and returns outputs without touching
anything else is trivially testable and safe to move. Push side effects — writes, network
calls, logging — to the edges.

## Errors

**Fail loudly, early, and with context.** An error message should say what was being attempted,
with what values, and what went wrong. "Error" or "Something went wrong" costs hours.

**Never swallow an exception silently.** An empty catch block hides the failure you will spend
a day looking for. If ignoring is genuinely correct, say so in a comment explaining why.

**Distinguish expected from unexpected.** A user typing a bad email is expected — validate and
return a helpful message. A database being unreachable is exceptional — log it, alert, and fail
clearly. Handling these the same way produces either noise or silence.

**Validate at the boundary.** Check data as it enters the system — user input, API responses,
file contents — then trust it internally. Validating everywhere means validating nowhere well.

## Data Structures and Complexity

Choosing the right structure eliminates more performance problems than any optimisation.

**Array/list** — ordered, fast to append, slow to search by value.
**Hash map / dictionary / object** — near-constant lookup by key. The default when you need to
find things by identifier.
**Set** — membership tests and de-duplication.
**Queue / stack** — ordered processing.

**The most common avoidable performance bug is a lookup inside a loop.** Searching an array
inside a loop over another array is quadratic — at a thousand items each that is a million
operations. Build a map first, then look up inside the loop. This single pattern accounts for a
large share of "it got slow when we added data".

**Big-O in practice:** constant is a map lookup; logarithmic is a binary search or an indexed
database query; linear is one pass; quadratic is a nested loop over the same data, and it is
where things break. You rarely need to calculate it — you need to notice when a loop contains
another loop over the same collection.

---

# SECTION 42: LANGUAGE IDIOMS

## JavaScript and TypeScript

**Use `const` by default, `let` when reassigning, never `var`.** `var` is function-scoped and
hoists, which causes bugs `const`/`let` cannot.

**`===` not `==`.** Loose equality coerces types with surprising results.

**Async:** prefer `async`/`await` over promise chains. Always handle rejection — an unhandled
rejection can terminate a Node process. `Promise.all` runs concurrently and rejects if any
reject; `Promise.allSettled` when you want every result regardless.

**Awaiting inside a loop serialises it.** If the calls are independent, build an array of
promises and await them together — this is one of the most common performance mistakes in Node.

**Optional chaining and nullish coalescing:** `user?.profile?.name ?? 'Anonymous'`. Note `??`
differs from `||` — `||` treats `0` and `''` as absent, which is usually a bug when the value
is a count or a string.

**Array methods over manual loops:** `map` to transform, `filter` to select, `reduce` to
aggregate, `find` for one item, `some`/`every` for tests.

**TypeScript:** annotate function boundaries and let inference handle the rest. Avoid `any` —
it disables the thing you installed TypeScript for; `unknown` plus a narrowing check is the
honest alternative.

**Node specifics:** ES modules use `import`, CommonJS uses `require` — mixing them causes most
"cannot use import statement outside a module" errors. Never block the event loop with
synchronous file or crypto work in a request path.

## Python

**PEP 8 conventions:** `snake_case` for functions and variables, `PascalCase` for classes, four
spaces, no tabs.

**Comprehensions over loops** for simple transformations: `[x.name for x in users if x.active]`.
Beyond one condition and one expression, use a loop — comprehension cleverness is a readability
cost.

**The mutable default argument trap:** `def f(items=[])` shares one list across every call.
Use `def f(items=None)` and assign inside.

**Context managers for resources:** `with open(path) as f:` closes the file even on an
exception. Same pattern for locks, connections, and transactions.

**F-strings** for formatting: `f"Hello {name}, you have {count} items"`.

**Virtual environments always.** Installing into the system Python creates version conflicts
that are painful to unwind.

**`if __name__ == "__main__":`** guards code that should run only when the file is executed
directly, not when imported.

## HTML and CSS

**Use semantic elements** — `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`,
`<button>`. They give the page structure for accessibility and search, for free.

**A clickable thing that performs an action is a `<button>`.** A `<div>` with a click handler is
not focusable, not keyboard-operable, and invisible to screen readers.

**Every input needs a `<label>`** with a matching `for` attribute. Placeholder text is not a
label; it disappears on focus.

**Every image needs `alt`** — descriptive if meaningful, empty (`alt=""`) if purely decorative.

**Layout: Flexbox for one dimension, Grid for two.** Flexbox for a row of buttons or a navbar;
Grid for page layout and card arrangements. Both eliminate the float and positioning hacks that
older code is full of.

**Prefer relative units:** `rem` for spacing and type so it scales with user settings, `%` and
`fr` for widths, `px` only for genuinely fixed things like borders.

**Mobile first:** write base styles for small screens, then add `@media (min-width: …)` for
larger ones. It produces simpler CSS than the reverse.

## SQL

**Select the columns you need,** not `SELECT *`. Explicit columns survive schema changes and
transfer less data.

**Index what you filter, join, and sort on.** A missing index on a `WHERE` column is the single
most common cause of a slow query. An index costs write speed and storage, so index deliberately.

**Understand the joins:** `INNER JOIN` keeps only matches; `LEFT JOIN` keeps all rows from the
left side with nulls where there is no match. Using an inner join where you meant a left join
silently drops records — a bug that looks like missing data rather than an error.

**Never build SQL by concatenating user input.** Use parameterised queries or prepared
statements. String-built SQL is how SQL injection happens, and it remains among the most
exploited vulnerabilities in real systems.

**The N+1 query problem:** fetching a list then querying once per row. One hundred rows becomes
one hundred and one queries. Fix with a join or a single `WHERE id IN (…)`.

**Wrap multi-statement changes in a transaction** so a failure halfway leaves the data
consistent.

## Shell

**Quote your variables** — `"$file"` not `$file`. Unquoted variables break on spaces, which is
the cause of most mysterious script failures.

**`set -euo pipefail`** at the top of a bash script: exit on error, error on undefined variable,
and fail a pipeline if any stage fails. Without it a script continues confidently after a failed
step.

**Test destructive commands first.** Run the `find` before adding `-delete`; echo the command
before running it in a loop.

---

# SECTION 43: WEB AND DATA FUNDAMENTALS

## HTTP and APIs

**Methods carry meaning:** GET reads and must not change anything, POST creates, PUT replaces,
PATCH partially updates, DELETE removes. GET requests that mutate data break caching and get
triggered by crawlers.

**Status codes worth knowing:** 200 OK, 201 Created, 204 No Content; 301/302 redirects; 400 bad
request, 401 not authenticated, 403 authenticated but not permitted, 404 not found, 409 conflict,
422 validation failed, 429 rate limited; 500 server error, 502/503 upstream failure. The
401-versus-403 distinction matters: 401 means "log in", 403 means "logging in won't help".

**Design REST endpoints around resources:** `/api/invoices`, `/api/invoices/42`. Verbs live in
the method, not the path.

**Always handle the failure case of a network call.** Timeouts, non-2xx responses, and malformed
bodies are normal, not exceptional.

**CORS errors are a browser policy, not a bug in your fetch.** The fix belongs on the server,
which must send the appropriate `Access-Control-Allow-Origin` header.

## Authentication and Sessions

**Never store passwords in any recoverable form.** Hash with a purpose-built algorithm — bcrypt,
scrypt, or Argon2 — which are deliberately slow. General hashes like MD5 or SHA-256 are far too
fast for password storage.

**Tokens versus sessions:** a session keeps state on the server and a cookie holds the id;
a token (commonly a JWT) carries signed claims the server verifies without lookup. Tokens scale
better but cannot be revoked before expiry unless you keep a blocklist.

**Cookies holding credentials should be `HttpOnly`** so scripts cannot read them, `Secure` so
they only travel over HTTPS, and `SameSite` to limit cross-site sending.

**Check authorisation on every request, server-side.** Hiding a button is not access control.
Any client-side check can be bypassed; the server is the only place a permission decision counts.

## JSON and Data Handling

**Parsing can throw.** Wrap `JSON.parse` in a try/catch whenever the input is not something you
produced.

**Numbers have limits.** Large integers such as IDs can lose precision in JavaScript's number
type — transmit them as strings. Never use floating point for money; use integer minor units
(cents) or a decimal type, or you will eventually be a cent out and unable to explain why.

**Dates: store UTC, display local.** Store timestamps in UTC in ISO 8601 form, convert for
display. Timezone bugs are near-universal and almost always come from storing local time.

---

# SECTION 44: DEBUGGING

## A Method That Works

Debugging is not guessing; it is narrowing. The method is the same regardless of language.

1. **Reproduce it reliably.** A bug you cannot trigger on demand cannot be verified as fixed.
2. **Read the actual error.** The whole message and the whole stack trace. The first line of a
   stack trace is usually where it surfaced; the cause is often further down or in your own
   code rather than the library's.
3. **Find the last point where the data was correct.** Print or inspect at the boundaries and
   bisect — halve the search space each time rather than reading everything.
4. **Form one hypothesis and test it.** Change one thing. Changing several at once means you
   will not know which fixed it, and often introduces a second bug.
5. **Fix the cause, not the symptom.** A null check that hides why the value is null moves the
   failure somewhere less obvious.
6. **Verify by re-running the reproduction,** then check that nothing near it broke.

**When stuck:** explain the problem out loud from the beginning. Articulating it surfaces the
assumption you have not questioned. It works often enough to be a standard technique.

**Question your assumptions in this order:** is the code you're editing the code that's running
(right file, right branch, build actually rebuilt, cache cleared)? Is the function being called
at all? Is the input what you think it is? A large share of stubborn bugs are one of these three.

**Read the error message literally.** "undefined is not a function" means the thing you called
does not exist — usually a typo, a wrong import path, or a missing await. "Cannot read property
X of undefined" means the object one level up is missing, not X.

## Common Bug Patterns

**Off-by-one** at loop boundaries and slice indices. **Async ordering** — using a value before
the await that populates it resolves. **Mutation of shared state** — one function changing an
object another depends on. **Type coercion** — a string "10" compared against a number.
**Stale cache or stale build** — the fix is correct but you are running the old artefact.
**Timezone and encoding** — data correct in one environment and wrong in another.

---

# SECTION 45: TESTING

## What to Test

**Test behaviour, not implementation.** A test that breaks when you rename a private method
without changing behaviour is a maintenance cost, not a safety net.

**Priority order for limited time:** the code that would cost money or data if wrong, then the
paths users hit constantly, then the edge cases you have already been burned by. A test for
every bug you fix prevents the same regression twice — this is the highest-value testing habit.

**The shape:** many fast unit tests of pure logic, fewer integration tests that check pieces
work together, a small number of end-to-end tests covering the critical journeys. End-to-end
tests catch the most but are slow and brittle, so keep them few and meaningful.

**Structure each test as arrange, act, assert** — set up the input, run the thing, check the
result. One logical assertion per test keeps failures diagnostic.

**Test the edges:** empty input, one item, many items, null and undefined, zero and negative
numbers, very long strings, unicode, and the error path. Bugs cluster at boundaries.

**A test that has never failed has proven nothing.** Break the code deliberately and confirm the
test catches it.

---

# SECTION 46: SECURITY

## The Failures That Actually Happen

**Injection.** Untrusted input interpreted as code or query. Parameterise SQL; never pass user
input to a shell; never `eval` it. This remains the most damaging common vulnerability.

**Broken access control.** Checking permissions in the UI but not on the server, or trusting an
id from the client. Every request must independently verify that this user may do this thing to
this object. Changing `/invoice/42` to `/invoice/43` must not reveal someone else's invoice.

**Secrets in the repository.** API keys, passwords, and tokens committed to git. Use environment
variables or a secret manager, and add the config file to `.gitignore` before the first commit —
a secret pushed to a public repo must be treated as compromised and rotated, not deleted, since
the history retains it and scrapers are fast.

**Cross-site scripting.** Rendering user content as HTML. Escape on output; treat any
`innerHTML` assignment with user data as a vulnerability until proven otherwise.

**Weak password storage.** Covered above — a slow, salted, purpose-built hash, never a fast one.

**Missing rate limits.** Login and other sensitive endpoints without throttling invite
credential stuffing.

**Outdated dependencies.** Most real compromises exploit a known vulnerability in a package that
had a patch available. Update regularly and run the audit tooling your ecosystem provides.

**Verbose errors in production.** Stack traces and database messages returned to users hand an
attacker a map. Log the detail, return something generic.

## Sensible Defaults

Validate input at the boundary and escape on output. Use the framework's built-in protections
rather than writing your own crypto or session handling. Serve everything over HTTPS. Grant the
least privilege that works — a database user for an application does not need schema rights.

---

# SECTION 47: ARCHITECTURE, GIT, AND SHIPPING

## Keeping It Simple

**Build for the problem you have.** Most small projects are made harder by architecture chosen
for a scale that never arrived. A single well-organised application beats a distributed system
nobody can debug.

**Separate concerns along real seams:** what the user sees, what decides, what stores. Business
logic that lives in a UI component or a database trigger is hard to test and hard to move.

**Duplication is cheaper than the wrong abstraction.** Wait until the third occurrence before
extracting — two similar things often diverge, and an abstraction forced over them early becomes
a tangle of options.

**Dependencies are liabilities.** Each one is code you did not write, a supply-chain surface, and
a future upgrade. For a few lines of functionality, write the few lines.

## Git

**Commit one logical change at a time,** with a message saying *why* rather than what — the diff
already shows what.

**Branch for work, keep the main branch deployable.** Never rewrite history that others have
pulled.

**Never commit secrets, build output, or dependency directories.** Set up `.gitignore` first.
Note that gitignore does not descend into an excluded directory, so `!dir/keep.txt` after `dir/`
never matches — exclude `dir/*` instead when you need exceptions.

**Before committing, read your own diff.** It catches debug statements, commented-out code, and
accidental changes more reliably than any review.

## Shipping

**Configuration comes from the environment,** not from code. The same artefact should run in
development and production with different variables.

**Log enough to diagnose without logging secrets.** Include a request id so one user's journey
can be followed through the logs. Never log passwords, tokens, or full card numbers.

**Health checks and error alerting before you need them.** Discovering an outage from a customer
is worse than any monitoring you skipped.

**Have a rollback.** The ability to return to the previous version quickly matters more than any
individual deployment being perfect.

**Back up, and test the restore.** An untested backup is a hypothesis, not a backup.

---

*This knowledge base is property of OpenAce. Generated for training the Ace AI model. No
personal data, no client information, no confidential business details — only general technical
knowledge and best practice. Language and framework specifics change; verify APIs and
configuration against current official documentation.*
