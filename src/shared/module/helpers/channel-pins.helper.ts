import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { ChannelPinsPayload } from "$types/shared/worker/pins-worker.types.ts";
import { signal } from "@preact/signals";

export class ChannelPinsHelper {
	readonly pins = signal<ReadonlySet<string>>(new Set());
	private readonly listeners = new Set<(pins: ReadonlySet<string>) => void>();
	private loaded: Promise<void> | null = null;

	constructor(
		private readonly platform: PlatformType,
		private readonly workerService: WorkerService,
	) {
		this.workerService.onBroadcast("channel-pins-updated", (payload) => this.apply(payload));
	}

	load(): Promise<void> {
		this.loaded ??= this.workerService
			.send("getChannelPins", { platform: this.platform })
			.then((payload) => {
				if (payload) this.apply(payload);
			})
			.catch(() => {
				this.loaded = null;
			});
		return this.loaded;
	}

	isPinned(login: string): boolean {
		return this.pins.value.has(login.toLowerCase());
	}

	async setPinned(login: string, pinned: boolean): Promise<void> {
		const normalized = login.toLowerCase();
		if (!normalized || this.isPinned(normalized) === pinned) return;
		const next = new Set(this.pins.value);
		if (pinned) next.add(normalized);
		else next.delete(normalized);
		this.update(next);
		await this.workerService.send("setChannelPinned", { platform: this.platform, login: normalized, pinned });
	}

	onChange(listener: (pins: ReadonlySet<string>) => void): void {
		this.listeners.add(listener);
	}

	private apply(payload: ChannelPinsPayload): void {
		if (payload.platform !== this.platform) return;
		this.update(new Set(payload.logins.map((login) => login.toLowerCase())));
	}

	private update(next: ReadonlySet<string>): void {
		const current = this.pins.value;
		if (current.size === next.size && [...next].every((login) => current.has(login))) return;
		this.pins.value = next;
		for (const listener of this.listeners) listener(next);
	}
}
