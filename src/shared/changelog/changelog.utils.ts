import type { ChangelogEntry, ChangelogNoticeSettings } from "$types/shared/changelog.types.ts";

const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
const MAX_ID_LENGTH = 100;

export function parseVersion(version: string): [number, number, number] | null {
	if (!VERSION_PATTERN.test(version)) return null;
	const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
	return [major, minor, patch];
}

export function compareVersions(a: string, b: string): number {
	const left = parseVersion(a);
	const right = parseVersion(b);
	if (!left || !right) return Number.NaN;
	for (let index = 0; index < 3; index++) {
		if (left[index] !== right[index]) return left[index] - right[index];
	}
	return 0;
}

function isChangelogEntry(value: unknown): value is ChangelogEntry {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		isChangelogId(entry.id) &&
		typeof entry.version === "string" &&
		parseVersion(entry.version) !== null &&
		typeof entry.title === "string" &&
		typeof entry.url === "string" &&
		entry.url.startsWith("https://") &&
		typeof entry.date === "string" &&
		typeof entry.notify === "boolean"
	);
}

export function parseChangelogFeed(data: unknown): ChangelogEntry[] {
	if (!Array.isArray(data)) throw new Error("The changelog feed is not a list");
	return data.filter(isChangelogEntry).map(({ id, version, title, url, date, notify }) => ({
		id,
		version,
		title,
		url,
		date,
		notify,
	}));
}

export function selectLatestEntry(entries: ChangelogEntry[], currentVersion: string): ChangelogEntry | null {
	let latest: ChangelogEntry | null = null;
	for (const entry of entries) {
		if (!entry.notify || !(compareVersions(entry.version, currentVersion) <= 0)) continue;
		if (!latest || compareVersions(entry.version, latest.version) > 0) latest = entry;
	}
	return latest;
}

export function shouldShowChangelog(
	entry: ChangelogEntry | null,
	settings: ChangelogNoticeSettings,
): entry is ChangelogEntry {
	if (!entry || !settings.whatsNewEnabled) return false;
	return entry.id !== settings.lastSeenChangelogId;
}

export function isChangelogId(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}
