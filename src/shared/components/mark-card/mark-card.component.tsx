import { pickBadgeImage } from "$shared/marks/mark-countdown.ts";
import type {
	MarkCardComponentProps,
	MarkCompactComponentProps,
} from "$types/shared/components/mark-card.component.types.ts";
import type { MarksCardViewModel } from "$types/shared/marks-controller.types.ts";
import styled from "styled-components";

const TopRow = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
`;

const Badge = styled.img<{ $size: number }>`
	width: ${({ $size }) => $size}px;
	height: ${({ $size }) => $size}px;
	flex-shrink: 0;
`;

const Heading = styled.div`
	flex: 1;
	min-width: 0;
`;

const Title = styled.div`
	font-size: 13px;
	font-weight: 600;
	line-height: 18px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const Meta = styled.div`
	font-size: 12px;
	line-height: 16px;
	color: var(--m-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-variant-numeric: tabular-nums;
`;

const PrimaryButton = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 30px;
	border: none;
	border-radius: var(--m-button-radius);
	background: var(--m-accent);
	color: var(--m-on-accent);
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: var(--m-accent-hover);
	}

	&:disabled {
		opacity: 0.6;
		cursor: default;
	}
`;

const ChatAlternative = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 6px;
	font-size: 12px;
	color: var(--m-muted);

	& > button:last-of-type {
		margin: 0 -7px;
	}
`;

const CommandChip = styled.button`
	background: var(--m-chip);
	border: none;
	border-radius: 4px;
	color: var(--m-text);
	font-family: ui-monospace, Consolas, monospace;
	font-size: 12px;
	padding: 2px 6px;
	cursor: pointer;

	&:hover {
		background: var(--m-chip-hover);
	}
`;

const IconButton = styled.button`
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	padding: 0;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--m-muted);
	cursor: pointer;

	&:hover {
		background: var(--m-chip);
		color: var(--m-text);
	}

	svg {
		width: 14px;
		height: 14px;
	}
`;

function CopyIcon({ copied }: { copied: boolean }) {
	return copied ? (
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M3 8.5l3.5 3.5L13 4.5" />
		</svg>
	) : (
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
			<path d="M3 10.5V4a1 1 0 011-1h6.5" />
		</svg>
	);
}

const Note = styled.div<{ $error?: boolean }>`
	font-size: 12px;
	text-align: center;
	color: ${({ $error }) => ($error ? "#ff8280" : "var(--m-muted)")};
`;

const InlineAction = styled.button`
	background: none;
	border: none;
	padding: 0;
	margin-left: 4px;
	color: var(--m-accent-text);
	font-size: 12px;
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}
`;

const CompactRow = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
`;

const CompactTitle = styled.span`
	flex: 1;
	min-width: 0;
	font-size: 12px;
	font-weight: 600;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const CompactStatus = styled.span`
	font-size: 12px;
	color: var(--m-muted);
	flex-shrink: 0;
`;

const CompactClaim = styled.button`
	height: 22px;
	border: none;
	border-radius: var(--m-button-radius);
	padding: 0 8px;
	background: var(--m-accent);
	color: var(--m-on-accent);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	flex-shrink: 0;

	&:hover {
		background: var(--m-accent-hover);
	}
`;

function describePollStatus(status: string): string {
	if (status === "ALREADY_CLAIMED") return "You already claimed this badge.";
	if (status === "INVALID_CODE") return "Wrong code. Use the command above.";
	if (status === "NOT_LIVE") return "The mark ended before your message arrived.";
	if (status === "LIMIT_REACHED") return "All badges were claimed before your message arrived.";
	if (status === "BLOCKED") return "Your account is not eligible for this mark.";
	return "Something went wrong. Try sending the command again.";
}

function poolText(controller: MarksCardViewModel): string {
	const mark = controller.mark.value;
	if (!mark) return "";
	if (mark.maxClaims === null) return `${mark.claimCount} claimed`;
	return `${Math.max(0, mark.maxClaims - mark.claimCount)} of ${mark.maxClaims} left`;
}

export function MarkPopupTitle({ controller }: MarkCardComponentProps) {
	const mark = controller.mark.value;
	if (!mark) return null;
	const image = pickBadgeImage(mark.badge.sources);
	const claimed = controller.claimedAt.value !== null;
	const ended = controller.hasEnded.value || mark.status === "ENDED";
	const meta = claimed
		? `${mark.badge.name} is yours`
		: controller.soldOut.value
			? `All ${mark.maxClaims} badges were claimed`
			: ended
				? `Ended · ${mark.claimCount} viewers claimed it`
				: `${controller.countdownText.value} · ${poolText(controller)}`;
	return (
		<TopRow>
			{image && <Badge $size={36} src={image} alt={mark.badge.name} />}
			<Heading>
				<Title>{claimed ? "Badge claimed" : mark.title}</Title>
				<Meta>{meta}</Meta>
			</Heading>
		</TopRow>
	);
}

export function MarkPopupCompact({ controller, expand }: MarkCompactComponentProps) {
	const mark = controller.mark.value;
	if (!mark) return null;
	const image = pickBadgeImage(mark.badge.sources);
	const status = controller.claimedAt.value
		? "Claimed"
		: controller.soldOut.value
			? "All claimed"
			: controller.hasEnded.value || mark.status === "ENDED"
				? "Ended"
				: null;
	return (
		<CompactRow>
			{image && <Badge $size={18} src={image} alt="" />}
			<CompactTitle>{mark.title}</CompactTitle>
			{status ? (
				<CompactStatus>{status}</CompactStatus>
			) : (
				<CompactClaim type="button" onClick={expand}>
					Claim
				</CompactClaim>
			)}
		</CompactRow>
	);
}

function PollNote({ controller }: MarkCardComponentProps) {
	const phase = controller.pollPhase.value;
	if (phase === "checking") return <Note>Looking for your message…</Note>;
	if (phase === "timeout") {
		return (
			<Note>
				We have not seen your message yet.
				<InlineAction type="button" onClick={controller.onCheckAgain}>
					Check again
				</InlineAction>
			</Note>
		);
	}
	const status = controller.pollStatus.value;
	if (phase === "settled" && status && status !== "GRANTED") {
		return (
			<Note $error>
				{describePollStatus(status)}
				<InlineAction type="button" onClick={controller.onCheckAgain}>
					Check again
				</InlineAction>
			</Note>
		);
	}
	if (controller.awaitingSend.value) return <Note>Pasted into chat. Press Enter to send.</Note>;
	return null;
}

export function MarkPopupContent({ controller }: MarkCardComponentProps) {
	const mark = controller.mark.value;
	if (!mark) return null;
	const ended = controller.hasEnded.value || mark.status === "ENDED";
	if (controller.claimedAt.value || ended || controller.soldOut.value) return null;
	const loggedIn = controller.account.value.loggedIn;
	const label = controller.claimBusy.value ? "Claiming…" : loggedIn ? "Claim badge" : "Log in & claim badge";

	return (
		<>
			<PrimaryButton type="button" onClick={controller.onLoginAndClaim} disabled={controller.claimBusy.value}>
				{label}
			</PrimaryButton>
			<ChatAlternative>
				or type
				<CommandChip type="button" title="Paste into chat" onClick={controller.onInsertRedeem}>
					{mark.redeemCommand}
				</CommandChip>
				<IconButton
					type="button"
					title={controller.copied.value ? "Copied" : "Copy command"}
					aria-label="Copy command"
					onClick={controller.onCopyCommand}
				>
					<CopyIcon copied={controller.copied.value} />
				</IconButton>
				in chat
			</ChatAlternative>
			{controller.claimError.value && <Note $error>{controller.claimError.value}</Note>}
			{loggedIn && controller.viewerEligible.value === false && (
				<Note>Link this platform's account to Enhancer for one-click claims.</Note>
			)}
			<PollNote controller={controller} />
		</>
	);
}
