# Smoke checklist

Run this by hand on a real phone before each merge into `main`, after `npm test`, `npm run stress` and the Chrome UI tests pass. Serve the folder (`python3 -m http.server 8000`) and open it from the phone over the local network, or use the deployed preview. Tick each line. Anything that fails blocks the merge.

## Start
- [ ] First visit (clear site data): the About page shows; **Start** is reachable without zooming.
- [ ] The main menu shows both roles; switching role changes the subtitle.
- [ ] Play a shift lists Five-Minute Rush, Quiet Tuesday, Manic Monday, Full Moon Friday, scenarios and weather.

## Charge nurse (Manic Monday)
- [ ] The first-shift card shows and **Start the shift** starts the clock.
- [ ] Register and triage a walk-in; place a patient in a clean room.
- [ ] Assign a provider; send EVS to a dirty room with one tap.
- [ ] **Next** jumps to the most urgent task.
- [ ] Open the Team sheet and the divert status; close both.
- [ ] Pause, then resume; the clock stops and starts.
- [ ] Switch to the list board and back to the floor plan.

## Attending (Manic Monday)
- [ ] Open your patient; sign orders from at least two menus.
- [ ] Results come back; pick a diagnosis; make the disposition call.
- [ ] A patient of yours in cardiac arrest shows **Run the code** with a countdown; each rhythm check is a card with a result card after it, and the code resolves.
- [ ] Answer a radio call; the result card explains the answer.

## End and resume
- [ ] Leave mid-shift through the menu; **Resume your shift** brings it back at the same time.
- [ ] Finish a Five-Minute Rush; the end-of-shift report shows scores, stars and the M&M lines.

## Class code
- [ ] Make a code; it scrolls into view with no sideways scrolling, says "Class results are on", and the **instructor key is hidden**. Show key shows it; Copy key says Copied only if it worked.
- [ ] Enter the code on a second device; both get the same first patients.
- [ ] A mistyped code is refused before Start.
- [ ] On the second device, finish the shift (a Five-Minute Rush is quickest). The Send box shows the score being sent; an email address in the name box is refused; Send with a first name says it went. Leaving the summary before sending asks first.
- [ ] On the first device, Class results lists the code; Results shows the result. Download CSV saves a file. Delete it (it asks first; a quick double tap doesn't delete).
- [ ] Forget the key on that device; the code leaves the list. "A code made on another device" with the code and the key typed in opens it again.
- [ ] On a third device or a private window with no key, Class results shows no names, only "Open with an instructor key".

## Learn
- [ ] Orientation chapter 1 runs to the end.
- [ ] One guided lesson and one case-card lesson run to the end.
- [ ] The Words glossary opens and searches.

## Platform
- [ ] 3D floor on: it draws and rooms can be tapped. 3D off: the flat map shows.
- [ ] Turn the phone sideways and back; the layout follows.
- [ ] Airplane mode, then reload: the game still opens (offline).
- [ ] Reduced motion on (phone setting): figures stop walking, nothing blinks.
