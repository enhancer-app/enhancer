import { pickBadgeImage } from "$shared/moments/moment-countdown.ts";
import type { MomentCardComponentProps } from "$types/shared/components/moment-card.component.types.ts";
import styled from "styled-components";

const TitleRow = styled.span`
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
`;

const LiveDot = styled.span<{ $live: boolean }>`
	width: 7px;
	height: 7px;
	border-radius: 50%;
	flex-shrink: 0;
	background: ${({ $live }) => ($live ? "#ff4757" : "#565656")};
`;

const TitleText = styled.span`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Eyebrow = styled.span`
	color: var(--main-color);
	flex-shrink: 0;
`;

const Body = styled.div`
	display: flex;
	gap: 12px;
	align-items: flex-start;
`;

const BadgeImage = styled.img<{ $size: number }>`
	width: ${({ $size }) => $size}px;
	height: ${({ $size }) => $size}px;
	border-radius: 6px;
	object-fit: contain;
	flex-shrink: 0;
`;

const Details = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	flex: 1;
`;

const PrimaryAction = styled.button`
	align-self: flex-start;
	background: transparent;
	border: none;
	padding: 0;
	color: var(--main-color);
	font-size: 14px;
	font-weight: 700;
	text-align: left;
	cursor: pointer;

	&:hover:not(:disabled) {
		text-decoration: underline;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const Success = styled.span`
	color: #7bed9f;
	font-size: 14px;
	font-weight: 700;
`;

const ChatAlternative = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;
	color: #8e8e8e;
	font-size: 12px;
`;

const CommandChip = styled.button`
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 4px;
	color: #efeff1;
	font-family: monospace;
	font-size: 12px;
	padding: 1px 6px;
	cursor: pointer;

	&:hover:not(:disabled) {
		border-color: var(--main-color);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const CopyButton = styled.button`
	background: transparent;
	border: none;
	color: #8e8e8e;
	font-size: 12px;
	padding: 0 2px;
	cursor: pointer;

	&:hover {
		color: white;
	}
`;

const Meta = styled.span`
	color: #8e8e8e;
	font-size: 11px;
`;

const Note = styled.span<{ $tone?: "error" | "success" }>`
	font-size: 12px;
	color: ${({ $tone }) => ($tone === "error" ? "#ff4757" : $tone === "success" ? "#7bed9f" : "#adadb8")};
`;

const InlineAction = styled.button`
	background: transparent;
	border: none;
	padding: 0;
	margin-left: 4px;
	color: var(--main-color);
	font-size: 12px;
	cursor: pointer;

	&:hover {
		text-decoration: underline;
	}
`;

const CompactRow = styled.span`
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	font-size: 13px;
`;

const CompactMeta = styled.span`
	color: #8e8e8e;
	font-size: 12px;
	flex-shrink: 0;
`;

function describePollStatus(status: string): string {
	if (status === "GRANTED") return "Badge claimed! It will show up next to your name shortly.";
	if (status === "ALREADY_CLAIMED") return "You already claimed this badge.";
	if (status === "INVALID_CODE") return "Wrong code — use the command above.";
	if (status === "NOT_LIVE") return "The moment ended before your message arrived.";
	if (status === "LIMIT_REACHED") return "This moment reached its claim limit.";
	if (status === "BLOCKED") return "Your account is not eligible for this moment.";
	return "Something went wrong. Try sending the command again.";
}

export function MomentPopupTitle({ controller }: MomentCardComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const ended = controller.hasEnded.value || moment.status === "ENDED";
	return (
		<TitleRow>
			<LiveDot $live={!ended} />
			<Eyebrow>{ended ? "Moment ended" : "Moment"}</Eyebrow>
			<TitleText>· {moment.title}</TitleText>
		</TitleRow>
	);
}

export function MomentPopupCompact({ controller }: MomentCardComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const badgeImage = pickBadgeImage(moment.badge.sources);
	return (
		<CompactRow>
			{badgeImage && <BadgeImage $size={20} src={badgeImage} alt={moment.badge.name} />}
			<TitleText>{moment.title}</TitleText>
			<CompactMeta>{controller.claimedAt.value ? "✓ Claimed" : controller.countdownText.value}</CompactMeta>
		</CompactRow>
	);
}

function PollNote({ controller }: MomentCardComponentProps) {
	const ended = controller.hasEnded.value;
	if (controller.pollPhase.value === "checking") return <Note>Checking your message…</Note>;
	if (controller.pollPhase.value === "timeout") {
		return (
			<Note>
				We have not seen your message yet.
				{!ended && (
					<InlineAction type="button" onClick={controller.onCheckAgain}>
						Check again
					</InlineAction>
				)}
			</Note>
		);
	}
	const status = controller.pollStatus.value;
	if (controller.pollPhase.value === "settled" && status && status !== "GRANTED") {
		return (
			<Note $tone="error">
				{describePollStatus(status)}
				{!ended && (
					<InlineAction type="button" onClick={controller.onCheckAgain}>
						Check again
					</InlineAction>
				)}
			</Note>
		);
	}
	if (controller.awaitingSend.value) return <Note>Command pasted — press Enter to send it.</Note>;
	return null;
}

export function MomentPopupContent({ controller }: MomentCardComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const ended = controller.hasEnded.value || moment.status === "ENDED";
	const badgeImage = pickBadgeImage(moment.badge.sources);
	const claimed = controller.claimedAt.value !== null;
	const loggedIn = controller.account.value.loggedIn;

	return (
		<Body>
			{badgeImage && <BadgeImage $size={48} src={badgeImage} alt={moment.badge.name} />}
			<Details>
				{claimed ? (
					<>
						<Success>✓ Badge claimed</Success>
						<Note>{moment.badge.name} will show up next to your name in chat shortly.</Note>
					</>
				) : ended ? (
					<Note>This moment has ended.</Note>
				) : (
					<>
						<PrimaryAction type="button" onClick={controller.onLoginAndClaim} disabled={controller.claimBusy.value}>
							{controller.claimBusy.value
								? "Claiming…"
								: loggedIn
									? `Claim ${moment.badge.name}`
									: "Log in & claim the badge"}
						</PrimaryAction>
						<ChatAlternative>
							<span>or type in chat</span>
							<CommandChip type="button" title="Paste into chat" onClick={controller.onInsertRedeem}>
								{moment.redeemCommand}
							</CommandChip>
							<CopyButton type="button" title="Copy command" onClick={controller.onCopyCommand}>
								{controller.copied.value ? "Copied" : "⧉ Copy"}
							</CopyButton>
						</ChatAlternative>
						{controller.claimError.value && <Note $tone="error">{controller.claimError.value}</Note>}
						{loggedIn && controller.viewerEligible.value === false && (
							<Note>Link this platform's account to Enhancer for one-click claims.</Note>
						)}
						<PollNote controller={controller} />
					</>
				)}
				<Meta>
					{moment.claimCount} claimed
					{moment.maxClaims ? ` of ${moment.maxClaims}` : ""}
					{ended ? "" : ` · ${controller.countdownText.value}`}
				</Meta>
			</Details>
		</Body>
	);
}
