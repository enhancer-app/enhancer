import { buildSlotRequest, cooldownMinutesLeft, groupBadgeSlots } from "$shared/enhancer-account/badge-slots.ts";
import { pickBadgeImage } from "$shared/moments/moment-countdown.ts";
import type { EnhancerViewerBadges, EnhancerViewerSummary } from "$types/apis/enhancer-account.apis.ts";
import type {
	BadgeSlotEditorProps,
	BadgeSlotGroup,
	EnhancerAccountComponentProps,
} from "$types/shared/components/enhancer-account.component.types.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import { useCallback, useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	line-height: 1.6;
	color: var(--settings-text);
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

const Card = styled.div`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	padding: 16px 18px;
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

const ProfileRow = styled.div`
	display: flex;
	align-items: center;
	gap: 14px;
`;

const Avatar = styled.img`
	width: 52px;
	height: 52px;
	border-radius: 50%;
	object-fit: cover;
	background: var(--settings-control-background);
	flex-shrink: 0;
`;

const AvatarFallback = styled.div`
	width: 52px;
	height: 52px;
	border-radius: 50%;
	background: #9147ff;
	color: white;
	font-size: 20px;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
`;

const Identity = styled.div`
	display: flex;
	flex-direction: column;
	min-width: 0;
	flex: 1;
`;

const Name = styled.span`
	color: var(--settings-text-strong);
	font-size: 15px;
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Chips = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 4px;
`;

const Chip = styled.span`
	font-size: 11px;
	color: var(--settings-text-muted);
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	border-radius: 999px;
	padding: 0 8px;
`;

const Stats = styled.div`
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 8px;
`;

const Stat = styled.div`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	border-radius: 10px;
	padding: 8px 12px;
	display: flex;
	flex-direction: column;
`;

const StatValue = styled.span`
	color: var(--settings-text-strong);
	font-size: 16px;
	font-weight: 700;
`;

const StatLabel = styled.span`
	color: var(--settings-text-muted);
	font-size: 11px;
`;

const SectionTitle = styled.span`
	color: var(--settings-text-strong);
	font-size: 13px;
	font-weight: 600;
`;

const Hint = styled.span`
	color: var(--settings-text-muted);
	font-size: 11.5px;
`;

const ErrorText = styled.span`
	color: #ff4757;
	font-size: 11.5px;
`;

const Slot = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-top: 12px;
	border-top: 1px solid var(--settings-divider);
`;

const SlotHeader = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const SlotAvatar = styled.img`
	width: 20px;
	height: 20px;
	border-radius: 50%;
`;

const SlotLabel = styled.span`
	color: var(--settings-text-strong);
	font-size: 12.5px;
	font-weight: 600;
	flex: 1;
`;

const BadgeGrid = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
`;

const BadgeTile = styled.button<{ $selected: boolean }>`
	display: flex;
	align-items: center;
	gap: 6px;
	background: ${({ $selected }) => ($selected ? "rgba(145, 71, 255, 0.18)" : "var(--settings-control-background)")};
	border: 1px solid ${({ $selected }) => ($selected ? "#9147ff" : "var(--settings-control-border)")};
	border-radius: 8px;
	color: var(--settings-text);
	font-size: 11.5px;
	padding: 5px 9px;
	cursor: pointer;

	&:hover:not(:disabled) {
		border-color: #9147ff;
	}

	&:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
`;

const BadgeIcon = styled.img`
	width: 22px;
	height: 22px;
	object-fit: contain;
`;

const Row = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
`;

const PrimaryButton = styled.button`
	background: #9147ff;
	border: 1px solid #9147ff;
	border-radius: 8px;
	color: white;
	padding: 7px 14px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	flex-shrink: 0;

	&:hover:not(:disabled) {
		background: #a35fff;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const SecondaryButton = styled.button`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	border-radius: 8px;
	color: var(--settings-text);
	padding: 7px 14px;
	font-size: 11px;
	font-weight: 500;
	cursor: pointer;
	flex-shrink: 0;

	&:hover:not(:disabled) {
		border-color: #9147ff;
		color: #9147ff;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

function formatProvider(provider: string): string {
	return provider.charAt(0) + provider.slice(1).toLowerCase();
}

function formatMemberSince(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function slotLabel(group: BadgeSlotGroup): string {
	const platform = formatProvider(group.accountPlatform);
	if (group.scope === "GLOBAL") return `Global · ${platform} (${group.accountLogin})`;
	return `${group.channelLogin ?? "Channel"} · ${platform}`;
}

function BadgeSlotEditor({ group, onSave }: BadgeSlotEditorProps) {
	const [selected, setSelected] = useState(group.selectedAssignmentId);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cooldown = cooldownMinutesLeft(group.cooldownUntil);
	const dirty = selected !== group.selectedAssignmentId;
	const regular = group.badges.filter((badge) => !badge.forced);
	const forced = group.badges.filter((badge) => badge.forced);

	useEffect(() => setSelected(group.selectedAssignmentId), [group.selectedAssignmentId]);

	const save = async () => {
		setSaving(true);
		setError(null);
		setError(await onSave(group, selected));
		setSaving(false);
	};

	return (
		<Slot>
			<SlotHeader>
				{group.scope === "CHANNEL" && group.channelAvatarUrl && <SlotAvatar src={group.channelAvatarUrl} alt="" />}
				<SlotLabel>{slotLabel(group)}</SlotLabel>
				{dirty && (
					<>
						<SecondaryButton type="button" disabled={saving} onClick={() => setSelected(group.selectedAssignmentId)}>
							Cancel
						</SecondaryButton>
						<PrimaryButton type="button" disabled={saving || cooldown > 0} onClick={save}>
							{saving ? "…" : "Save"}
						</PrimaryButton>
					</>
				)}
			</SlotHeader>
			<BadgeGrid>
				{regular.map((badge) => {
					const image = pickBadgeImage(badge.sources);
					return (
						<BadgeTile
							key={badge.assignmentId}
							type="button"
							$selected={selected === badge.assignmentId}
							disabled={cooldown > 0}
							onClick={() => setSelected(badge.assignmentId)}
						>
							{image && <BadgeIcon src={image} alt="" />}
							{badge.name}
						</BadgeTile>
					);
				})}
				<BadgeTile
					type="button"
					$selected={selected === null}
					disabled={cooldown > 0}
					onClick={() => setSelected(null)}
				>
					None
				</BadgeTile>
			</BadgeGrid>
			{forced.length > 0 && <Hint>Always shown: {forced.map((badge) => badge.name).join(", ")}</Hint>}
			{cooldown > 0 && <Hint>You can change this badge again in {cooldown} min.</Hint>}
			{error && <ErrorText>{error}</ErrorText>}
		</Slot>
	);
}

export function EnhancerAccountComponent({ workerService }: EnhancerAccountComponentProps) {
	const [account, setAccount] = useState<EnhancerAccountState>({ loggedIn: false });
	const [profile, setProfile] = useState<EnhancerViewerSummary | null>(null);
	const [badges, setBadges] = useState<EnhancerViewerBadges | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void workerService.send("getEnhancerAccount").then((state) => {
			if (active && state) setAccount(state);
		});
		const handleUpdate = (payload: { account: EnhancerAccountState; error?: string }) => {
			if (!active) return;
			setAccount(payload.account);
			if (payload.error) setError(payload.error);
		};
		workerService.onBroadcast("enhancer-account-updated", handleUpdate);
		return () => {
			active = false;
			workerService.offBroadcast("enhancer-account-updated", handleUpdate);
		};
	}, [workerService]);

	const loadBadges = useCallback(async () => {
		const result = await workerService.send("getEnhancerBadges");
		if (result?.kind === "ok") setBadges(result.data);
		else if (result?.kind === "error") setError(result.message);
	}, [workerService]);

	useEffect(() => {
		if (!account.loggedIn) {
			setProfile(null);
			setBadges(null);
			return;
		}
		void workerService.send("getEnhancerProfile").then((result) => {
			if (result?.kind === "ok") setProfile(result.data);
			else if (result?.kind === "error") setError(result.message);
		});
		void loadBadges();
	}, [account.loggedIn, workerService, loadBadges]);

	const login = async () => {
		setBusy(true);
		setError(null);
		try {
			const response = await workerService.send("loginEnhancerAccount");
			if (!response) {
				setError("Login request timed out.");
				return;
			}
			if (response.success) setAccount(response.account);
			else if (response.reason === "failed") setError(response.message);
		} finally {
			setBusy(false);
		}
	};

	const logout = async () => {
		setBusy(true);
		setError(null);
		try {
			await workerService.send("logoutEnhancerAccount");
			setAccount({ loggedIn: false });
		} finally {
			setBusy(false);
		}
	};

	const saveSlot = async (group: BadgeSlotGroup, assignmentId: string | null): Promise<string | null> => {
		const result = await workerService.send("saveEnhancerBadgeSlot", buildSlotRequest(group, assignmentId));
		if (!result) return "Request timed out.";
		if (result.kind === "unauthenticated") return "Your session expired. Log in again.";
		if (result.kind === "error") return result.message;
		await loadBadges();
		return null;
	};

	if (!account.loggedIn) {
		return (
			<Container>
				<Card>
					<Row>
						<Identity>
							<Name>Not logged in</Name>
							<Hint>Log in to claim Moment badges with one click and choose which badges you show in chat.</Hint>
						</Identity>
						<PrimaryButton type="button" onClick={login} disabled={busy}>
							{busy ? "…" : "Log in"}
						</PrimaryButton>
					</Row>
					{error && <ErrorText>{error}</ErrorText>}
				</Card>
			</Container>
		);
	}

	const user = profile?.user;
	const displayName =
		user?.displayName ?? user?.username ?? account.displayName ?? account.username ?? "Enhancer account";
	const allBadges = badges ? [...badges.global, ...badges.channels] : [];
	const groups = badges ? groupBadgeSlots(badges) : [];

	return (
		<Container>
			<Card>
				<ProfileRow>
					{user?.avatarUrl ? (
						<Avatar src={user.avatarUrl} alt="" />
					) : (
						<AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
					)}
					<Identity>
						<Name>{displayName}</Name>
						{user?.username && <Hint>@{user.username}</Hint>}
						{profile && profile.identities.length > 0 && (
							<Chips>
								{profile.identities.map((identity) => (
									<Chip key={`${identity.provider}:${identity.providerUsername ?? ""}`}>
										{formatProvider(identity.provider)}
										{identity.providerUsername ? ` · ${identity.providerUsername}` : ""}
									</Chip>
								))}
							</Chips>
						)}
					</Identity>
					<SecondaryButton type="button" onClick={logout} disabled={busy}>
						{busy ? "…" : "Log out"}
					</SecondaryButton>
				</ProfileRow>
				<Stats>
					<Stat>
						<StatValue>{badges ? allBadges.length : "—"}</StatValue>
						<StatLabel>Badges owned</StatLabel>
					</Stat>
					<Stat>
						<StatValue>{badges ? allBadges.filter((badge) => badge.visible).length : "—"}</StatValue>
						<StatLabel>Shown in chat</StatLabel>
					</Stat>
					<Stat>
						<StatValue>{user ? formatMemberSince(user.createdAt) : "—"}</StatValue>
						<StatLabel>Member since</StatLabel>
					</Stat>
				</Stats>
				{error && <ErrorText>{error}</ErrorText>}
			</Card>
			<Card>
				<Identity>
					<SectionTitle>Your badges</SectionTitle>
					<Hint>Pick which badge appears next to your name. Each slot can be changed once every 15 minutes.</Hint>
				</Identity>
				{badges === null ? (
					<Hint>Loading badges…</Hint>
				) : groups.length === 0 ? (
					<Hint>No badges yet. Claim one during a live Moment!</Hint>
				) : (
					groups.map((group) => <BadgeSlotEditor key={group.key} group={group} onSave={saveSlot} />)
				)}
			</Card>
		</Container>
	);
}
