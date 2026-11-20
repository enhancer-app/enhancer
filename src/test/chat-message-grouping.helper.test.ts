import { expect, test } from "bun:test";
import { ChatMessageGroupingHelper } from "$shared/module/helpers/chat-message-grouping.helper.ts";

function createRow() {
	const attributes = new Map<string, string>();
	const classes = new Set<string>();
	return {
		getAttribute: (name: string) => attributes.get(name) ?? null,
		setAttribute: (name: string, value: string) => attributes.set(name, value),
		classList: {
			toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name), force),
			contains: (name: string) => classes.has(name),
		},
	} as unknown as Element;
}

const isGrouped = (row: Element) => row.classList.contains(ChatMessageGroupingHelper.GROUPED_CLASS);
const helper = new ChatMessageGroupingHelper([]);

test("groups a message that follows one from the same author", () => {
	const first = createRow();
	const second = createRow();
	helper.markRow(first, "1", true);
	helper.markRow(second, "1", true);

	helper.updateRow(second, first);

	expect(isGrouped(second)).toBe(true);
});

test("does not group messages from different authors", () => {
	const first = createRow();
	const second = createRow();
	helper.markRow(first, "1", true);
	helper.markRow(second, "2", true);

	helper.updateRow(second, first);

	expect(isGrouped(second)).toBe(false);
});

test("never groups a reply but lets the author's next message join it", () => {
	const message = createRow();
	const reply = createRow();
	const next = createRow();
	helper.markRow(message, "1", true);
	helper.markRow(reply, "1", false);
	helper.markRow(next, "1", true);

	helper.updateRow(reply, message);
	helper.updateRow(next, reply);

	expect(isGrouped(reply)).toBe(false);
	expect(isGrouped(next)).toBe(true);
});

test("breaks the group after a row without an author", () => {
	const systemRow = createRow();
	const message = createRow();
	helper.markRow(message, "1", true);

	helper.updateRow(message, systemRow);

	expect(isGrouped(message)).toBe(false);
});

test("ungroups a reused row that now follows a different author", () => {
	const previous = createRow();
	const row = createRow();
	helper.markRow(previous, "1", true);
	helper.markRow(row, "1", true);
	helper.updateRow(row, previous);

	helper.markRow(previous, "2", true);
	helper.updateRow(row, previous);

	expect(isGrouped(row)).toBe(false);
});
