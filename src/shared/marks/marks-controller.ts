import { Logger } from "$shared/logger/logger.ts";
import { formatMarkCountdown, remainingRatio } from "$shared/marks/mark-countdown.ts";
import { isMarkClaimsMessageData } from "$shared/worker/marks/marks.guards.ts";
import { getClaimPollDelay, isTerminalClaimStatus } from "$shared/marks/claim-status-poll.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { ClaimMarkResponse, ClaimStatus, MarkClaimsMessageData, PublicMark } from "$types/apis/marks.apis.ts";
import type { MarkPollPhase, MarksCardViewModel } from "$types/shared/marks-controller.types.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { ClaimMarkErrorReason, MarkClaimStatusResult } from "$types/shared/worker/marks-worker.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { computed, type ReadonlySignal, type Signal, signal } from "@preact/signals";

export type MarksControllerDeps = {
	platform: PlatformType;
	workerService: WorkerService;
	loadDismissed: () => Promise<string[]>;
	saveDismissed: (ids: string[]) => Promise<void>;
	resolveOwnLogin: () => Promise<string | null>;
	insertCommand: (command: string) => void;
};

export class MarksController implements MarksCardViewModel {
	private static readonly CLAIMED_AUTOCLOSE_SECONDS = 20;
	private static readonly ENDED_AUTOCLOSE_SECONDS = 15;

	readonly mark: Signal<PublicMark | null> = signal(null);
	readonly account: Signal<EnhancerAccountState> = signal({ loggedIn: false });
	readonly claimedAt: Signal<string | null> = signal(null);
	readonly claimMethod: Signal<string | null> = signal(null);
	readonly viewerEligible: Signal<boolean | null> = signal(null);
	readonly claimBusy: Signal<boolean> = signal(false);
	readonly claimError: Signal<string | null> = signal(null);
	readonly claimReceipt: Signal<ClaimMarkResponse | null> = signal(null);
	readonly pollPhase: Signal<MarkPollPhase> = signal("idle");
	readonly pollStatus: Signal<ClaimStatus | null> = signal(null);
	readonly countdownText: Signal<string> = signal("");
	readonly hasEnded: Signal<boolean> = signal(false);
	readonly timeProgress: Signal<number | null> = signal(null);
	readonly soldOut: ReadonlySignal<boolean> = computed(() => {
		const mark = this.mark.value;
		if (!mark || mark.maxClaims === null) return false;
		return mark.claimCount >= mark.maxClaims;
	});
	readonly awaitingSend: Signal<boolean> = signal(false);
	readonly copied: Signal<boolean> = signal(false);
	readonly autoCloseSeconds: ReadonlySignal<number | null> = computed(() => {
		if (!this.mark.value) return null;
		if (this.claimedAt.value) return MarksController.CLAIMED_AUTOCLOSE_SECONDS;
		if (this.hasEnded.value || this.soldOut.value) return MarksController.ENDED_AUTOCLOSE_SECONDS;
		return null;
	});

	private readonly logger = new Logger({ context: "marks" });
	private channelId: string | null = null;
	private enabled = true;
	private dismissed = new Set<string>();
	private dismissedLoaded = false;
	private generation = 0;
	private tickTimer: NodeJS.Timeout | undefined;
	private liveTimer: NodeJS.Timeout | undefined;
	private copiedTimer: NodeJS.Timeout | undefined;

	constructor(private readonly deps: MarksControllerDeps) {}

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
		if (!enabled) this.clearMark();
		else void this.refreshMark();
	}

	setChannel(externalId: string): void {
		if (!externalId || externalId === this.channelId) return;
		this.channelId = externalId;
		this.generation++;
		this.resetClaimState();
		void this.refreshMark();
	}

	handleApiMessage(name: string, data?: unknown): void {
		if (name === "mark.updated") void this.refreshMark();
		if (name === "mark.claims" && isMarkClaimsMessageData(data)) this.applyClaimCount(data);
	}

	private applyClaimCount(data: MarkClaimsMessageData): void {
		const mark = this.mark.value;
		if (!mark || mark.id !== data.markId || data.claimCount < mark.claimCount) return;
		this.mark.value = { ...mark, claimCount: data.claimCount, maxClaims: data.maxClaims };
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

	onCopyCommand = (): void => {
		void this.copyCommand();
	};

	onDismiss = (): void => {
		void this.dismiss();
	};

	onLoginAndClaim = (): void => {
		void this.loginAndClaim();
	};

	async refreshMark(): Promise<void> {
		if (!this.enabled || !this.channelId) return;
		const generation = this.generation;
		const channelId = this.channelId;
		try {
			const response = await this.deps.workerService.send("getChannelMark", {
				platform: this.deps.platform,
				externalId: channelId,
			});
			if (generation !== this.generation || !response) return;
			if (response.kind === "error") {
				this.logger.warn(`Failed to load mark for ${channelId}:`, response.message);
				return;
			}
			await this.applyMark(response.mark, generation);
		} catch (error) {
			this.logger.warn(`Failed to load mark for ${channelId}:`, error);
		}
	}

	private async applyMark(mark: PublicMark | null, generation: number): Promise<void> {
		if (generation !== this.generation) return;
		if (!mark || (await this.isDismissed(mark.id))) {
			this.clearMark();
			return;
		}
		const changed = this.mark.value?.id !== mark.id;
		this.mark.value = mark;
		if (changed) this.resetClaimState();
		this.updateCountdown();
		this.restartTimers();
		if (this.account.value.loggedIn && !this.claimedAt.value) await this.refreshViewerState(generation);
	}

	private async claim(): Promise<void> {
		const mark = this.mark.value;
		if (!mark || this.claimBusy.value || this.hasEnded.value) return;
		this.claimBusy.value = true;
		this.claimError.value = null;
		try {
			const result = await this.deps.workerService.send("claimMark", { markId: mark.id });
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
		const mark = this.mark.value;
		if (!mark || this.hasEnded.value) return null;
		const command = mark.redeemCommand;
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
		const mark = this.mark.value;
		if (!mark) return;
		if (this.pollPhase.value === "checking") return;
		const login = (knownLogin ?? (await this.deps.resolveOwnLogin()))?.toLowerCase() ?? null;
		if (!login) {
			this.awaitingSend.value = true;
			return;
		}
		const generation = this.generation;
		const markId = mark.id;
		this.pollPhase.value = "checking";
		this.pollStatus.value = null;
		this.awaitingSend.value = false;
		for (let attempt = 0; ; attempt++) {
			if (generation !== this.generation) return;
			const result = await this.queryClaimStatus(markId, login);
			if (generation !== this.generation || this.mark.value?.id !== markId) return;
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

	private async queryClaimStatus(markId: string, login: string): Promise<MarkClaimStatusResult | null> {
		try {
			return await this.deps.workerService.send("getMarkClaimStatus", { markId, login });
		} catch (error) {
			this.logger.warn("Claim status request failed:", error);
			return null;
		}
	}

	private applyClaimStatus(result: MarkClaimStatusResult): boolean {
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

	private async loginAndClaim(): Promise<void> {
		if (this.account.value.loggedIn) {
			await this.claim();
			return;
		}
		const response = await this.deps.workerService.send("loginEnhancerAccount");
		if (!response?.success) return;
		this.account.value = response.account;
		if (!this.mark.value) return;
		await this.refreshViewerState(this.generation);
		if (!this.claimedAt.value && this.viewerEligible.value !== false) await this.claim();
	}

	private async copyCommand(): Promise<void> {
		const command = this.mark.value?.redeemCommand;
		if (!command) return;
		try {
			await navigator.clipboard.writeText(command);
		} catch (error) {
			this.logger.warn("Failed to copy redeem command:", error);
			return;
		}
		this.copied.value = true;
		if (this.copiedTimer) clearTimeout(this.copiedTimer);
		this.copiedTimer = setTimeout(() => {
			this.copied.value = false;
		}, 2000);
	}

	private async refreshAccount(): Promise<void> {
		const account = await this.deps.workerService.send("getEnhancerAccount");
		if (!account) return;
		this.account.value = account;
		if (account.loggedIn && this.mark.value && !this.claimedAt.value) {
			await this.refreshViewerState(this.generation);
		}
	}

	private async refreshViewerState(generation: number): Promise<void> {
		const mark = this.mark.value;
		if (!mark || !this.account.value.loggedIn) return;
		try {
			const result = await this.deps.workerService.send("getMarkViewerState", { markId: mark.id });
			if (generation !== this.generation || !result || this.mark.value?.id !== mark.id) return;
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
		const mark = this.mark.value;
		if (!mark) return;
		this.dismissed.add(mark.id);
		while (this.dismissed.size > 50) {
			const oldest = this.dismissed.values().next().value;
			if (!oldest) break;
			this.dismissed.delete(oldest);
		}
		try {
			await this.deps.saveDismissed([...this.dismissed]);
		} catch (error) {
			this.logger.warn("Failed to persist dismissed mark:", error);
		}
		this.clearMark();
	}

	private clearMark(): void {
		this.generation++;
		this.mark.value = null;
		this.resetClaimState();
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
		this.timeProgress.value = null;
	}

	private updateCountdown(): void {
		const mark = this.mark.value;
		if (!mark) return;
		const countdown = formatMarkCountdown(mark.endsAt);
		this.countdownText.value = countdown.text;
		this.timeProgress.value = remainingRatio(mark.startedAt, mark.endsAt);
		if (countdown.ended && !this.hasEnded.value) {
			this.hasEnded.value = true;
			this.stopLiveTimer();
		}
	}

	private restartTimers(): void {
		this.stopTimers();
		if (!this.mark.value || this.hasEnded.value) return;
		this.tickTimer = setInterval(() => this.updateCountdown(), 1000);
		if (this.mark.value.status === "LIVE") {
			this.liveTimer = setInterval(() => void this.refreshMark(), 60_000);
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

	private async isDismissed(markId: string): Promise<boolean> {
		if (!this.dismissedLoaded) {
			try {
				this.dismissed = new Set(await this.deps.loadDismissed());
			} catch (error) {
				this.logger.warn("Failed to load dismissed marks:", error);
			}
			this.dismissedLoaded = true;
		}
		return this.dismissed.has(markId);
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
		else if (this.mark.value && !this.claimedAt.value) void this.refreshViewerState(this.generation);
	};

	private describeClaimError(reason: ClaimMarkErrorReason, message: string): string {
		if (reason === "MARK_NOT_LIVE") return "This mark has ended. Claims are only accepted while it is live.";
		if (reason === "MARK_LIMIT_REACHED") return "This mark reached its claim limit.";
		if (reason === "NO_PLATFORM_ACCOUNT")
			return "Link an account on this platform to your Enhancer account to claim with one click.";
		if (reason === "FORBIDDEN") return "Your account is not allowed to claim this mark.";
		if (reason === "NOT_FOUND") return "This mark no longer exists.";
		if (reason === "UNAUTHENTICATED") return "Your session expired. Log in again to claim with one click.";
		if (reason === "NETWORK_ERROR") return `Claim failed (${message}). Retry is safe.`;
		return message;
	}
}
