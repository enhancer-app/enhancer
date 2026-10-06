import { pickBadgeImage } from "$shared/moments/moment-countdown.ts";
import type { MomentCardComponentProps } from "$types/shared/components/moment-card.component.types.ts";
import styled from "styled-components";

const Card = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 8px;
	padding: 10px 12px;
	background: #0d0d0d;
	border: 1px solid #232323;
	border-left: 3px solid #9147ff;
	border-radius: 8px;
	color: white;
	font-size: 13px;
	line-height: 1.4;
`;

const Header = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const Eyebrow = styled.span<{ $live: boolean }>`
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.6px;
	text-transform: uppercase;
	color: ${({ $live }) => ($live ? "#9147ff" : "#565656")};
`;

const LiveDot = styled.span`
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: #ff4757;
`;

const Title = styled.span`
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-weight: 600;
	color: white;
`;

const IconButton = styled.button`
	flex-shrink: 0;
	background: transparent;
	border: none;
	color: #565656;
	font-size: 14px;
	line-height: 1;
	cursor: pointer;
	padding: 2px 4px;

	&:hover {
		color: white;
	}
`;

const Body = styled.div`
	display: flex;
	gap: 10px;
	align-items: center;
`;

const BadgeImage = styled.img`
	width: 40px;
	height: 40px;
	border-radius: 6px;
	object-fit: contain;
	background: #161616;
	flex-shrink: 0;
`;

const Meta = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
`;

const BadgeName = styled.span`
	color: #ccc;
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Stats = styled.span`
	color: #565656;
	font-size: 12px;
`;

const Actions = styled.div`
	display: flex;
	flex-direction: column;
	gap: 6px;
`;

const ButtonRow = styled.div`
	display: flex;
	gap: 6px;
`;

const PrimaryButton = styled.button`
	flex: 1;
	background: #9147ff;
	border: 1px solid #9147ff;
	border-radius: 6px;
	color: white;
	font-size: 12px;
	font-weight: 600;
	padding: 7px 10px;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: #a35fff;
	}

	&:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
`;

const SecondaryButton = styled.button`
	flex: 1;
	background: transparent;
	border: 1px solid #232323;
	border-radius: 6px;
	color: #ccc;
	font-size: 12px;
	font-weight: 500;
	padding: 7px 10px;
	cursor: pointer;

	&:hover:not(:disabled) {
		border-color: #9147ff;
		color: white;
	}

	&:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
`;

const Note = styled.span<{ $tone?: "muted" | "error" | "success" }>`
	font-size: 12px;
	color: ${({ $tone }) => ($tone === "error" ? "#ff4757" : $tone === "success" ? "#7bed9f" : "#565656")};
`;

function formatClaimTime(iso: string): string {
	const time = new Date(iso).toLocaleString();
	return time === "Invalid Date" ? iso : time;
}

function describePollStatus(status: string, redeemCommand: string): string {
	if (status === "GRANTED") return "Badge claimed! It may take a moment to appear in chat.";
	if (status === "ALREADY_CLAIMED") return "You already claimed this badge.";
	if (status === "INVALID_CODE") return `Wrong code — send "${redeemCommand}" in this channel's chat.`;
	if (status === "NOT_LIVE") return "The moment ended before your message arrived.";
	if (status === "LIMIT_REACHED") return "This moment reached its claim limit.";
	if (status === "BLOCKED") return "Your account is not eligible for this moment.";
	return "Something went wrong. Try sending the command again.";
}

export function MomentCardComponent({ controller }: MomentCardComponentProps) {
	const moment = controller.moment.value;
	if (!moment) return null;
	const ended = controller.hasEnded.value || moment.status === "ENDED";
	const badgeImage = pickBadgeImage(moment.badge.sources);
	const claimedAt = controller.claimedAt.value;
	const receipt = controller.claimReceipt.value;
	const methodSuffix =
		controller.claimMethod.value === "CHAT"
			? " via chat"
			: controller.claimMethod.value === "ACCOUNT"
				? " with one click"
				: "";

	return (
		<Card>
			<Header>
				<Eyebrow $live={!ended}>
					{!ended && <LiveDot />} Moment · {ended ? "Ended" : "Live"}
				</Eyebrow>
				<Title>{moment.title}</Title>
				<IconButton
					type="button"
					onClick={controller.onToggleCollapsed}
					title={controller.collapsed.value ? "Expand" : "Collapse"}
				>
					{controller.collapsed.value ? "▸" : "▾"}
				</IconButton>
				<IconButton type="button" onClick={controller.onDismiss} title="Dismiss">
					✕
				</IconButton>
			</Header>
			{!controller.collapsed.value && (
				<>
					<Body>
						{badgeImage && <BadgeImage src={badgeImage} alt={moment.badge.name} />}
						<Meta>
							<BadgeName>{moment.badge.name}</BadgeName>
							<Stats>
								{moment.claimCount} claimed · {controller.countdownText.value}
								{moment.maxClaims ? ` · max ${moment.maxClaims}` : ""}
							</Stats>
						</Meta>
					</Body>
					<Actions>
						{claimedAt ? (
							<Note $tone="success">
								{receipt ? "Badge added to your account. " : "Already claimed. "}
								{formatClaimTime(claimedAt)}
								{methodSuffix}
								{receipt ? " It may take a moment to appear in chat." : ""}
							</Note>
						) : controller.account.value.loggedIn ? (
							<>
								{controller.claimError.value ? (
									<>
										<Note $tone="error">{controller.claimError.value}</Note>
										<ButtonRow>
											<SecondaryButton type="button" onClick={controller.onClaim} disabled={ended}>
												Try again
											</SecondaryButton>
										</ButtonRow>
									</>
								) : (
									<>
										<ButtonRow>
											<PrimaryButton
												type="button"
												onClick={controller.onClaim}
												disabled={controller.claimBusy.value || ended}
											>
												{controller.claimBusy.value ? "Claiming…" : "Claim badge"}
											</PrimaryButton>
										</ButtonRow>
										{controller.viewerEligible.value === false && (
											<Note>Link an account on this platform to your Enhancer account to claim.</Note>
										)}
									</>
								)}
							</>
						) : controller.pollPhase.value === "checking" ? (
							<Note>Checking your message…</Note>
						) : controller.pollPhase.value === "settled" && controller.pollStatus.value ? (
							<>
								<Note $tone={controller.pollStatus.value === "GRANTED" ? "success" : undefined}>
									{describePollStatus(controller.pollStatus.value, moment.redeemCommand)}
									{claimedAt ? ` ${formatClaimTime(claimedAt)}` : ""}
								</Note>
								{!ended && controller.pollStatus.value !== "GRANTED" && (
									<ButtonRow>
										<SecondaryButton type="button" onClick={controller.onCheckAgain}>
											Check again
										</SecondaryButton>
									</ButtonRow>
								)}
							</>
						) : controller.pollPhase.value === "timeout" ? (
							<>
								<Note>We have not seen your message yet — check you typed it in this channel, then try again.</Note>
								{!ended && (
									<ButtonRow>
										<SecondaryButton type="button" onClick={controller.onCheckAgain}>
											Check again
										</SecondaryButton>
									</ButtonRow>
								)}
							</>
						) : (
							<>
								<ButtonRow>
									<PrimaryButton type="button" onClick={controller.onInsertRedeem} disabled={ended}>
										Insert {moment.redeemCommand}
									</PrimaryButton>
									<SecondaryButton type="button" onClick={controller.onLogin}>
										Log in for one-click claim
									</SecondaryButton>
								</ButtonRow>
								{controller.awaitingSend.value && (
									<Note>Command ready — press Enter to send it, confirmation will appear here.</Note>
								)}
							</>
						)}
					</Actions>
				</>
			)}
		</Card>
	);
}
