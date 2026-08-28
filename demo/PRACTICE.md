# Practice run — using Proofline yourself

No recording. Just you, learning what the tool does. Take your time.

You will need **two terminal windows** open at the same time:

- **Terminal A** runs the app. It stays running and you leave it alone.
- **Terminal B** is where you type everything else.

---

## Opening a terminal

Press `Windows key`, type `powershell`, press Enter. Do that twice so you
have two windows. Put them side by side.

---

## Terminal A — start the app (do this once, then leave it)

Type these two lines, pressing Enter after each:

```powershell
cd "C:\Users\Yoma Maroh\proofline\app"
npm run dev
```

You should see:

```
Subscription dashboard running at http://localhost:4000
```

**Leave this window alone from now on.** If you close it, the app stops.

Use `npm run dev`, not `node server/index.js`. `npm run dev` restarts the
server for you whenever the code changes. With the plain command you would
have to stop and start it by hand after every edit — and forgetting once
makes Proofline test code you are no longer running.

> The quotes around the path matter, because `Yoma Maroh` has a space in it.
> Without quotes Windows reads it as two separate things and errors.

---

## Look at the app

Open your browser and go to **http://localhost:4000**

You should see a card: *Your Subscription*, current plan **Free**, and an
**Upgrade to Pro** button.

Try it:
1. Click **Upgrade to Pro** — the plan changes to Pro, and Advanced Reports
   appears.
2. Press **F5** to reload the page — still Pro. It was really saved.
3. Click **Reset to Free (dev/testing)** to put it back.

That is the app working correctly. Everything below is about proving it
*stays* correct when code changes.

---

## Terminal B — go to the tool

```powershell
cd "C:\Users\Yoma Maroh\proofline\proofline-cli"
```

Check it responds:

```powershell
node bin/proofline.js --help
```

You should see the usage text. If you see `'C:\Users\Yoma' is not
recognized`, you forgot the quotes, or you forgot to type `node` first.

---

## Step 1 — Break the app on purpose

```powershell
node ..\demo\break.js
```

It prints: *Regression introduced: upgradeToPro() no longer persists the plan.*

**Do not touch Terminal A** — it restarts itself. Wait about three seconds.

**See the bug in your browser:** reload http://localhost:4000, click
**Upgrade to Pro** — it says Pro. Now press **F5**. It says **Free** again.

That is the bug. The screen lied to you.

---

## Step 2 — Ask what's at risk (fast, costs nothing)

Back in **Terminal B**:

```powershell
node bin/proofline.js --repo .. --dry-run
```

Takes about **30 seconds**. You will see a list like:

```
AC-1   PENDING VERIFICATION
          changed by: app/server/services/subscriptionService.js
```

**What this means:** Proofline read the code change and worked out which
promises might be affected. AC-1 is listed first because it is the most at
risk. It has not tested anything yet — it is telling you where to look.

`--dry-run` means "just think, don't test." It uses no Kane credits.

---

## Step 3 — Actually verify it

```powershell
node bin/proofline.js --repo .. --report ..\proof-report.html
```

**This takes 4 to 5 minutes.** A Chrome window may flash up — that is Kane
testing your app for real. Let it finish. Go make tea.

When it finishes you should see:

```
AC-1   PRODUCT BUG -- REQUIREMENT BROKEN
AC-3   MACHINE VERIFIED
VERDICT: BLOCK
```

**What this means:**
- **AC-1 PRODUCT BUG** — it caught the bug. The promise "after upgrading,
  the plan is really saved" is broken.
- **AC-3 MACHINE VERIFIED** — this promise is still fine. The bug did not
  affect it. Proofline is not just failing everything.
- **BLOCK** — do not ship this.

---

## Step 4 — Fix it

```powershell
node ..\demo\fix.js
```

Wait about three seconds for the server to restart itself.

Check in the browser: upgrade, press F5, it stays Pro. Fixed.

---

## Step 5 — Prove it is fixed

```powershell
node bin/proofline.js --repo .. --report ..\proof-report.html
```

Another **2 to 5 minutes**. You should now see:

```
AC-1   MACHINE VERIFIED
```

The promise that was broken is now proven again.

> If AC-1 says **MACHINE VERIFIED -- HEALED** instead, that is normal on the
> first run after a fix. Run the same command once more and it settles to
> clean. This is worth knowing before you record.

---

## Step 6 — Look at the report

```powershell
start ..\proof-report.html
```

Opens in your browser. Scroll down. Each promise shows two columns:

- **Kane observed** — what the test run actually did
- **Proofline concludes** — whether that counts as proof

Find one that is **amber**. It will say Kane observed `passed`, but
Proofline concludes *not independently asserted*. That means: a test claims
to cover this promise, but nothing in it actually checks this promise.

**That disagreement is the whole point of the product.** It is the thing to
show off.

---

## Things that might confuse you

**"Why is the final verdict REVIEW REQUIRED and not SHIP?"**
Because some promises are only *test-linked* — a test mentions them but
never really checks them. Proofline will not call those proven. That is
deliberate, and it is the product's main argument. AC-1 going red then green
is the story; the ambers are the point.

**"EADDRINUSE: address already in use :::4000"**
Something is already using port 4000 - usually a server left over from an
earlier attempt. Free it, then start again:

```powershell
.\demoree-port.ps1
```

**"A Chrome window keeps appearing"**
That is Kane. It is meant to.

**"It failed with a network error"**
Kane's servers are occasionally flaky. Just run the command again.

**"Did I break something permanently?"**
No. `break.js` and `fix.js` only change four lines, and they refuse to run
if the file does not look how they expect. To check where you are:

```powershell
git -C "C:\Users\Yoma Maroh\proofline" status
```

To throw away any mess and start clean:

```powershell
git -C "C:\Users\Yoma Maroh\proofline" checkout app/
```

---

## When you are comfortable

Do the whole loop twice without reading this file. Then you are ready to
record, and `demo/VIDEO-SCRIPT.md` has the narration.
