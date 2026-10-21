"""Tests for import_taekim.py. Run with: python -m unittest discover scripts"""

import unittest

from import_taekim import parse_chapter, parse_lesson

# Trimmed copy of a real chapter overview page: the sidebar expands only the current chapter.
CHAPTER_HTML = """
<html><body>
<ul>
  <li class="collapsing-categories expandable parent active">
    <a href="https://guidetojapanese.org/learn/category/grammar-guide/basic-grammar/">Basic Grammar</a>
    <div id="collapsCat-14-block-3"><ul>
      <li class="collapsing-categories item self"><a href="https://guidetojapanese.org/learn/grammar/basic">Chapter Overview</a></li>
      <li class="collapsing-categories item"><a href="https://guidetojapanese.org/learn/grammar/stateofbeing">Expressing state-of-being</a></li>
      <li class="collapsing-categories item"><a href="https://guidetojapanese.org/learn/grammar/stateofbeing_ex">State-of-being Practice Exercises</a></li>
      <li class="collapsing-categories item"><a href="https://guidetojapanese.org/learn/grammar/particlesintro">Introduction to Particles</a></li>
    </ul></div>
  </li>
  <li class="collapsing-categories expandable">
    <a href="https://guidetojapanese.org/learn/category/grammar-guide/essential-grammar/">Essential Grammar</a>
    <div id="collapsCat-15-block-3"><ul></ul></div>
  </li>
</ul>
</body></html>
"""

LESSON_HTML = """
<html><body><article class="post">
<h1 class="entry-title">Expressing state-of-being</h1>
<div class="entry-content">
<h2>Declaring something is so and so using 「だ」</h2>
<h3>Vocabulary</h3>
<ol><li>人 【ひと】 – person</li><li>学生 【がく・せい】 – student</li></ol>
<p style="color: red">Attach 「だ」 to a noun <strong>only</strong>.</p>
<div class="sumbox"><span class="summary">Declaring that something is so</span>
<ul><li>Attach 「だ」<br/>Example: <span class="popup" title="ひと - person">人</span>＋だ＝人<em>だ</em></li></ul></div>
<h3>Examples</h3>
<ol>
<li><span class="popup" title="ひと - person">人</span><em>だ</em>。<br/>Is person.</li>
<li><span class="popup" title="がくせい - student">学生</span><em>じゃない</em>。<br/>Is <i>not</i> student.</li>
<li>公園で食べた。</li>
</ol>
<p>Ａ：元気？<br/>A: (Are you) well?</p>
<p>ボブ：アリスは学生？<br/>Bob: Is Alice (you) student?</p>
<iframe src="https://www.youtube.com/embed/x"></iframe>
<table border="1" cellpadding="5"><tr align="center"><th colspan="2">Positive</th></tr></table>
<p>See <a href="https://guidetojapanese.org/learn/grammar/adjectives">adjectives</a>.</p>
<div class="pps-navigation-content"><h3 class="pps-nav-series-title">Guide to Japanese grammar</h3>
<span class="pps-nav-links"><a class="pps-nav-link pps-nav-next" href="https://guidetojapanese.org/learn/grammar/stateofbeing_ex">Next</a></span></div>
</div>
</article></body></html>
"""


class ParseChapterTest(unittest.TestCase):
    def test_lists_the_chapter_pages_in_order_skipping_practice_exercises(self):
        chapter = parse_chapter(CHAPTER_HTML)
        self.assertEqual(chapter["section"], "Basic Grammar")
        self.assertEqual(
            chapter["pages"],
            [
                ("Chapter Overview", "https://guidetojapanese.org/learn/grammar/basic"),
                ("Expressing state-of-being", "https://guidetojapanese.org/learn/grammar/stateofbeing"),
                ("Introduction to Particles", "https://guidetojapanese.org/learn/grammar/particlesintro"),
            ],
        )


class ParseLessonTest(unittest.TestCase):
    def setUp(self):
        self.lesson = parse_lesson(
            LESSON_HTML, "https://guidetojapanese.org/learn/grammar/stateofbeing", order=2, section="Basic Grammar"
        )

    def test_metadata(self):
        self.assertEqual(self.lesson["id"], "stateofbeing")
        self.assertEqual(self.lesson["order"], 2)
        self.assertEqual(self.lesson["section"], "Basic Grammar")
        self.assertEqual(self.lesson["title"], "Expressing state-of-being")
        self.assertEqual(self.lesson["source_url"], "https://guidetojapanese.org/learn/grammar/stateofbeing")

    def test_examples_pair_japanese_with_its_translation(self):
        self.assertEqual(
            self.lesson["examples"],
            [
                {"ja": "人だ。", "en": "Is person."},
                {"ja": "学生じゃない。", "en": "Is not student."},
                {"ja": "元気？", "en": "(Are you) well?"},
                {"ja": "アリスは学生？", "en": "Is Alice (you) student?"},
            ],
        )

    def test_body_drops_site_chrome_and_embeds(self):
        body = self.lesson["html"]
        self.assertNotIn("pps-", body)
        self.assertNotIn("iframe", body)
        self.assertNotIn("Next", body)

    def test_body_unwraps_popups_and_strips_presentational_attributes(self):
        body = self.lesson["html"]
        self.assertNotIn("popup", body)
        self.assertNotIn("style=", body)
        self.assertNotIn("cellpadding", body)
        self.assertNotIn("align=", body)
        self.assertIn("<li>人<em>だ</em>。<br/>Is person.</li>", body)

    def test_body_keeps_structure_links_and_callout_classes(self):
        body = self.lesson["html"]
        self.assertIn('<div class="sumbox">', body)
        self.assertIn('<th colspan="2">Positive</th>', body)
        self.assertIn('<a href="https://guidetojapanese.org/learn/grammar/adjectives">adjectives</a>', body)
        self.assertIn("<strong>only</strong>", body)


if __name__ == "__main__":
    unittest.main()
