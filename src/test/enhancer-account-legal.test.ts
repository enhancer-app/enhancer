import { expect, test } from "bun:test";
import { isLegalDocumentList, isViewerSummary } from "$shared/worker/enhancer-account/enhancer-account.guards.ts";

const summary = {
	user: {
		id: "u1",
		username: "viewer",
		displayName: "Viewer",
		primaryProvider: "twitch",
		avatarUrl: null,
		createdAt: "2026-01-01T00:00:00.000Z",
	},
	identities: [],
};

test("the viewer summary accepts pending legal documents and older responses without them", () => {
	expect(isViewerSummary(summary)).toBe(true);
	expect(isViewerSummary({ ...summary, legal: { pending: [] } })).toBe(true);
	expect(isViewerSummary({ ...summary, legal: { pending: [{ document: "TERMS", version: "2.1.0" }] } })).toBe(true);
	expect(isViewerSummary({ ...summary, legal: { pending: [{ document: "TERMS" }] } })).toBe(false);
	expect(isViewerSummary({ ...summary, legal: null })).toBe(false);
});

test("the accept payload must list between one and eight short documents", () => {
	const document = { document: "PRIVACY", version: "1.3.0" };
	expect(isLegalDocumentList([document])).toBe(true);
	expect(isLegalDocumentList([])).toBe(false);
	expect(isLegalDocumentList(Array.from({ length: 9 }, () => document))).toBe(false);
	expect(isLegalDocumentList([{ document: "TERMS", version: "x".repeat(33) }])).toBe(false);
	expect(isLegalDocumentList("TERMS")).toBe(false);
});
