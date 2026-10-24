import { buildSlotRequest } from "$shared/enhancer-account/badge-slots.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { EnhancerViewerBadges, EnhancerViewerSummary } from "$types/apis/enhancer-account.apis.ts";
import type { BadgeSlotGroup } from "$types/shared/components/enhancer-account.component.types.ts";
import type {
	EnhancerAccountBroadcastPayload,
	EnhancerAccountState,
} from "$types/shared/worker/enhancer-account-worker.types.ts";
import { signal } from "@preact/signals";

export class EnhancerAccountStore {
	readonly account = signal<EnhancerAccountState>({ loggedIn: false, environment: "production" });
	readonly profile = signal<EnhancerViewerSummary | null>(null);
	readonly badges = signal<EnhancerViewerBadges | null>(null);
	readonly badgesFailed = signal(false);
	readonly error = signal<string | null>(null);
	readonly busy = signal(false);

	private started = false;

	constructor(private readonly workerService: WorkerService) {}

	start(): void {
		if (this.started) return;
		this.started = true;
		void this.workerService.send("getEnhancerAccount").then((state) => {
			if (state) this.setAccount(state);
		});
		this.workerService.onBroadcast("enhancer-account-updated", (payload: EnhancerAccountBroadcastPayload) => {
			this.setAccount(payload.account);
			if (payload.error) this.error.value = payload.error;
		});
	}

	async refresh(): Promise<void> {
		if (!this.account.value.loggedIn) return;
		await Promise.all([this.loadProfile(), this.loadBadges()]);
	}

	async loadBadges(): Promise<void> {
		const result = await this.workerService.send("getEnhancerBadges");
		this.badgesFailed.value = result?.kind !== "ok";
		if (result?.kind === "ok") this.badges.value = result.data;
		else if (result?.kind === "error") this.error.value = result.message;
	}

	async login(): Promise<void> {
		this.busy.value = true;
		this.error.value = null;
		try {
			const response = await this.workerService.send("loginEnhancerAccount");
			if (!response) return;
			if (response.success) this.setAccount(response.account);
			else if (response.reason === "failed") this.error.value = response.message;
		} finally {
			this.busy.value = false;
		}
	}

	async logout(): Promise<void> {
		this.busy.value = true;
		this.error.value = null;
		try {
			await this.workerService.send("logoutEnhancerAccount");
			this.setAccount({ loggedIn: false, environment: this.account.value.environment });
		} finally {
			this.busy.value = false;
		}
	}

	async saveSlot(group: BadgeSlotGroup, assignmentId: string | null): Promise<string | null> {
		const result = await this.workerService.send("saveEnhancerBadgeSlot", buildSlotRequest(group, assignmentId));
		if (!result) return "Request timed out.";
		if (result.kind === "unauthenticated") return "Your session expired. Log in again.";
		if (result.kind === "error") return result.message;
		await this.loadBadges();
		return null;
	}

	private setAccount(state: EnhancerAccountState): void {
		const previous = this.account.value;
		this.account.value = state;
		if (!state.loggedIn) {
			this.profile.value = null;
			this.badges.value = null;
			this.badgesFailed.value = false;
			return;
		}
		const changed = !previous.loggedIn || previous.environment !== state.environment;
		if (changed || !this.profile.value) void this.refresh();
	}

	private async loadProfile(): Promise<void> {
		const result = await this.workerService.send("getEnhancerProfile");
		if (result?.kind === "ok") this.profile.value = result.data;
		else if (result?.kind === "error") this.error.value = result.message;
	}
}

const stores = new WeakMap<WorkerService, EnhancerAccountStore>();

export function getEnhancerAccountStore(workerService: WorkerService): EnhancerAccountStore {
	let store = stores.get(workerService);
	if (!store) {
		store = new EnhancerAccountStore(workerService);
		stores.set(workerService, store);
	}
	return store;
}
