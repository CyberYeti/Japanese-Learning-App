# Japanese Learning App

A personal web application for Japanese language acquisition through AI-generated graded reading passages and in-context spaced repetition.

## Language

**Item**:
A discrete unit of learning tracked by the spaced repetition scheduler: a word, a grammar point, or a kanji.
_Avoid_: Card, flashcard (when referring to the underlying SRS entity)

**Passage**:
An AI-generated reading text constructed primarily from known and learning vocabulary, embedding due items for in-context review.
_Avoid_: Story, text, article

**Target Grammar**:
Grammar points explicitly assigned to a passage generation prompt (from the active lesson or due review items).
_Avoid_: Focus grammar, lesson grammar

**Coverage**:
The ratio of content tokens in a passage belonging to the user's known or learning vocabulary to total content tokens.
_Avoid_: Comprehension score, match rate

**Incidental Vocabulary**:
Tokens in an accepted passage that fall outside the user's known or learning vocabulary, rendered with immediate tap-to-define support.
_Avoid_: Unknown words, off-list words, extraneous vocabulary

**Matcher**:
A token sequence pattern (with optional regex fallback) run against tokenizer output to verify the presence of a grammar point.
_Avoid_: Grammar validator, detector

**Verified Target Item**:
A due or focus item confirmed to be present in the tokenized passage text before grading.
_Avoid_: Matched item, found item

**Offline Review Queue**:
Client-side persistent queue holding completed passage ratings until synced with the remote database.
_Avoid_: Review cache, pending reviews

