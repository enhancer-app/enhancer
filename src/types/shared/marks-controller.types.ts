import type { ClaimMarkResponse, ClaimStatus, PublicMark } from "$types/apis/marks.apis.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { ReadonlySignal, Signal } from "@preact/signals";

export type MarkPollPhase = "idle" | "checking" | "settled" | "timeout";

export type MarksCardViewModel = {
	mark: Signal<PublicMark | null>;
	account: Signal<EnhancerAccountState>;
	claimedAt: Signal<string | null>;
	claimMethod: Signal<string | null>;
	viewerEligible: Signal<boolean | null>;
	claimBusy: Signal<boolean>;
	claimError: Signal<string | null>;
	claimReceipt: Signal<ClaimMarkResponse | null>;
	pollPhase: Signal<MarkPollPhase>;
	pollStatus: Signal<ClaimStatus | null>;
	countdownText: Signal<string>;
	hasEnded: Signal<boolean>;
	timeProgress: Signal<number | null>;
	soldOut: ReadonlySignal<boolean>;
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
