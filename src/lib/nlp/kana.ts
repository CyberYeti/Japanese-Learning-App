/** Convert katakana to hiragana, leaving everything else (including ー) unchanged. */
export function toHiragana(text: string): string {
	return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
