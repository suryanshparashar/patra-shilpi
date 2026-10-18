# Updates

A running log of notable changes to PatraShilpi, newest first.

## 19 October 2026

### Fact-check you can trust on screen

- **Cover-letter flags are stored and shown.** Each saved letter keeps the claims the fact-check flagged and whether it was checked at all. The cover-letter tab has its own *Fact-check* card with *Show in letter*, the flagged text is highlighted in the editor (also in History), and a flag clears once you edit that text out. A letter that was never checked says so.
- **Honest badges.** The resume card now reads "AI version fact-checked", plus "N lines edited by you. Your own edits are not fact-checked." once you change anything. The letter card does the same.
- **ATS score: role fit.** A sixth criterion, *Role fit*, scores whether the resume is for the job's role. The total is rescaled to 100, and the "Strong / Fair" label is gone. The sample software-engineer resume for a product-manager job went from 90 to 75.
- **Polish:** one Degree line in the education editor (and no repeated field of study in the PDF), and no spellcheck underlines on names, places and dates.

## 18 October 2026

### Results page redesigned as an editing workspace

- **Edit before you download.** Tabs for **Resume**, **Cover letter** and **Compare original**. Every line of the resume is editable in place (summary, skills, bullets, dates), and bullets and skills can be added or removed. The cover letter is a plain-text editor.
- **Flags you can act on.** Flagged phrases in the cover letter are highlighted behind the text and count as resolved once you edit them out. Restored resume lines show a chip with *Use rewrite* / *Use original*. A gentle confirm appears if you download a letter that still has flagged phrases.
- **The PDF follows the edits.** Both PDFs are built from the edited text. No extra model calls.
- **Sticky sidebar** with scores (ATS rubric breakdown), the fact-check, missing keywords and the save status.
- **Saved to history.** Edits are kept across a refresh, and for logged-in users saved to the run (`PATCH /api/v1/history/{id}`). The AI's versions are kept alongside, so *Reset to AI version* always works, including from History.

### Fact-check fixes

- Today's date is now given to every agent, so "Jan 2022 to Present" is counted correctly and "four years" is no longer flagged.
- The cover-letter check no longer flags the title of the job being applied for as a claim.

## 17 October 2026

### Fewer LLM calls per request: 14 → 6

A clean customization used to make 14 Gemini requests. It now makes **6**.

| Before (14) | After (6) |
|---|---|
| 6 supervisor LLM calls to pick the next step | 0 (the order is fixed in code) |
| JD Analyzer, Resume Structurer, Section Customizer, Fact-Check | unchanged (4 calls) |
| Keyword Gap and ATS Evaluator as 2 calls | 1 combined Evaluator call |
| 2 embedding calls (before and after) | 1 embedding call that gives both match scores |

- The LLM supervisor is now consulted only when the fact-check flags the draft, to decide whether to revise. A revision adds 3 calls.
- A cover letter after a run now makes 1 call instead of 2, because the run's JD analysis is sent along with the request.
- The checklist now shows 6 steps: JD, resume, customize, fact-check, evaluate, match.

### Privacy copy made accurate

The landing page and form notes said the PDF is "read in memory and discarded". They now say the PDF file is never stored, that its text goes to Google Gemini, and that logged-in users' history keeps the extracted text so runs can be re-run or deleted.
