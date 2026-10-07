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
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 8px;
	color: var(--settings-text);
	line-height: 1.5;
`;

const Row = styled.div`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	gap: 14px;
`;

const RowMain = styled.div`
	flex: 1;
	min-width: 0;
`;

const RowTitle = styled.div`
	font-size: 13px;
	font-weight: 600;
	color: var(--settings-text-strong);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const RowDescription = styled.div<{ $error?: boolean }>`
	font-size: 12px;
	color: ${({ $error }) => ($error ? "#ff4757" : "var(--settings-text-muted)")};
	margin-top: 2px;
`;

const Avatar = styled.img`
	width: 44px;
	height: 44px;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;
`;

const AvatarFallback = styled.div`
	width: 44px;
	height: 44px;
	border-radius: 50%;
	background: var(--settings-control-hover);
	color: var(--settings-text-strong);
	font-size: 16px;
	font-weight: 700;
	display: grid;
	place-items: center;
	flex-shrink: 0;
`;

const Heading = styled.div`
	font-size: 13px;
	font-weight: 600;
	color: var(--settings-text-strong);
	margin: 14px 0 2px;
`;

const Button = styled.button<{ $primary?: boolean }>`
	height: 30px;
	padding: 0 12px;
	border-radius: 8px;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	flex-shrink: 0;
	border: 1px solid ${({ $primary }) => ($primary ? "#9147ff" : "var(--settings-control-border)")};
	background: ${({ $primary }) => ($primary ? "#9147ff" : "var(--settings-control-background)")};
	color: ${({ $primary }) => ($primary ? "white" : "var(--settings-text)")};

	&:hover:not(:disabled) {
		${({ $primary }) => ($primary ? "background: #a35fff;" : "border-color: var(--settings-text-faint);")}
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const Picker = styled.div`
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 6px;
	max-width: 60%;
`;

const Pick = styled.button<{ $selected: boolean }>`
	width: 40px;
	height: 40px;
	border-radius: 8px;
	padding: 0;
	display: grid;
	place-items: center;
	cursor: pointer;
	font-size: 11px;
	color: var(--settings-text-muted);
	border: 1px solid ${({ $selected }) => ($selected ? "#9147ff" : "var(--settings-control-border)")};
	background: ${({ $selected }) => ($selected ? "rgba(145, 71, 255, 0.12)" : "var(--settings-control-background)")};

	&:hover:not(:disabled) {
		border-color: ${({ $selected }) => ($selected ? "#9147ff" : "var(--settings-text-faint)")};
	}

	&:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	img {
		width: 24px;
		height: 24px;
	}
`;

const Actions = styled.div`
	display: flex;
	gap: 6px;
`;

function formatProvider(provider: string): string {
	return provider.charAt(0) + provider.slice(1).toLowerCase();
}

function slotTitle(group: BadgeSlotGroup): string {
	const platform = formatProvider(group.accountPlatform);
	if (group.scope === "GLOBAL") return `Everywhere on ${platform}`;
	return `In ${group.channelLogin ?? "this channel"}'s chat`;
}

function BadgeSlotEditor({ group, onSave }: BadgeSlotEditorProps) {
	const [selected, setSelected] = useState(group.selectedAssignmentId);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cooldown = cooldownMinutesLeft(group.cooldownUntil);
	const dirty = selected !== group.selectedAssignmentId;
	const regular = group.badges.filter((badge) => !badge.forced);
	const forced = group.badges.filter((badge) => badge.forced);
	const selectedName = regular.find((badge) => badge.assignmentId === selected)?.name ?? "nothing";

	useEffect(() => setSelected(group.selectedAssignmentId), [group.selectedAssignmentId]);

	const save = async () => {
		setSaving(true);
		setError(null);
		setError(await onSave(group, selected));
		setSaving(false);
	};

	const details = [
		`Showing ${selectedName}`,
		forced.length > 0 ? `always on: ${forced.map((badge) => badge.name).join(", ")}` : null,
		cooldown > 0 ? `you can change it in ${cooldown} min` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Row>
			<RowMain>
				<RowTitle>{slotTitle(group)}</RowTitle>
				<RowDescription $error={error !== null}>{error ?? details}</RowDescription>
			</RowMain>
			<Picker>
				{regular.map((badge) => {
					const image = pickBadgeImage(badge.sources);
					return (
						<Pick
							key={badge.assignmentId}
							type="button"
							title={badge.name}
							aria-label={badge.name}
							$selected={selected === badge.assignmentId}
							disabled={cooldown > 0 || saving}
							onClick={() => setSelected(badge.assignmentId)}
						>
							{image ? <img src={image} alt="" /> : badge.name.charAt(0)}
						</Pick>
					);
				})}
				<Pick
					type="button"
					title="None"
					$selected={selected === null}
					disabled={cooldown > 0 || saving}
					onClick={() => setSelected(null)}
				>
					None
				</Pick>
			</Picker>
			{dirty && (
				<Actions>
					<Button type="button" disabled={saving} onClick={() => setSelected(group.selectedAssignmentId)}>
						Cancel
					</Button>
					<Button type="button" $primary disabled={saving || cooldown > 0} onClick={save}>
						{saving ? "…" : "Save"}
					</Button>
				</Actions>
			)}
		</Row>
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
				<Row>
					<RowMain>
						<RowTitle>Enhancer account</RowTitle>
						<RowDescription $error={error !== null}>
							{error ??
								"Log in to claim Moment badges with one click and choose which badge shows next to your name. Not required: you can always claim by typing the command in chat."}
						</RowDescription>
					</RowMain>
					<Button type="button" $primary onClick={login} disabled={busy}>
						{busy ? "…" : "Log in"}
					</Button>
				</Row>
			</Container>
		);
	}

	const user = profile?.user;
	const displayName =
		user?.displayName ?? user?.username ?? account.displayName ?? account.username ?? "Enhancer account";
	const badgeCount = badges ? badges.global.length + badges.channels.length : null;
	const groups = badges ? groupBadgeSlots(badges) : [];
	const platforms = profile?.identities.map((identity) => formatProvider(identity.provider)) ?? [];
	const summary = [
		platforms.length > 0 ? `${platforms.join(", ")} connected` : null,
		badgeCount !== null ? `${badgeCount} ${badgeCount === 1 ? "badge" : "badges"}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<Container>
			<Row>
				{user?.avatarUrl ? (
					<Avatar src={user.avatarUrl} alt="" />
				) : (
					<AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
				)}
				<RowMain>
					<RowTitle>{displayName}</RowTitle>
					<RowDescription $error={error !== null}>{error ?? (summary || "Logged in")}</RowDescription>
				</RowMain>
				<Button type="button" onClick={logout} disabled={busy}>
					{busy ? "…" : "Log out"}
				</Button>
			</Row>
			<Heading>Badges</Heading>
			{badges === null ? (
				<RowDescription>Loading badges…</RowDescription>
			) : groups.length === 0 ? (
				<RowDescription>No badges yet. Claim one during a live Moment.</RowDescription>
			) : (
				groups.map((group) => <BadgeSlotEditor key={group.key} group={group} onSave={saveSlot} />)
			)}
		</Container>
	);
}
