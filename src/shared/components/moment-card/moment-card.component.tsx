import { pickBadgeImage } from "$shared/moments/moment-countdown.ts";
import type {
	MomentCardComponentProps,
	MomentCompactComponentProps,
} from "$types/shared/components/moment-card.component.types.ts";
import type { MomentsCardViewModel } from "$types/shared/moments-controller.types.ts";
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
	flex-wrap: wrap;
	gap: 6px;
	font-size: 12px;
	color: var(--m-muted);
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

const TextButton = styled.button`
	background: none;
	border: none;
	padding: 0;
	color: var(--m-muted);
	font-size: 12px;
	cursor: pointer;

	&:hover {
		color: var(--m-text);
		text-decoration: underline;
	}
`;

const Note = styled.div<{ $error?: boolean }>`
	font-size: 12px;
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
	if (status === "NOT_LIVE") return "The moment ended before your message arrived.";
	if (status === "LIMIT_REACHED") return "All badges were claimed before your message arrived.";
	if (status === "BLOCKED") return "Your account is not eligible for this moment.";
	return "Something went wrong. Try sending the command again.";
}

function poolText(controller: MomentsCardViewModel): string {
	const moment = controller.moment.value;
	if (!moment) return "";
	if (moment.maxClaims === null) return `${moment.claimCount} claimed`;
	return `${Math.max(0, moment.maxClaims - moment.claimCount)} of ${moment.maxClaims} left`;
}

export function MomentPopupTitle({ controller }: MomentCardComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const image = pickBadgeImage(moment.badge.sources);
	const claimed = controller.claimedAt.value !== null;
	const ended = controller.hasEnded.value || moment.status === "ENDED";
	const meta = claimed
		? `${moment.badge.name} is yours`
		: controller.soldOut.value
			? `All ${moment.maxClaims} badges were claimed`
			: ended
				? `Ended · ${moment.claimCount} viewers claimed it`
				: `${controller.countdownText.value} · ${poolText(controller)}`;
	return (
		<TopRow>
			{image && <Badge $size={36} src={image} alt={moment.badge.name} />}
			<Heading>
				<Title>{claimed ? "Badge claimed" : moment.title}</Title>
				<Meta>{meta}</Meta>
			</Heading>
		</TopRow>
	);
}

export function MomentPopupCompact({ controller, expand }: MomentCompactComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const image = pickBadgeImage(moment.badge.sources);
	const status = controller.claimedAt.value
		? "Claimed"
		: controller.soldOut.value
			? "All claimed"
			: controller.hasEnded.value || moment.status === "ENDED"
				? "Ended"
				: null;
	return (
		<CompactRow>
			{image && <Badge $size={18} src={image} alt="" />}
			<CompactTitle>{moment.title}</CompactTitle>
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

function PollNote({ controller }: MomentCardComponentProps) {
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

export function MomentPopupContent({ controller }: MomentCardComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const ended = controller.hasEnded.value || moment.status === "ENDED";
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
					{moment.redeemCommand}
				</CommandChip>
				<TextButton type="button" onClick={controller.onCopyCommand}>
					{controller.copied.value ? "Copied" : "Copy"}
				</TextButton>
			</ChatAlternative>
			{controller.claimError.value && <Note $error>{controller.claimError.value}</Note>}
			{loggedIn && controller.viewerEligible.value === false && (
				<Note>Link this platform's account to Enhancer for one-click claims.</Note>
			)}
			<PollNote controller={controller} />
		</>
	);
}
