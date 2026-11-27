import { shouldShowChangelog } from "$shared/changelog/changelog.utils.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { ChangelogEntry } from "$types/shared/changelog.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import { type Signal, signal } from "@preact/signals";
import type { Emitter } from "nanoevents";

const notifiers = new WeakMap<WorkerService, ChangelogNotifier>();

export class ChangelogNotifier {
	readonly notice: Signal<ChangelogEntry | null> = signal(null);
	private entry: ChangelogEntry | null = null;
	private loading: Promise<void> | null = null;

	constructor(
		private readonly workerService: WorkerService,
		private readonly settingsCache: SettingsCache<PlatformSettings>,
		emitter: Emitter<CommonEvents>,
	) {
		emitter.on("extension:settings-refresh", () => this.refresh());
	}

	static for(
		workerService: WorkerService,
		settingsCache: SettingsCache<any>,
		emitter: Emitter<any>,
	): ChangelogNotifier {
		let notifier = notifiers.get(workerService);
		if (!notifier) {
			notifier = new ChangelogNotifier(workerService, settingsCache, emitter);
			notifiers.set(workerService, notifier);
		}
		return notifier;
	}

	load(): Promise<void> {
		this.loading ??= this.workerService
			.send("getLatestChangelog")
			.then((response) => {
				this.entry = response?.entry ?? null;
				this.refresh();
			})
			.catch(() => {});
		return this.loading;
	}

	markSeen(): Promise<void> {
		const entry = this.notice.value;
		return entry ? this.update({ lastSeenChangelogId: entry.id }) : Promise.resolve();
	}

	disable(): Promise<void> {
		return this.update({ whatsNewEnabled: false });
	}

	showAgain(): Promise<void> {
		return this.update({ whatsNewEnabled: true, lastSeenChangelogId: null });
	}

	private async update(changes: Partial<GlobalSettings>): Promise<void> {
		await this.settingsCache.updateGlobal(changes);
		this.refresh();
	}

	private refresh(): void {
		let settings: GlobalSettings;
		try {
			settings = this.settingsCache.getGlobal();
		} catch {
			return;
		}
		this.notice.value = shouldShowChangelog(this.entry, settings) ? this.entry : null;
	}
}
