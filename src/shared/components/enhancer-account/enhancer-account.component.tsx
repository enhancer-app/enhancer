import { buildSlotRequest, cooldownMinutesLeft, groupBadgeSlots } from "$shared/enhancer-account/badge-slots.ts";
import { pickBadgeImage } from "$shared/marks/mark-countdown.ts";
import type { EnhancerViewerBadges, EnhancerViewerSummary } from "$types/apis/enhancer-account.apis.ts";
import type {
	BadgeSlotEditorProps,
	BadgeSlotGroup,
	EnhancerAccountComponentProps,
	LoginScreenProps,
} from "$types/shared/components/enhancer-account.component.types.ts";
import type { EnhancerAccountState } from "$types/shared/worker/enhancer-account-worker.types.ts";
import { useCallback, useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const DOCUMENTS_URL = "https://documents.enhancer.at/dashboard";

const PLATFORM_COLORS: Record<string, { background: string; color: string }> = {
	TWITCH: { background: "#9147ff", color: "#ffffff" },
	KICK: { background: "#53fc18", color: "#000000" },
	DISCORD: { background: "#5865f2", color: "#ffffff" },
};

const Container = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 10px;
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
	display: flex;
	flex-direction: column;
	gap: 6px;
`;

const RowTitle = styled.div`
	font-size: 14px;
	font-weight: 700;
	color: var(--settings-text-strong);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const Muted = styled.div<{ $error?: boolean }>`
	font-size: 12px;
	color: ${({ $error }) => ($error ? "#ff4757" : "var(--settings-text-muted)")};
`;

const Avatar = styled.img<{ $size: number }>`
	width: ${({ $size }) => $size}px;
	height: ${({ $size }) => $size}px;
	border-radius: 50%;
	object-fit: cover;
	flex-shrink: 0;
`;

const AvatarFallback = styled.div<{ $size: number }>`
	width: ${({ $size }) => $size}px;
	height: ${({ $size }) => $size}px;
	border-radius: 50%;
	background: var(--settings-control-hover);
	color: var(--settings-text-strong);
	font-size: ${({ $size }) => Math.round($size * 0.38)}px;
	font-weight: 700;
	display: grid;
	place-items: center;
	flex-shrink: 0;
`;

const Chips = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
`;

const Chip = styled.span<{ $background: string; $color: string }>`
	display: inline-flex;
	align-items: center;
	height: 22px;
	padding: 0 8px;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 600;
	background: ${({ $background }) => $background};
	color: ${({ $color }) => $color};
`;

const Heading = styled.div`
	font-size: 13px;
	font-weight: 600;
	color: var(--settings-text-strong);
	margin: 12px 0 0;
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

const Card = styled.div`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	overflow: hidden;
`;

const CardHeader = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px 16px;
`;

const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
	font-size: 12.5px;

	th {
		text-align: left;
		font-size: 11px;
		font-weight: 600;
		color: var(--settings-text-muted);
		padding: 8px 16px;
		border-top: 1px solid var(--settings-divider);
		border-bottom: 1px solid var(--settings-divider);
	}

	td {
		padding: 9px 16px;
		border-bottom: 1px solid var(--settings-divider);
		color: var(--settings-text);
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: none;
	}
`;

const BadgeCell = styled.label<{ $disabled: boolean }>`
	display: flex;
	align-items: center;
	gap: 8px;
	cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
	font-weight: 600;
	color: var(--settings-text-strong);

	input {
		accent-color: #9147ff;
		margin: 0;
	}

	img {
		width: 18px;
		height: 18px;
	}
`;

const Status = styled.span<{ $tone: "success" | "neutral" | "info" }>`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 11.5px;
	color: ${({ $tone }) =>
		$tone === "success" ? "#7bed9f" : $tone === "info" ? "#8ab4ff" : "var(--settings-text-muted)"};

	&::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}
`;

const CardFooter = styled.div`
	padding: 10px 16px;
	border-top: 1px solid var(--settings-divider);
`;

const LoginScreenWrapper = styled.div`
	position: relative;
	min-height: 440px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	padding: 40px 24px 20px;
	border-radius: 14px;
	border: 1px solid var(--settings-border);
	overflow: hidden;
	background:
		radial-gradient(600px 320px at 50% -15%, rgba(145, 71, 255, 0.22), transparent 70%), var(--settings-surface);
`;

const LoginMain = styled.div`
	width: 100%;
	max-width: 360px;
	margin: auto 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
`;

const LoginLogo = styled.img`
	width: 48px;
	height: 48px;
	margin-bottom: 18px;
`;

const LoginTitle = styled.h2`
	margin: 0;
	font-size: 24px;
	font-weight: 800;
	letter-spacing: -0.02em;
	color: var(--settings-text-primary);
`;

const LoginSubtitle = styled.p`
	margin: 10px 0 26px;
	font-size: 13px;
	line-height: 1.6;
	color: var(--settings-text-secondary);
`;

const LoginButton = styled.button`
	width: 100%;
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 50px;
	padding: 0 18px;
	border-radius: 10px;
	border: 1px solid var(--settings-control-border);
	background: var(--settings-control-background);
	color: var(--settings-text-primary);
	font-size: 14px;
	font-weight: 700;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		background 0.15s ease;

	img {
		width: 22px;
		height: 22px;
	}

	span {
		flex: 1;
		text-align: left;
	}

	svg {
		width: 16px;
		height: 16px;
		color: var(--settings-text-dim);
		transition: transform 0.15s ease;
	}

	&:hover:not(:disabled) {
		border-color: rgba(145, 71, 255, 0.7);
	}

	&:hover:not(:disabled) svg {
		color: var(--settings-text-primary);
		transform: translateX(3px);
	}

	&:disabled {
		opacity: 0.6;
		cursor: default;
	}
`;

const LoginHint = styled.p<{ $error?: boolean }>`
	margin: 18px 0 0;
	font-size: 12px;
	line-height: 1.6;
	color: ${({ $error }) => ($error ? "#ff4757" : "var(--settings-text-dim)")};
`;

const LoginFooter = styled.div`
	font-size: 12px;
	color: var(--settings-text-dim);
	text-align: center;

	a {
		color: var(--settings-text-secondary);
		text-decoration: none;
	}

	a:hover {
		color: var(--settings-text-primary);
		text-decoration: underline;
	}
`;

function formatProvider(provider: string): string {
	return provider.charAt(0) + provider.slice(1).toLowerCase();
}

function formatSince(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? "—"
		: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LoginScreen({ logoUrl, busy, error, onLogin }: LoginScreenProps) {
	return (
		<LoginScreenWrapper>
			<LoginMain>
				{logoUrl && <LoginLogo src={logoUrl} alt="" />}
				<LoginTitle>Enhancer Account</LoginTitle>
				<LoginSubtitle>Claim Mark badges with one click and choose which badge shows next to your name.</LoginSubtitle>
				<LoginButton type="button" onClick={onLogin} disabled={busy}>
					{logoUrl && <img src={logoUrl} alt="" />}
					<span>{busy ? "Waiting for login…" : "Continue with Enhancer"}</span>
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path
							d="M6 3l5 5-5 5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</LoginButton>
				<LoginHint $error={error !== null}>
					{error ?? "Optional. You can always claim a Mark by typing its command in chat."}
				</LoginHint>
			</LoginMain>
			<LoginFooter>
				<a href={`${DOCUMENTS_URL}/terms-of-service`} target="_blank" rel="noopener noreferrer">
					Terms of Service
				</a>
				{" · "}
				<a href={`${DOCUMENTS_URL}/privacy-policy`} target="_blank" rel="noopener noreferrer">
					Privacy Policy
				</a>
				{" · "}
				<a href={`${DOCUMENTS_URL}/cookie-policy`} target="_blank" rel="noopener noreferrer">
					Cookie Policy
				</a>
			</LoginFooter>
		</LoginScreenWrapper>
	);
}

function BadgeSlotEditor({ group, onSave }: BadgeSlotEditorProps) {
	const [selected, setSelected] = useState(group.selectedAssignmentId);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cooldown = cooldownMinutesLeft(group.cooldownUntil);
	const dirty = selected !== group.selectedAssignmentId;
	const locked = cooldown > 0 || saving;
	const channelName = group.channelDisplayName ?? group.channelLogin ?? "Channel";
	const title = group.scope === "GLOBAL" ? "Global badges" : channelName;
	const description =
		group.scope === "GLOBAL"
			? "One global badge is shown in chat."
			: `One badge from ${channelName} is shown on that channel.`;
	const rows = [...group.badges].sort((a, b) => a.name.localeCompare(b.name));
	const radioName = `slot-${group.key}`;

	useEffect(() => setSelected(group.selectedAssignmentId), [group.selectedAssignmentId]);

	const save = async () => {
		setSaving(true);
		setError(null);
		setError(await onSave(group, selected));
		setSaving(false);
	};

	const hint =
		error ??
		(cooldown > 0
			? `You can change this badge again in ${cooldown} min.`
			: dirty
				? "Unsaved changes. Badges can be changed once every 15 minutes."
				: "Badges can be changed once every 15 minutes.");

	return (
		<Card>
			<CardHeader>
				{group.scope === "CHANNEL" &&
					(group.channelAvatarUrl ? (
						<Avatar $size={36} src={group.channelAvatarUrl} alt="" />
					) : (
						<AvatarFallback $size={36}>{channelName.charAt(0).toUpperCase()}</AvatarFallback>
					))}
				<RowMain>
					<RowTitle>{title}</RowTitle>
					<Muted>{description}</Muted>
				</RowMain>
				<Button type="button" $primary={dirty} disabled={!dirty || locked} onClick={save}>
					{saving ? "…" : "Save"}
				</Button>
			</CardHeader>
			<Table>
				<thead>
					<tr>
						<th>Badge</th>
						<th>Status</th>
						<th>Since</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((badge) => {
						const image = pickBadgeImage(badge.sources);
						const shown = badge.forced ? !badge.hidden : selected === badge.assignmentId;
						return (
							<tr key={badge.assignmentId}>
								<td>
									<BadgeCell $disabled={locked || badge.forced}>
										<input
											type="radio"
											name={radioName}
											checked={shown}
											disabled={locked || badge.forced}
											onChange={() => setSelected(badge.assignmentId)}
										/>
										{image && <img src={image} alt="" />}
										{badge.name}
									</BadgeCell>
								</td>
								<td>
									{badge.forced ? (
										<Status $tone="info">Extra from admin</Status>
									) : shown ? (
										<Status $tone="success">Shown</Status>
									) : (
										<Status $tone="neutral">Hidden</Status>
									)}
								</td>
								<td>
									<Muted>{formatSince(badge.createdAt)}</Muted>
								</td>
							</tr>
						);
					})}
					<tr>
						<td>
							<BadgeCell $disabled={locked}>
								<input
									type="radio"
									name={radioName}
									checked={selected === null}
									disabled={locked}
									onChange={() => setSelected(null)}
								/>
								None
							</BadgeCell>
						</td>
						<td>{selected === null && <Status $tone="neutral">No badge shown</Status>}</td>
						<td>
							<Muted>—</Muted>
						</td>
					</tr>
				</tbody>
			</Table>
			<CardFooter>
				<Muted $error={error !== null}>{hint}</Muted>
			</CardFooter>
		</Card>
	);
}

export function EnhancerAccountComponent({ workerService, platform, logoUrl }: EnhancerAccountComponentProps) {
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
		return <LoginScreen logoUrl={logoUrl} busy={busy} error={error} onLogin={login} />;
	}

	const user = profile?.user;
	const displayName =
		user?.displayName ?? user?.username ?? account.displayName ?? account.username ?? "Enhancer account";
	const platformBadges = badges
		? {
				global: badges.global.filter((badge) => badge.accountPlatform.toLowerCase() === platform),
				channels: badges.channels.filter((badge) => badge.accountPlatform.toLowerCase() === platform),
			}
		: null;
	const groups = platformBadges ? groupBadgeSlots(platformBadges) : [];
	const badgeCount = badges ? badges.global.length + badges.channels.length : null;

	return (
		<Container>
			<Row>
				{user?.avatarUrl ? (
					<Avatar $size={48} src={user.avatarUrl} alt="" />
				) : (
					<AvatarFallback $size={48}>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
				)}
				<RowMain>
					<RowTitle>{displayName}</RowTitle>
					{profile && profile.identities.length > 0 && (
						<Chips>
							{profile.identities.map((identity) => {
								const colors = PLATFORM_COLORS[identity.provider] ?? {
									background: "var(--settings-control-hover)",
									color: "var(--settings-text)",
								};
								return (
									<Chip
										key={`${identity.provider}:${identity.providerUsername ?? ""}`}
										$background={colors.background}
										$color={colors.color}
									>
										{formatProvider(identity.provider)}
									</Chip>
								);
							})}
						</Chips>
					)}
					<Muted $error={error !== null}>
						{error ??
							(badgeCount === null ? "Loading…" : `${badgeCount} ${badgeCount === 1 ? "badge" : "badges"} collected`)}
					</Muted>
				</RowMain>
				<Button type="button" onClick={logout} disabled={busy}>
					{busy ? "…" : "Log out"}
				</Button>
			</Row>
			<Heading>Badges</Heading>
			{badges === null ? (
				<Muted>Loading badges…</Muted>
			) : groups.length === 0 ? (
				<Muted>No badges on this platform yet. Claim one during a live Mark.</Muted>
			) : (
				groups.map((group) => <BadgeSlotEditor key={group.key} group={group} onSave={saveSlot} />)
			)}
		</Container>
	);
}
