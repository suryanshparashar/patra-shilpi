# Updates

A running log of notable changes to PatraShilpi, newest first.

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
