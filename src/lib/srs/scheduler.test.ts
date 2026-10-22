import { describe, expect, it } from 'vitest';
import { isDue, itemStatus, newScheduledItem, Rating, review, State, type ScheduledItem } from './scheduler';

const now = new Date('2026-10-21T12:00:00Z');
const DAY = 86_400_000;

const item = (overrides: Partial<ScheduledItem> = {}): ScheduledItem => ({ ...newScheduledItem('word', '食べる|たべる', now), ...overrides });

const reviewItem = (stability: number, overrides: Partial<ScheduledItem> = {}) =>
	item({
		state: State.Review,
		stability,
		difficulty: 5,
		reps: 5,
		scheduled_days: Math.round(stability),
		last_review: new Date(now.getTime() - stability * DAY).toISOString(),
		due: now.toISOString(),
		status: stability >= 7 ? 'known' : 'learning',
		...overrides
	});

describe('itemStatus', () => {
	it('is learning for a new or learning item', () => {
		expect(itemStatus(item())).toBe('learning');
		expect(itemStatus(item({ state: State.Learning, stability: 30 }))).toBe('learning');
	});

	it('is learning for a review item below 7 days stability', () => {
		expect(itemStatus(reviewItem(6.9))).toBe('learning');
	});

	it('is known for a review item at 7 days stability or more', () => {
		expect(itemStatus(reviewItem(7))).toBe('known');
	});

	it('is learning while relearning, whatever the stability', () => {
		expect(itemStatus(reviewItem(20, { state: State.Relearning }))).toBe('learning');
	});

	it('is known when manually overridden', () => {
		expect(itemStatus(item({ manual_override: true }))).toBe('known');
	});
});

describe('isDue', () => {
	it('is due at or after its due time', () => {
		expect(isDue(item({ due: now.toISOString() }), now)).toBe(true);
		expect(isDue(item({ due: new Date(now.getTime() + 1000).toISOString() }), now)).toBe(false);
	});
});

describe('review', () => {
	it('schedules a new item into the future and counts the rep', () => {
		const next = review(item(), Rating.Good, now);
		expect(Date.parse(next.due)).toBeGreaterThan(now.getTime());
		expect(next.reps).toBe(1);
		expect(next.last_review).toBe(now.toISOString());
		expect(next.item_key).toBe('食べる|たべる');
	});

	it('keeps a known item known on Good', () => {
		const next = review(reviewItem(10), Rating.Good, now);
		expect(next.status).toBe('known');
		expect(next.stability).toBeGreaterThan(10);
	});

	it('drops a known item back to learning on a lapse', () => {
		const next = review(reviewItem(30), Rating.Again, now);
		expect(next.status).toBe('learning');
		expect(next.lapses).toBe(1);
		expect(next.state).toBe(State.Relearning);
	});

	it('clears a manual override on a lapse', () => {
		const next = review(reviewItem(30, { manual_override: true }), Rating.Again, now);
		expect(next.manual_override).toBe(false);
		expect(next.status).toBe('learning');
	});

	it('promotes a review item to known once stability reaches 7 days', () => {
		const next = review(reviewItem(5), Rating.Good, now);
		expect(next.stability).toBeGreaterThanOrEqual(7);
		expect(next.status).toBe('known');
	});
});
