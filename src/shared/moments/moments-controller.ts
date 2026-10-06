import { Logger } from "$shared/logger/logger.ts";
import { formatMomentCountdown } from "$shared/moments/moment-countdown.ts";
import { getClaimPollDelay, isTerminalClaimStatus } from "$shared/moments/claim-status-poll.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { ClaimMomentResponse, ClaimStatus, PublicMoment } from "$types/apis/moments.apis.ts";
import type { MomentPollPhase, MomentsCardViewModel } from "$types/shared/moments-controller.types.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { ClaimMomentErrorReason, MomentClaimStatusResult } from "$types/shared/worker/moments-worker.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { type Signal, signal } from "@preact/signals";

export type MomentsControllerDeps = {
	platform: PlatformType;
	workerService: WorkerService;
	loadDismissed: () => Promise<string[]>;
	saveDismissed: (ids: string[]) => Promise<void>;
	resolveOwnLogin: () => Promise<string | null>;
	insertCommand: (command: string) => void;
};

export class MomentsController implements MomentsCardViewModel {
	readonly moment: Signal<PublicMoment | null> = signal(null);
	readonly account: Signal<EnhancerAccountState> = signal({ loggedIn: false });
	readonly claimedAt: Signal<string | null> = signal(null);
	readonly claimMethod: Signal<string | null> = signal(null);
	readonly viewerEligible: Signal<boolean | null> = signal(null);
	readonly claimBusy: Signal<boolean> = signal(false);
	readonly claimError: Signal<string | null> = signal(null);
	readonly claimReceipt: Signal<ClaimMomentResponse | null> = signal(null);
	readonly pollPhase: Signal<MomentPollPhase> = signal("idle");
	readonly pollStatus: Signal<ClaimStatus | null> = signal(null);
	readonly countdownText: Signal<string> = signal("");
	readonly hasEnded: Signal<boolean> = signal(false);
	readonly collapsed: Signal<boolean> = signal(false);
	readonly awaitingSend: Signal<boolean> = signal(false);

	private readonly logger = new Logger({ context: "moments" });
	private channelId: string | null = null;
	private enabled = true;
	private dismissed = new Set<string>();
	private dismissedLoaded = false;
	private generation = 0;
	private tickTimer: NodeJS.Timeout | undefined;
	private liveTimer: NodeJS.Timeout | undefined;

	constructor(private readonly deps: MomentsControllerDeps) {}

	start(): void {
		this.deps.workerService.onBroadcast("enhancer-account-updated", this.handleAccountBroadcast);
		void this.refreshAccount();
	}

	destroy(): void {
		this.generation++;
		this.deps.workerService.offBroadcast("enhancer-account-updated", this.handleAccountBroadcast);
		this.stopTimers();
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled) this.clearMoment();
		else void this.refreshMoment();
	}

	setChannel(externalId: string): void {
		if (!externalId || externalId === this.channelId) return;
		this.channelId = externalId;
		this.generation++;
		this.resetClaimState();
		this.collapsed.value = false;
		void this.refreshMoment();
	}

	handleApiMessage(name: string): void {
		if (name === "moment.updated") void this.refreshMoment();
	}

	handleOwnChatMessage(text: string, login?: string): void {
		if (!text.toLowerCase().includes("!redeem")) return;
		this.awaitingSend.value = false;
		void this.pollClaimStatus(login?.toLowerCase());
	}

	onClaim = (): void => {
		void this.claim();
	};

	onInsertRedeem = (): void => {
		void this.insertRedeemCommand();
	};

	onCheckAgain = (): void => {
		void this.pollClaimStatus();
	};

	onToggleCollapsed = (): void => {
		this.collapsed.value = !this.collapsed.value;
	};

	onDismiss = (): void => {
		void this.dismiss();
	};

	onLogin = (): void => {
		void this.login();
	};

	async refreshMoment(): Promise<void> {
		if (!this.enabled || !this.channelId) return;
		const generation = this.generation;
		const channelId = this.channelId;
		try {
			const response = await this.deps.workerService.send("getChannelMoment", {
				platform: this.deps.platform,
				externalId: channelId,
			});
			if (generation !== this.generation || !response) return;
			if (response.kind === "error") {
				this.logger.warn(`Failed to load moment for ${channelId}:`, response.message);
				return;
			}
			await this.applyMoment(response.moment, generation);
		} catch (error) {
			this.logger.warn(`Failed to load moment for ${channelId}:`, error);
		}
	}

	private async applyMoment(moment: PublicMoment | null, generation: number): Promise<void> {
		if (generation !== this.generation) return;
		if (!moment || (await this.isDismissed(moment.id))) {
			this.clearMoment();
			return;
		}
		const changed = this.moment.value?.id !== moment.id;
		this.moment.value = moment;
		if (changed) {
			this.resetClaimState();
			this.collapsed.value = false;
		}
		this.updateCountdown();
		this.restartTimers();
		if (this.account.value.loggedIn && !this.claimedAt.value) await this.refreshViewerState(generation);
	}

	private async claim(): Promise<void> {
		const moment = this.moment.value;
		if (!moment || this.claimBusy.value || this.hasEnded.value) return;
		this.claimBusy.value = true;
		this.claimError.value = null;
		try {
			const result = await this.deps.workerService.send("claimMoment", { momentId: moment.id });
			if (!result) {
				this.claimError.value = "Claim request timed out. Retry is safe.";
				return;
			}
			if (result.kind === "ok") {
				this.claimReceipt.value = result.claim;
				this.claimedAt.value = result.claim.claimedAt;
				this.claimMethod.value = "ACCOUNT";
				this.pollPhase.value = "idle";
				this.pollStatus.value = null;
				this.awaitingSend.value = false;
				return;
			}
			if (result.reason === "UNAUTHENTICATED") await this.refreshAccount();
			this.claimError.value = this.describeClaimError(result.reason, result.message);
		} finally {
			this.claimBusy.value = false;
		}
	}

	async insertRedeemCommand(): Promise<string | null> {
		const moment = this.moment.value;
		if (!moment || this.hasEnded.value) return null;
		const command = moment.redeemCommand;
		this.deps.insertCommand(command);
		const login = await this.deps.resolveOwnLogin();
		if (login) {
			this.awaitingSend.value = false;
			void this.pollClaimStatus(login);
		} else {
			this.awaitingSend.value = true;
		}
		return command;
	}

	private async pollClaimStatus(knownLogin?: string): Promise<void> {
		const moment = this.moment.value;
		if (!moment) return;
		if (this.pollPhase.value === "checking") return;
		const login = (knownLogin ?? (await this.deps.resolveOwnLogin()))?.toLowerCase() ?? null;
		if (!login) {
			this.awaitingSend.value = true;
			return;
		}
		const generation = this.generation;
		const momentId = moment.id;
		this.pollPhase.value = "checking";
		this.pollStatus.value = null;
		this.awaitingSend.value = false;
		for (let attempt = 0; ; attempt++) {
			if (generation !== this.generation) return;
			const result = await this.queryClaimStatus(momentId, login);
			if (generation !== this.generation || this.moment.value?.id !== momentId) return;
			if (result && this.applyClaimStatus(result)) return;
			const delay = getClaimPollDelay(attempt);
			if (delay === null) {
				this.pollPhase.value = "timeout";
				return;
			}
			await this.sleep(delay, generation);
			if (generation !== this.generation) return;
		}
	}

	private async queryClaimStatus(momentId: string, login: string): Promise<MomentClaimStatusResult | null> {
		try {
			return await this.deps.workerService.send("getMomentClaimStatus", { momentId, login });
		} catch (error) {
			this.logger.warn("Claim status request failed:", error);
			return null;
		}
	}

	private applyClaimStatus(result: MomentClaimStatusResult): boolean {
		if (result.kind === "not-found") {
			this.pollStatus.value = "NOT_LIVE";
			this.pollPhase.value = "settled";
			return true;
		}
		if (result.kind === "rate-limited" || result.kind === "error") return false;
		if (!isTerminalClaimStatus(result.status.status)) return false;
		this.pollStatus.value = result.status.status;
		this.pollPhase.value = "settled";
		if (result.status.claimedAt && (result.status.status === "GRANTED" || result.status.status === "ALREADY_CLAIMED")) {
			this.claimedAt.value = result.status.claimedAt;
			this.claimMethod.value = "CHAT";
		}
		return true;
	}

	private async login(): Promise<void> {
		const response = await this.deps.workerService.send("loginEnhancerAccount");
		if (response?.success) {
			this.account.value = response.account;
			if (this.moment.value && !this.claimedAt.value) await this.refreshViewerState(this.generation);
		}
	}

	private async refreshAccount(): Promise<void> {
		const account = await this.deps.workerService.send("getEnhancerAccount");
		if (!account) return;
		this.account.value = account;
		if (account.loggedIn && this.moment.value && !this.claimedAt.value) {
			await this.refreshViewerState(this.generation);
		}
	}

	private async refreshViewerState(generation: number): Promise<void> {
		const moment = this.moment.value;
		if (!moment || !this.account.value.loggedIn) return;
		try {
			const result = await this.deps.workerService.send("getMomentViewerState", { momentId: moment.id });
			if (generation !== this.generation || !result || this.moment.value?.id !== moment.id) return;
			if (result.kind === "unauthenticated") {
				await this.refreshAccount();
				return;
			}
			if (result.kind === "error") {
				this.logger.warn("Failed to load viewer state:", result.message);
				return;
			}
			this.viewerEligible.value = result.state.eligible;
			if (result.state.claim) {
				this.claimedAt.value = result.state.claim.claimedAt;
				this.claimMethod.value = result.state.claim.method;
			}
		} catch (error) {
			this.logger.warn("Failed to load viewer state:", error);
		}
	}

	private async dismiss(): Promise<void> {
		const moment = this.moment.value;
		if (!moment) return;
		this.dismissed.add(moment.id);
		while (this.dismissed.size > 50) {
			const oldest = this.dismissed.values().next().value;
			if (!oldest) break;
			this.dismissed.delete(oldest);
		}
		try {
			await this.deps.saveDismissed([...this.dismissed]);
		} catch (error) {
			this.logger.warn("Failed to persist dismissed moment:", error);
		}
		this.clearMoment();
	}

	private clearMoment(): void {
		this.generation++;
		this.moment.value = null;
		this.resetClaimState();
		this.collapsed.value = false;
		this.stopTimers();
	}

	private resetClaimState(): void {
		this.claimedAt.value = null;
		this.claimMethod.value = null;
		this.viewerEligible.value = null;
		this.claimBusy.value = false;
		this.claimError.value = null;
		this.claimReceipt.value = null;
		this.pollPhase.value = "idle";
		this.pollStatus.value = null;
		this.awaitingSend.value = false;
		this.hasEnded.value = false;
		this.countdownText.value = "";
	}

	private updateCountdown(): void {
		const moment = this.moment.value;
		if (!moment) return;
		const countdown = formatMomentCountdown(moment.endsAt);
		this.countdownText.value = countdown.text;
		if (countdown.ended && !this.hasEnded.value) {
			this.hasEnded.value = true;
			this.stopLiveTimer();
		}
	}

	private restartTimers(): void {
		this.stopTimers();
		if (!this.moment.value || this.hasEnded.value) return;
		this.tickTimer = setInterval(() => this.updateCountdown(), 1000);
		if (this.moment.value.status === "LIVE") {
			this.liveTimer = setInterval(() => void this.refreshMoment(), 60_000);
		}
	}

	private stopTimers(): void {
		if (this.tickTimer) clearInterval(this.tickTimer);
		this.tickTimer = undefined;
		this.stopLiveTimer();
	}

	private stopLiveTimer(): void {
		if (this.liveTimer) clearInterval(this.liveTimer);
		this.liveTimer = undefined;
	}

	private async isDismissed(momentId: string): Promise<boolean> {
		if (!this.dismissedLoaded) {
			try {
				this.dismissed = new Set(await this.deps.loadDismissed());
			} catch (error) {
				this.logger.warn("Failed to load dismissed moments:", error);
			}
			this.dismissedLoaded = true;
		}
		return this.dismissed.has(momentId);
	}

	private sleep(ms: number, generation: number): Promise<void> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => resolve(), ms);
			if (generation !== this.generation) {
				clearTimeout(timer);
				resolve();
			}
		});
	}

	private readonly handleAccountBroadcast = (payload: { account: EnhancerAccountState }): void => {
		this.account.value = payload.account;
		if (!payload.account.loggedIn) this.resetClaimState();
		else if (this.moment.value && !this.claimedAt.value) void this.refreshViewerState(this.generation);
	};

	private describeClaimError(reason: ClaimMomentErrorReason, message: string): string {
		if (reason === "MOMENT_NOT_LIVE") return "This moment has ended. Claims are only accepted while it is live.";
		if (reason === "MOMENT_LIMIT_REACHED") return "This moment reached its claim limit.";
		if (reason === "NO_PLATFORM_ACCOUNT")
			return "Link an account on this platform to your Enhancer account to claim with one click.";
		if (reason === "FORBIDDEN") return "Your account is not allowed to claim this moment.";
		if (reason === "NOT_FOUND") return "This moment no longer exists.";
		if (reason === "UNAUTHENTICATED") return "Your session expired. Log in again to claim with one click.";
		if (reason === "NETWORK_ERROR") return `Claim failed (${message}). Retry is safe.`;
		return message;
	}
}
