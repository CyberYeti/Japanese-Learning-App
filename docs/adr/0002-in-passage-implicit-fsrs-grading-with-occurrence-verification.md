# In-passage Implicit FSRS Grading with Occurrence Verification

We grade due vocabulary implicitly through reading behavior (untapped = Good, tapped = Again), but only award Good ratings to items verified to appear in the generated passage.

## Context
Traditional SRS relies on flashcard recall drills. In this app, reading immersion is the primary study vehicle: when a user reads a passage without tapping a word for a dictionary gloss, it demonstrates natural reading recall. However, LLM generation can omit target words requested in the prompt.

## Decision
During passage completion, the app runs token matching to verify which target due items actually occurred in the text:
1. Target due items that appear and are untapped receive a `Good` rating in ts-fsrs.
2. Any tapped item receives an `Again` rating.
3. Target items omitted by the LLM receive no review log and remain due.
4. Grammar points are graded solely through explicit comprehension questions, not taps.

## Consequences
- Preserves immersive graded reading without disrupting the flow for manual grading after every sentence.
- Prevents false-positive stability inflation for words the user never actually encountered.
