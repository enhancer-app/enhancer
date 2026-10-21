import type { Logger } from "$shared/logger/logger.ts";
import type { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import {
	fetchKickFollows,
	fetchKickStatuses,
	fetchTwitchStatuses,
} from "$shared/worker/cross-platform-follows/cross-platform-follows.fetchers.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import { isStatusRefreshDue } from "$shared/utils/follows-freshness.utils.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	ChannelStatusRecord,
	CrossPlatformChannel,
	CrossPlatformFollowsRecord,
	CrossPlatformFollowsSnapshot,
	FollowedChannel,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

const KICK_FOLLOWS_MAX_AGE_MS = 30 * 60_000;
const KICK_FOLLOWS_RETRY_MS = 5 * 60_000;

export class CrossPlatformFollowsRefresher {
	private readonly inFlight = new Map<PlatformType, Promise<void>>();
	private readonly attemptedAt = new Map<PlatformType, number>();
	private kickFollowsAttemptAt = 0;

	constructor(
		private readonly logger: Logger,
		private readonly database: SharedDatabase,
		private readonly watchtimeDatabase: WatchtimeDatabase,
		private readonly vault: CredentialVault,
	) {}

	async snapshot(platform: PlatformType): Promise<CrossPlatformFollowsSnapshot> {
		const [record, statuses, pins, watchtime] = await Promise.all([
			this.database.getFollows(platform),
			this.database.getStatuses(platform),
			this.database.getPins(platform),
			this.watchtimeDatabase.getPlatformWatchtime(platform).catch(() => []),
		]);
		const pinned = new Set(pins.map((pin) => pin.login));
		const watched = new Map(watchtime.map((entry) => [entry.username, entry]));
		const watchFields = (login: string) => ({
			watchtime: watched.get(login)?.time ?? 0,
			watchedAt: watched.get(login)?.lastUpdate ?? null,
		});

		const statusByLogin = new Map(statuses.map((status) => [status.login, status]));
		const channels: CrossPlatformChannel[] = [];

		for (const channel of record?.channels ?? []) {
			const status = statusByLogin.get(channel.login);
			statusByLogin.delete(channel.login);
			channels.push({
				login: channel.login,
				displayName: status?.displayName ?? channel.displayName,
				avatarUrl: status?.avatarUrl ?? channel.avatarUrl,
				live: status?.live ?? false,
				viewers: status?.viewers ?? 0,
				title: status?.title ?? null,
				category: status?.category ?? null,
				thumbnailUrl: status?.thumbnailUrl ?? null,
				startedAt: status?.startedAt ?? null,
				lastLiveAt: status?.lastLiveAt ?? null,
				checked: !!status,
				pinned: pinned.has(channel.login),
				...watchFields(channel.login),
			});
		}
		for (const status of statusByLogin.values()) {
			if (!status.live) continue;
			channels.push({
				login: status.login,
				displayName: status.displayName ?? status.login,
				avatarUrl: status.avatarUrl,
				live: true,
				viewers: status.viewers,
				title: status.title,
				category: status.category,
				thumbnailUrl: status.thumbnailUrl ?? null,
				startedAt: status.startedAt,
				lastLiveAt: status.lastLiveAt,
				checked: true,
				pinned: pinned.has(status.login),
				...watchFields(status.login),
			});
		}

		channels.sort(
			(a, b) =>
				Number(b.live) - Number(a.live) ||
				b.viewers - a.viewers ||
				(b.lastLiveAt ?? 0) - (a.lastLiveAt ?? 0) ||
				a.displayName.localeCompare(b.displayName),
		);

		return {
			platform,
			synced: !!record,
			syncedAt: record?.syncedAt ?? null,
			checkedAt: record?.statusCheckedAt ?? null,
			problem: record?.statusProblem ?? null,
			problemSince: record?.statusProblem ? (record.statusProblemSince ?? record.statusCheckedAt) : null,
			refreshing: this.inFlight.has(platform),
			channels,
		};
	}

	async refreshIfStale(platform: PlatformType, force = false): Promise<void> {
		if (this.inFlight.has(platform)) return;

		const record = await this.database.getFollows(platform);
		if (this.inFlight.has(platform)) return;
		if (platform === "kick" && (await this.isKickFollowsSyncDue(record))) {
			this.startRefresh(platform);
			return;
		}
		if (!record) return;
		if (!isStatusRefreshDue(record, this.attemptedAt.get(platform) ?? 0, Date.now(), force)) return;
		this.startRefresh(platform);
	}

	resetKickFollowsRetry(): void {
		this.kickFollowsAttemptAt = 0;
	}

	async refreshNow(platform: PlatformType): Promise<void> {
		await this.inFlight.get(platform);
		this.startRefresh(platform);
	}

	private startRefresh(platform: PlatformType): void {
		if (this.inFlight.has(platform)) return;
		this.attemptedAt.set(platform, Date.now());
		const promise = this.refresh(platform)
			.catch((error) => this.logger.error(`Failed to refresh ${platform} follows status:`, error))
			.finally(() => {
				this.inFlight.delete(platform);
				void this.broadcast(platform);
			});
		this.inFlight.set(platform, promise);
	}

	async broadcast(platform: PlatformType): Promise<void> {
		const broadcast: WorkerBroadcast = {
			type: "cross-platform-follows-updated",
			payload: await this.snapshot(platform),
		};
		chrome.runtime.sendMessage(broadcast).catch(() => {});
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
		}
	}

	private async isKickFollowsSyncDue(record: CrossPlatformFollowsRecord | null | undefined): Promise<boolean> {
		if (record && Date.now() - record.syncedAt < KICK_FOLLOWS_MAX_AGE_MS) return false;
		if (Date.now() - this.kickFollowsAttemptAt < KICK_FOLLOWS_RETRY_MS) return false;
		return this.vault.hasCredential("kick");
	}

	private async syncKickFollows(): Promise<void> {
		this.kickFollowsAttemptAt = Date.now();
		const result = await fetchKickFollows(this.vault);
		if (!result.ok) {
			this.logger.warn(`Kick follows sync failed: ${result.problem}`);
			return;
		}
		const current = await this.database.getFollows("kick");
		await this.database.putFollows({
			platform: "kick",
			channels: result.channels,
			syncedAt: Date.now(),
			statusCheckedAt: current?.statusCheckedAt ?? null,
			statusProblem: current?.statusProblem ?? null,
			statusProblemSince: current?.statusProblemSince ?? null,
		});
		this.logger.info(`Synced ${result.channels.length} Kick follows`);
	}

	private async refresh(platform: PlatformType): Promise<void> {
		if (platform === "kick" && (await this.isKickFollowsSyncDue(await this.database.getFollows(platform)))) {
			await this.syncKickFollows();
		}
		const record = await this.database.getFollows(platform);
		if (!record) return;

		const result =
			platform === "kick"
				? await fetchKickStatuses(this.vault, record.channels)
				: await fetchTwitchStatuses(record.channels);
		const now = Date.now();

		if (!result.ok) {
			this.logger.warn(`Status refresh for ${platform} failed: ${result.problem}`);
			await this.updateRecordStatus(platform, record.statusCheckedAt, result.problem);
			return;
		}

		const previous = new Map(
			(await this.database.getStatuses(platform)).map((status) => [status.login, status] as const),
		);
		const followed = new Set(record.channels.map((channel) => channel.login));
		const next = new Map<string, ChannelStatusRecord>();

		for (const update of result.statuses) {
			const prev = previous.get(update.login);
			const lastLiveAt = update.live
				? now
				: (update.lastLiveAt ?? (prev?.live ? prev.checkedAt : (prev?.lastLiveAt ?? null)));
			next.set(update.login, {
				...update,
				id: `${platform}:${update.login}`,
				platform,
				lastLiveAt,
				checkedAt: now,
			});
		}
		for (const [login, status] of previous) {
			if (!next.has(login) && followed.has(login)) next.set(login, status);
		}

		await this.database.replaceStatuses(platform, [...next.values()]);
		const newFollows: FollowedChannel[] =
			platform === "kick"
				? result.statuses
						.filter((status) => status.live && !followed.has(status.login))
						.map((status) => ({
							login: status.login,
							displayName: status.displayName ?? status.login,
							avatarUrl: status.avatarUrl,
						}))
				: [];
		await this.updateRecordStatus(platform, now, result.partial ? "request-failed" : null, newFollows);
	}

	private async updateRecordStatus(
		platform: PlatformType,
		checkedAt: number | null,
		problem: CrossPlatformFollowsSnapshot["problem"],
		newFollows: FollowedChannel[] = [],
	): Promise<void> {
		const current = await this.database.getFollows(platform);
		if (!current) return;
		if (newFollows.length > 0) this.logger.debug(`Found ${newFollows.length} new ${platform} follows`);
		const now = Date.now();
		const problemSince = problem ? (current.statusProblem ? (current.statusProblemSince ?? now) : now) : null;
		await this.database.putFollows({
			...current,
			channels: newFollows.length > 0 ? [...current.channels, ...newFollows] : current.channels,
			statusCheckedAt: checkedAt,
			statusProblem: problem,
			statusProblemSince: problemSince,
		});
	}
}
