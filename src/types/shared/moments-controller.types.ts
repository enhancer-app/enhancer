import type { ClaimMomentResponse, ClaimStatus, PublicMoment } from "$types/apis/moments.apis.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { ReadonlySignal, Signal } from "@preact/signals";

export type MomentPollPhase = "idle" | "checking" | "settled" | "timeout";

export type MomentsCardViewModel = {
	moment: Signal<PublicMoment | null>;
	account: Signal<EnhancerAccountState>;
	claimedAt: Signal<string | null>;
	claimMethod: Signal<string | null>;
	viewerEligible: Signal<boolean | null>;
	claimBusy: Signal<boolean>;
	claimError: Signal<string | null>;
	claimReceipt: Signal<ClaimMomentResponse | null>;
	pollPhase: Signal<MomentPollPhase>;
	pollStatus: Signal<ClaimStatus | null>;
	countdownText: Signal<string>;
	hasEnded: Signal<boolean>;
	awaitingSend: Signal<boolean>;
	copied: Signal<boolean>;
	autoCloseSeconds: ReadonlySignal<number | null>;
	onClaim: () => void;
	onInsertRedeem: () => void;
	onCheckAgain: () => void;
	onLoginAndClaim: () => void;
	onCopyCommand: () => void;
	onDismiss: () => void;
};
