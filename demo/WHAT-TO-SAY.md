# What to say — spoken script

Read this out loud a couple of times before recording. It's written the way
you'd actually explain it to a friend, not the way a press release sounds.

**Don't read it word for word.** Get the shape of it, then say it in your
own words. If you stumble, keep going — you can cut it later.

---

## 1. Start — the problem

*(browser open on the app)*

> "Hey — so this is Proofline.
>
> Let me tell you the problem first.
>
> These days an AI agent writes your code. It makes a change, your tests go
> green, and you ship it.
>
> But here's the thing. 'My tests passed' and 'the promise I made to my
> users still works' — those are two different things. And nothing really
> checks the second one.
>
> So this is a small subscription app. You click upgrade, you get Pro."

*(click Upgrade to Pro — it says Pro)*

> "And if I refresh the page..."

*(press F5 — still Pro)*

> "...still Pro. So it actually saved. Good."

---

## 2. Break it

> "Now let me break it — the way an AI agent would break it."

*(run: node ..\demo\break.js)*

> "That changed two lines. Just two.
>
> Now watch this."

*(browser: refresh, click Upgrade to Pro)*

> "Upgrade. It says Pro. Looks fine.
>
> But if I refresh..."

*(press F5 — it says Free)*

> "...it's Free again. It never saved.
>
> So the API said success. The screen said success. But nothing was
> actually written. And honestly? Most test suites would completely miss
> this."

---

## 3. What's at risk

> "Okay. So now let's use Proofline.
>
> First I just want to ask it — what could this change have broken?"

*(run: node bin/proofline.js --repo .. --dry-run)*

> "This part is free, by the way. It's not testing anything yet. It's just
> reading my code change and thinking about it."

*(when the list appears)*

> "So these are my acceptance criteria — AC-1, AC-2, and so on. I didn't
> write these by hand. They came from my product requirements document, and
> Kane read that document and pulled them out.
>
> AC-1 is right at the top, high confidence. And AC-1 says: after somebody
> upgrades, the plan should actually be saved as Pro.
>
> Which is exactly what I broke.
>
> So it hasn't tested anything yet. It's just telling me where to look."

---

## 4. Verify — the big one

> "Now let's actually check it."

*(run: node bin/proofline.js --repo .. --report ..\proof-report.html)*

> "So now Kane takes over. It's opening a real Chrome browser and going
> through my app like a person would — clicking upgrade, refreshing,
> checking what's there.
>
> And notice it's only running the tests for the promises that were at
> risk. Not the whole suite. Just the ones that matter for this change."

*(speed this up in editing — then when the result appears)*

> "Okay so — BLOCK. Don't ship this.
>
> AC-1, AC-2, AC-6 — all product bugs. Those are all the ones about saving
> the data. Which makes sense, that's what I broke.
>
> But look at this one. **AC-3 is still green.**
>
> AC-3 is 'when you click upgrade, the page doesn't jump away.' And that
> promise is genuinely still fine. My bug didn't touch it.
>
> So it's not just panicking and failing everything because something went
> wrong. It's telling me exactly which promises broke, and which ones are
> still okay. That's the difference."

---

## 5. Fix it

> "Alright, let me fix it."

*(run: ..\demo\commit-bug.ps1  then  node ..\demo\fix.js)*

> "I'm committing the bad change first — because that's what would have
> actually happened, the agent would have committed it. And then I'm
> putting the fix in.
>
> And now I run the exact same check again."

*(run the verify command — speed up in editing)*

> "And there it is. **AC-1 is machine verified.**
>
> Not 'the tests passed.' That specific promise — the one that was broken —
> is now proven, and there's actual evidence behind it."

---

## 6. The important part

*(run: start ..\proof-report.html — the report opens)*

> "Now this is the bit I actually care about most.
>
> This is the report. I can send this to someone, stick it on a pull
> request, keep it as a record.
>
> But look at these yellow ones."

*(scroll to an amber row — point at the two columns)*

> "See this? On the left it says **Kane observed: passed.** On the right,
> Proofline says **not independently asserted.**
>
> So what's happening is — that test says it covers three different
> promises, but it only actually checks one of them. The other two are just
> along for the ride. Nothing really tested them.
>
> Kane counts all three as proven. Proofline won't. It says look, one of
> these is genuinely checked, the other two just claim to be.
>
> And there was a worse one while I was building this. Kane has a
> self-healing thing where if a test fails it rewrites it and tries again.
> One time it rewrote my test to check the screen instead of checking the
> database. It passed. And it let a real bug through.
>
> So now Proofline spots that too, and it won't let you ship on it."

---

## 7. Wrap up

> "So that's it.
>
> Kane proves a test passed. Proofline proves the promise still holds — and
> tells you when the evidence isn't actually good enough to trust.
>
> Everything you just saw is a real run. There's no fake data in this
> project at all.
>
> Thanks for watching."

*(end card with the two links)*

---

# If someone asks "why does it say REVIEW REQUIRED and not SHIP?"

Say this:

> "Because three of my promises are only test-linked — a test mentions them
> but nothing properly checks them. Proofline won't call those proven. And
> I'd genuinely rather know that than see a green tick I can't trust."

---

# Small things that help

- **Slow down.** You'll rush. Take a breath between sections.
- **It's fine to say "um" or restart a sentence.** Real people do.
- **Point at things** with your mouse when you mention them, especially AC-3
  and the two columns in the report.
- **The two moments that matter most:** AC-3 staying green, and Kane-says-passed
  vs Proofline-says-no. Slow right down on both.
- If a take goes wrong, run `..\demo\reset-demo.ps1` and go again.
