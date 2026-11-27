import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";

export type ChangelogEntry = {
	id: string;
	version: string;
	title: string;
	url: string;
	date: string;
	notify: boolean;
};

export type ChangelogFeedCache = {
	entries: ChangelogEntry[];
	fetchedAt?: number;
	failedAt?: number;
};

export type ChangelogStorageArea = {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(key: string): Promise<void>;
};

export type ChangelogFeedDependencies = {
	storage: ChangelogStorageArea;
	fetchFeed: () => Promise<unknown>;
	markSeen: (id: string) => Promise<unknown>;
	version: string;
	now?: () => number;
};

export type ChangelogNoticeSettings = Pick<GlobalSettings, "whatsNewEnabled" | "lastSeenChangelogId">;

export type GetLatestChangelogResponse = {
	entry: ChangelogEntry | null;
};
