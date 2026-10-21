"""Scrape one chapter of Tae Kim's Grammar Guide into static/data/lessons/.

Writes one JSON file per lesson ({id}.json: id, order, section, title, source_url, html,
examples) plus index.json (the same minus html and examples). Practice exercise pages are
skipped: their answers depend on the site's JavaScript.

Usage: python scripts/import_taekim.py [chapter-slug]   (default: basic)

The content is CC BY-NC-SA (see static/data/lessons/LICENSE). After importing, run
`npm run data:build` to attach each lesson's words.
"""

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

GUIDE_URL = "https://guidetojapanese.org/learn/grammar/"
OUT_DIR = Path(__file__).resolve().parent.parent / "static" / "data" / "lessons"

# Tags and attributes kept in the cleaned lesson body; everything else is unwrapped or dropped.
KEEP_TAGS = {
    "h2", "h3", "h4", "p", "ol", "ul", "li", "em", "i", "b", "strong", "br", "strike",
    "table", "caption", "thead", "tbody", "tr", "th", "td", "div", "span", "a",
}
KEEP_ATTRS = {"a": {"href"}, "th": {"colspan", "rowspan"}, "td": {"colspan", "rowspan"}}
KEEP_CLASSES = {"sumbox", "summary", "note"}
DROP_TAGS = ["script", "style", "iframe", "svg", "img"]

JAPANESE = re.compile(r"[぀-ヿ一-鿿]")
LATIN = re.compile(r"[A-Za-z]")
# Dialogue lines start with a speaker: Ａ：元気？ / ボブ：アリスは学生？, translated as "A: ..." / "Bob: ...".
SPEAKER = re.compile(r"^[^\s：。、？！]{1,8}：")
EN_SPEAKER = re.compile(r"^[A-Z][A-Za-z]{0,10}:\s*")


def parse_chapter(html: str) -> dict:
    """The chapter's section name and its lesson pages [(title, url)] in guide order."""
    soup = BeautifulSoup(html, "html.parser")
    current = soup.select_one("li.collapsing-categories.item.self")
    chapter = current.find_parent("li", class_="parent")
    section = chapter.find("a", recursive=False).get_text(strip=True)
    pages = [
        (a.get_text(strip=True), a["href"])
        for a in chapter.select("li.item a")
        if "Practice Exercises" not in a.get_text()
    ]
    return {"section": section, "pages": pages}


def parse_lesson(html: str, url: str, order: int, section: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one("article .entry-content")
    for nav in content.select(".pps-navigation-content"):
        nav.decompose()
    for tag in content.find_all(DROP_TAGS):
        tag.decompose()
    examples = extract_examples(content)
    clean(content)
    return {
        "id": urlparse(url).path.rstrip("/").split("/")[-1],
        "order": order,
        "section": section,
        "title": soup.select_one("h1.entry-title").get_text(strip=True),
        "source_url": url,
        "html": content.decode_contents().strip(),
        "examples": examples,
    }


def extract_examples(content: Tag) -> list[dict]:
    """Example sentences: list items or paragraphs of Japanese, a line break, then English."""
    examples = []
    for el in content.find_all(["li", "p"]):
        if el.find_parent(class_="sumbox"):
            continue
        br = el.find("br", recursive=False)
        if not br:
            continue
        ja = text_of(reversed(list(br.previous_siblings)))
        en = text_of(br.next_siblings)
        if SPEAKER.match(ja):
            ja, en = SPEAKER.sub("", ja), EN_SPEAKER.sub("", en)
        if ja and en and JAPANESE.search(ja) and not LATIN.search(ja) and not JAPANESE.search(en):
            examples.append({"ja": ja, "en": en})
    return examples


def text_of(nodes) -> str:
    text = "".join(n if isinstance(n, NavigableString) else n.get_text() for n in nodes)
    return re.sub(r"\s+", " ", text).strip()


def clean(content: Tag) -> None:
    for tag in content.find_all(True):
        if tag.name not in KEEP_TAGS or (tag.name == "span" and not keep_classes(tag)):
            tag.unwrap()
            continue
        classes = keep_classes(tag)
        allowed = KEEP_ATTRS.get(tag.name, set())
        tag.attrs = {k: v for k, v in tag.attrs.items() if k in allowed}
        if classes:
            tag["class"] = classes


def keep_classes(tag: Tag) -> list[str]:
    return [c for c in tag.get("class") or [] if c in KEEP_CLASSES]


def fetch(session: requests.Session, url: str) -> str:
    res = session.get(url, timeout=30)
    res.raise_for_status()
    res.encoding = "utf-8"
    time.sleep(1)  # be polite to the guide's server
    return res.text


def main() -> None:
    slug = sys.argv[1] if len(sys.argv) > 1 else "basic"
    session = requests.Session()
    session.headers["User-Agent"] = "japanese-learning-app content import (personal use)"

    chapter = parse_chapter(fetch(session, GUIDE_URL + slug))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = []
    for order, (title, url) in enumerate(chapter["pages"], start=1):
        print(f"{order:2} {title}")
        lesson = parse_lesson(fetch(session, url), url, order, chapter["section"])
        write_json(OUT_DIR / f"{lesson['id']}.json", lesson)
        index.append({k: lesson[k] for k in ("id", "order", "section", "title", "source_url")})
    write_json(OUT_DIR / "index.json", index)
    print(f"Wrote {len(index)} lessons to {OUT_DIR}")


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
