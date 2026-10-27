# Openly licensed beginner Japanese curricula

Research for [#16](https://github.com/CyberYeti/Japanese-Learning-App/issues/16), part of the map [#14](https://github.com/CyberYeti/Japanese-Learning-App/issues/14). Checked against primary sources on 2026-10-27.

The question: which openly licensed beginner Japanese resources cover kana-known to about N5, and could any of them supply the Beginner Track's lesson content in a public GitHub Pages repo?

## Short answer

Two university open textbooks fit much better than the three candidates named in the ticket.

- **Japanese Introductory 1** by Iori Hamada, Monash University. CC BY-NC 4.0. It has the best granularity of anything I found. Each page teaches one concept ("6.6 The Particles に and へ to Indicate Destinations"), each chapter opens with a word table, kanji carry readings in brackets, and it ends at past tense, te-form requests and たい. It is roughly the first half of N5. It also teaches kana, which we would skip.
- **Step-by-Step Japanese 1** by Mimi Yu, UT San Antonio. CC BY 4.0, the most permissive license here. It assumes kana is known, which matches our learner. It has 42 very small polite-form modules, each with a dialogue and a vocabulary table. It stops at あります/います, so it covers less N5 grammar than Monash.

The three named candidates mostly fall away.

- **IRODORI** is not openly licensed. Its terms allow private and classroom use. They let you publish your own free materials made from it, with a source credit. They do not allow general reproduction. It is also organised by life situations, not grammar. Use it as a reference, not a source.
- **Wikibooks Japanese** is CC BY-SA 4.0 and freely redistributable, but the beginner material is an unfinished outline. There is no ordered lesson sequence to import.
- **Imabi** carries only "Copyright 2009-2026" and no license, so it is all rights reserved. Its beginner lessons are dense and use unintroduced kanji. Not usable.

A third open textbook, **Beginning Japanese for Professionals** by Emiko Konomi, Portland State University, is CC BY-NC 4.0 and covers JLPT 5 and 4 grammar across three books. It is romaji-first and packs several grammar points into each dialogue. It is useful as a reference for later N5 topics, but its granularity is a poor fit.

No source covers the whole kana-known-to-N5 range with one concept per lesson. Every option would need us to author the plain-form and later-N5 material ourselves, whichever one we pick. Importing Monash or Step-by-Step as the early spine is legally fine for this app.

## What the licenses mean for this repo

The app is personal and non-commercial, and it ships from a public repo. The existing Tae Kim content is CC BY-NC-SA.

- **CC BY 4.0** (Step-by-Step). We can copy, adapt and republish with attribution. Adapted text can go under any license, including CC BY-NC-SA to match Tae Kim.
- **CC BY-NC 4.0** (Monash, Portland State). The same, except no commercial use. A free personal app on GitHub Pages is non-commercial. NC limits what we do. It does not care that GitHub is a company. CC BY-NC has no share-alike clause. The CC FAQ says only that an adaptation of NC material "should also contain the NC restriction", and BY-NC-SA does. So it can sit next to Tae Kim, or be blended with it, under BY-NC-SA.
- **CC BY-SA 4.0** (Wikibooks). We can redistribute it, but an adapted lesson built from it must be licensed BY-SA or a license CC has listed as BY-SA compatible. BY-NC-SA is not on that list, and the NC terms forbid dropping NC. So one adapted lesson can't blend Wikibooks text with Monash or Tae Kim text. Keeping them as separate lessons in one collection is fine.
- **IRODORI terms.** These are custom terms, not CC. The rules: no reproduction "for any purpose other than for private use or use by schools or other educational institutions". Materials you make from it and publish "must be free and please specify the source". No new materials "not at all related to This Site". No commercial use. Illustrations can't be altered. Putting the textbook text into a public repo goes past private use. Clause 3 might cover app lessons derived from Irodori, but that is a reading of the terms, not a grant. If we want Irodori content, ask the Japan Foundation first.
- **Imabi.** It names no license, so default copyright applies. Reference only.

Each CC book says "except where otherwise noted". Monash credits its images separately (PxHere CC0, Wikimedia), and Step-by-Step links to Quizlet sets. We'd import text and vocabulary tables, not media, so this matters little. Monash also excludes "corporate logos and branding" from its license.

## Candidates in detail

### Japanese Introductory 1 (Monash University)

- **Source.** <https://monash.studium.pub/japanese/>. It moved there from <https://oercollective.caul.edu.au/japanese/>, which now points to it.
- **License.** "Japanese Introductory 1 Copyright © 2024 by Iori Hamada is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License, except where otherwise noted." Recommended attribution: "Japanese Introductory 1 by Iori Hamada is licensed under a Creative Commons Attribution Noncommercial 4.0 Licence by Monash University." DOI 10.60754/d0h4-3t80.
- **Coverage and order.** There are 12 chapters, and the table of contents lists every sub-lesson. Chapters 1 and 2 teach hiragana, and 4.1 introduces katakana. The grammar runs in this order: XはYです, を, word order, ですか, likes and dislikes, の and も, numbers, これ/それ/あれ, なんですか, counting small items, と and それから, ね and よ, formal and informal styles, じゃないです, でも, ます form and verb groups, に for time, frequency words, ますか, 行く/来る, に and へ for destinations, よね, telling time, で for location and for means, open questions, から, kanji sets, position words, days and months, あります/います, large numbers, たいです, この/その/あの, ここ/そこ/あそこ, shopping, te-form, てください, てもいいですか, linking verbs with te-form, adjective conjugation, directions, ませんか, ましょう, ましょうか, 枚, past tense of adjectives, nouns, verbs and existence, and たかったです.
- **What's missing for N5.** Plain non-past and past used as their own forms, ない form, ている, comparisons, なる, つもり, and more. Chapter 5.1 introduces formal and informal speech, but the chapter titles show no plain-form verb lesson. There is no volume 2. Monash runs a unit called "Japanese introductory 2", but I found no matching open book.
- **Granularity.** One concept per page, the best match for "one small concept at a time". Each chapter has a .0 intro with learning goals and a word list, then short concept pages, then a .8 or .7 review page with exercises.
- **Vocabulary lists.** Yes. Each chapter intro has a "Words" table with columns Japanese, Romaji, English and Notes. 6.0 lists 見る, 食べる, 飲む, 読む, 会う, 使う, 行く, 帰る, 来る and する, grouped by verb class.
- **Kanji and script.** Example sentences use kanji with the reading in full-width brackets, such as 学校（がっこう）, plus romaji and audio. Chapter 7.1 introduces kanji, and later chapters teach named sets (8.1 今 何 半 上 中 下 月 火 水 木 金 土 日 曜).
- **Known-words discipline.** Not verified across the book. In 6.6 the examples use 学校, 家, クラス, 明日 and 毎日, and I didn't check whether each was taught earlier. The book makes no claim that examples stick to taught vocabulary.
- **Import.** Good. Pressbooks offers EPUB, PDF, print PDF, Pressbooks XML (WXR) and Common Cartridge downloads. The web pages are clean HTML with one lesson per URL. The interactive exercises are H5P and wouldn't carry over, which suits us, since practice is passages.

### Step-by-Step Japanese 1 (UT San Antonio)

- **Source.** <https://utsa.pressbooks.pub/sbsjapanese1/>
- **License.** "Step-by-Step Japanese 1 Copyright © 2023 by Mimi Yu is licensed under a Creative Commons Attribution 4.0 International License, except where otherwise noted." The book credits its author as "MYsensei". Published August 1, 2023.
- **Kana.** The book "is intended for those who have mastered Japanese Hiragana and Katakana". That matches our learner exactly.
- **Coverage and order.** 42 modules named for their key sentence. Self-introduction and です come first (はじめまして, 田中です, 田中くんですか, お名前は, 私は鈴木です, 出身はテキサスです, 日本人です, ソウルから来ました). Then の (テキサス大学のジョンソンです), も, numbers and age, が好きです, 何時, これ/それ/あれ and いくら, この/どの, and どこ. Verbs start at Module 26 (すしを食べますか): を, ます questions, 何をしますか, に for time, に for destinations (どこに行きますか), で for location, ません with あまり, ませんか, past ました, でした, 何か, にも, and finally あります with ここに and 中に. It ends at Module 42, "サンアントニオはどこにありますか". There's no te-form, plain form, adjective conjugation beyond the basics, or たい. That makes it roughly the first third to half of N5, and polite only. I found no volume 2.
- **Granularity.** Very fine. Each module is a short dialogue built around one pattern, followed by culture notes or an assessment. Some modules have separate "Grammar notes" pages (24.2), and others put grammar notes inside the dialogue page (29.1 explains に as a time marker).
- **Vocabulary lists.** Yes. Each dialogue has an HTML table with Audio, Japanese in kana, Romanization, Kanji and English, plus a "More Useful Words" table. Module 29 lists 毎日, 何時, に, 起きます, 起きる marked as a RU verb, 早い, 寝ます/寝る and more. The table gives polite and dictionary forms together.
- **Kanji and script.** The dialogues are written in kanji. Readings come from Pressbooks glossary popovers on each word ("Close definition" pop-ups) and from the vocabulary table. Romanization appears alongside.
- **Known-words discipline.** Partly. The vocabulary table lists every word in its dialogue, so dialogues are self-contained. Grammar-note examples bring in other words (明日, パン in 29.1), and I didn't check whether those were taught earlier.
- **Import.** Good. Pressbooks offers EPUB, PDF and Pressbooks XML downloads. The vocabulary tables are regular HTML tables with fixed columns, the easiest of any source to scrape into items. Each dialogue has an MP3 under the book license.

### Beginning Japanese for Professionals (Portland State University)

- **Source.** Books 1 to 3 at <https://pdx.pressbooks.pub/beginningjapanese1/> (also `beginningjapanese2`, `beginningjapanese3`), with Word and PDF on PDXScholar.
- **License.** "Beginning Japanese for Professionals: Book 1 Copyright © 2015 by Emiko Konomi is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License, except where otherwise noted." DOI 10.15760/pdxopen-4.
- **Coverage.** Lessons 0 to 10 across three books. Book 1 has lessons 0 to 4 and Book 3 has 9 and 10. Search snippets disagreed about Book 2, and I didn't verify that it has lessons 5 to 8. The author says it "includes many elementary grammar patterns (Japanese Language Proficiency Test Levels 5 and 4)". Topics are workplace and social life: business cards, schedules, shopping, transport and so on.
- **Granularity.** Coarse. Each lesson has four dialogues, and each dialogue comes with a vocabulary list, grammar notes and drills. Lesson 2.1 alone covers noun です/じゃないです, clock time and hesitation words.
- **Vocabulary lists.** Yes. Each dialogue has a list in romaji, kana, kanji and English, with extra words marked ＋.
- **Script.** Romaji first. "While the textbook introduces hiragana and katakana, no reading or writing instruction is included in this volume." Dialogues show romaji, then Japanese with furigana above the line.
- **Import.** Fair. It has Pressbooks HTML plus Word and PDF. The romaji-first layout means we'd rewrite example sentences rather than copy them.

### IRODORI: Japanese for Life in Japan (Japan Foundation)

- **Source.** <https://www.irodori.jpf.go.jp/en/>. Terms are at <https://www.irodori.jpf.go.jp/en/privacy.html>, under "About this site", "Copyright and usage guidelines".
- **License.** Custom terms, quoted above. Copyright stays with "the Institute, the original author, and other rights holders". The FAQ (Q21 to Q28) allows printing for classes, editing for classes, and publishing your own derived teaching materials for free. It does not allow selling, editing illustrations, or using illustrations outside Irodori teaching.
- **Coverage.** Four books: Starter (A1), Elementary 1 (A2), Elementary 2 (A2) and Pre-Intermediate (A2/B1), 18 lessons each. The FAQ says finishing Starter to Elementary 2 is about JLPT N4. So Starter plus part of Elementary 1 is roughly N5. Each lesson takes "about 4 to 5 hours", and the series has 644 kanji.
- **Ordering and granularity.** Ordered by life topics and Can-do goals, such as "Lesson 5 I like udon", "Lesson 9 Lunch is from noon to 1 o'clock" and "Lesson 16 How much is this?". It is not a grammar sequence, and each lesson is a multi-hour block. "Kanji are not taught on their own."
- **Vocabulary lists.** Yes. There are separate word list booklets for Starter, Elementary 1 and Elementary 2, plus a kanji list, a sentence patterns list and grammar worksheets.
- **Import.** Poor. Content is in heavily laid out PDFs, one per lesson, 151 MB for all of Starter. There's no HTML or data form.
- **Not verified.** I didn't open the lesson PDFs, so I can't say how Starter presents kanji and furigana or how tightly examples control vocabulary.

### Wikibooks Japanese

- **Source.** <https://en.wikibooks.org/wiki/Japanese>
- **License.** The site footer says "Text is available under the Creative Commons Attribution-ShareAlike License" and links to CC BY-SA 4.0. Additional terms may apply.
- **State.** The book is marked "75% developed", but the beginner lesson plans aren't usable as a sequence. "Sugu ni Hajimemashō" opens with a todo saying it "is being restructured" and "The following lists are in flux". It is an outline of grammar points roughly matching the old JLPT 4, with a few phrase tables. "Retropunk's Beginner Lessons" is a user-space "Very rough layout". "Practical Lessons" plans dialogue lessons ("Will you be my friend?", "Hobbies" and more) with target vocab and kanji counts. The MediaWiki API shows only `Japanese/Practical Lessons` and `/Syllabus` under that prefix, so the dialogue lessons were never written. There are about 50 scattered `Japanese/Lesson...` pages, such as existence, telling time, i-adjectives and relative clauses. I didn't check how many are redirects or stubs.
- **Vocabulary lists.** Topic lists (colours, food, family and so on), not tied to lessons.
- **Import.** Technically easy through the MediaWiki API (`action=raw`), but there's little coherent beginner content to import.

### Imabi

- **Source.** <https://imabi.org/>. Creator and author Seth Coonrod, editor Taylor V. Edwards, per the About page.
- **License.** None stated. The only notice is the footer "Copyright 2009-2026", and neither About page mentions reuse. Not redistributable.
- **Coverage.** "Beginners 1" (lessons 0 to 50) and "Beginners II" (51 to 100) cover far more than N5, in a linguistic ordering. Lesson 10, "The Copula Verb だ", covers plain だ, だった, ではない/じゃない, ではなかった and omission rules in one page.
- **Fit.** Poor. There's no vocabulary list. Lesson 10's examples use 寺, 嘘, 事実, 煙草 and 模擬試験 with no earlier introduction, and the fetched text showed no furigana. Imabi may use ruby the fetcher dropped, so that point is not verified.

### Also seen, not evaluated

Musubi (University of Hawaii) is the kana workbook that Step-by-Step recommends. It's out of scope because the learner knows kana. Marugoto is the Japan Foundation's other course. I didn't check its terms.

## Comparison

| | Monash Japanese Introductory 1 | Step-by-Step Japanese 1 | Beginning Japanese for Professionals | IRODORI | Wikibooks Japanese | Imabi |
|---|---|---|---|---|---|---|
| License | CC BY-NC 4.0 | CC BY 4.0 | CC BY-NC 4.0 | Custom JF terms, not open | CC BY-SA 4.0 | None, all rights reserved |
| Redistribute in a public repo, non-commercial | Yes, with attribution | Yes, with attribution | Yes, with attribution | Not as-is. Derived free materials maybe. Ask JF | Yes, but adaptations stay BY-SA | No |
| Mix with Tae Kim (BY-NC-SA) in one adapted lesson | Yes, result BY-NC-SA | Yes | Yes, result BY-NC-SA | No | No | No |
| Starts at kana-known | Teaches kana in ch. 1, 2 and 4.1 (skip) | Yes | Romaji-first, no reading instruction | Starts from zero | Mixed | Teaches kana |
| N5 coverage | About half. Ends at te-form, たい, past tense | About a third. Polite only, ends at あります | JLPT 5 and 4 across 3 books | Starter plus part of Elem. 1 is about N5 | Outline only | More than N5 |
| Ordering | Grammar-led | Pattern-led, very gradual | Situation dialogues | Life topics, Can-do | Not ordered | Linguistic |
| One concept per lesson | Yes | Yes, one pattern per module | No, several per dialogue | No, multi-hour lessons | n/a | No |
| Explicit vocab lists | Per-chapter word table | Per-dialogue table with kana, romaji, kanji, English | Per-dialogue list | Separate word list booklets | Topic lists only | No |
| Examples limited to taught words | Not verified | Dialogues self-contained, grammar notes not verified | Not verified | Not verified | n/a | No |
| Kanji handling | Kanji with bracketed readings, kanji sets from ch. 7 | Kanji with popover readings and table | Furigana over Japanese line | Not verified | Mixed | Kanji, readings not verified |
| Import format | Pressbooks HTML, EPUB, PDF, XML | Pressbooks HTML, EPUB, PDF, XML | Pressbooks HTML, Word, PDF | Laid-out PDFs | MediaWiki wikitext | WordPress HTML |

## What this means for "Import, author, or blend"

- No source does the whole job. Plain forms, ない, ている and the rest of N5 have no open, finely grained source. Those lessons get authored, or come from Tae Kim, whatever we choose for the early lessons.
- Monash is the strongest import candidate for granularity and grammar reach. Step-by-Step is the strongest for licensing, the kana-known start, and machine-readable vocabulary tables. Their early sequences overlap heavily, with です, の, も, こそあ, ます, に, で and あります in a similar order, so either can serve as the spine and the other as a cross-check.
- Monash's per-chapter word lists and Step-by-Step's per-dialogue tables map straight onto "lessons explicitly teach vocabulary, which becomes items on Mark complete".
- Neither book enforces the known-words rule for examples. If the Beginner Track needs a hard rule early on, plan to check or rewrite examples against the track's own vocabulary list, not trust the source.
- Attribution goes on the credits page next to Tae Kim's. For Monash, use the recommended attribution string quoted above. For Step-by-Step, credit "Step-by-Step Japanese 1 by Mimi Yu, CC BY 4.0".

## Couldn't verify

- Whether any source's examples use only previously taught vocabulary and kanji. I spot-checked one page each, not the whole book.
- IRODORI's kanji and furigana presentation and its grammar density per lesson. I didn't open the PDFs.
- Which lessons Beginning Japanese for Professionals Book 2 contains.
- Whether Imabi shows furigana as ruby. My fetch may have dropped it.
- The exact plain-form coverage in Monash chapters 5.1 and 11.2. I read the titles, not the pages.
- Whether the Wikibooks `Japanese/Lesson...` pages hold real content or are redirects.
- Whether IRODORI's clause 3 covers app lessons derived from it. Only the Japan Foundation can answer that.

## Sources

- Monash, Japanese Introductory 1: <https://monash.studium.pub/japanese/>, lesson 6.6 <https://monash.studium.pub/japanese/chapter/6-6/>, chapter 6.0 <https://monash.studium.pub/japanese/chapter/6-0/>, chapter 6.8 <https://monash.studium.pub/japanese/chapter/6-8/>, earlier host <https://oercollective.caul.edu.au/japanese/>
- UTSA, Step-by-Step Japanese 1: <https://utsa.pressbooks.pub/sbsjapanese1/>, Module 29.1 <https://utsa.pressbooks.pub/sbsjapanese1/chapter/module-29-dialogue/>
- PSU, Beginning Japanese for Professionals: <https://pdx.pressbooks.pub/beginningjapanese1/>, Before We Begin <https://pdx.pressbooks.pub/beginningjapanese1/front-matter/before-we-begin/>, Lesson 2.1 <https://pdx.pressbooks.pub/beginningjapanese1/chapter/lesson-2-1/>
- IRODORI: terms <https://www.irodori.jpf.go.jp/en/privacy.html>, FAQ <https://www.irodori.jpf.go.jp/en/faq.html>, What is Irodori <https://www.irodori.jpf.go.jp/en/about.html>, Starter downloads <https://www.irodori.jpf.go.jp/en/starter/pdf.html>
- Wikibooks: <https://en.wikibooks.org/wiki/Japanese>, <https://en.wikibooks.org/wiki/Sugu_ni_Hajimemash%C5%8D>, <https://en.wikibooks.org/wiki/Japanese/Practical_Lessons>, <https://en.wikibooks.org/wiki/User:Retropunk/Japanese_Curriculum/Outline/Beginner_Lessons>, MediaWiki API page listings
- Imabi: <https://imabi.org/>, <https://imabi.org/about-us/>, Lesson 10 <https://imabi.org/copular-sentences-i%e3%80%80%e3%82%b3%e3%83%94%e3%83%a5%e3%83%a9%e6%96%87%ef%bc%88%e6%99%ae%e9%80%9a%e4%bd%93%ef%bc%89/>
- Creative Commons FAQ, combining and adapting CC material, and collections versus adaptations: <https://creativecommons.org/faq/>
