import {
	cooldownMinutesLeft,
	filterAccountBadges,
	filterPlatformBadges,
	filterSlotGroups,
	groupBadgeSlots,
	pickSlotBadge,
	sortChatAccounts,
	toggleSlotBadge,
} from "$shared/enhancer-account/badge-slots.ts";
import { ChatStyleCard } from "$shared/components/enhancer-account/chat-style.component.tsx";
import { ENHANCER_ENDPOINTS } from "$shared/enhancer-environment.ts";
import { getEnhancerAccountStore } from "$shared/enhancer-account/enhancer-account.store.ts";
import { pickBadgeImage } from "$shared/utils/badge-image.utils.ts";
import type {
	BadgeSlotEditorProps,
	BadgeSlotGroup,
	EnhancerAccountComponentProps,
	LoginScreenProps,
} from "$types/shared/components/enhancer-account.component.types.ts";
import { useEffect, useState } from "preact/hooks";
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
`;

const HeadingRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-top: 12px;
`;

const TitleCount = styled.span`
	margin-left: 6px;
	font-size: 12px;
	font-weight: 400;
	color: var(--settings-text-muted);
`;

const Search = styled.label`
	display: flex;
	align-items: center;
	gap: 8px;
	width: 240px;
	height: 32px;
	padding: 0 10px;
	border-radius: 9px;
	border: 1px solid var(--settings-border);
	background: var(--settings-control-background);
	color: var(--settings-text-faint);

	&:focus-within {
		border-color: #9147ff;
		color: #9147ff;
	}

	svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	input {
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--settings-text-primary);
		font: inherit;
		font-size: 12px;
	}

	input::placeholder {
		color: var(--settings-input-placeholder);
	}
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

const RowActions = styled.div`
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 8px;
`;

const LinkButton = styled.a`
	display: inline-flex;
	align-items: center;
	height: 30px;
	padding: 0 12px;
	border: 1px solid var(--settings-control-border);
	border-radius: 8px;
	background: var(--settings-control-background);
	color: var(--settings-text);
	font-size: 12px;
	font-weight: 600;
	text-decoration: none;
	white-space: nowrap;

	&:hover {
		border-color: var(--settings-text-faint);
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

const StatusList = styled.span`
	display: inline-flex;
	flex-wrap: wrap;
	gap: 4px 12px;
`;

const CardFooter = styled.div`
	padding: 10px 16px;
	border-top: 1px solid var(--settings-divider);
`;

const AccountTabs = styled.div`
	display: inline-flex;
	flex-wrap: wrap;
	gap: 2px;
	padding: 3px;
	border-radius: 9px;
	background: var(--settings-well);
	box-shadow: inset 0 0 0 1px var(--settings-border);
`;

const AccountTab = styled.button<{ $active: boolean }>`
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 6px 12px;
	border: none;
	border-radius: 6px;
	background: ${({ $active }) => ($active ? "var(--settings-surface-hover)" : "transparent")};
	color: ${({ $active }) => ($active ? "var(--settings-text-primary)" : "var(--settings-text-muted)")};
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;

	&:hover {
		color: var(--settings-text-primary);
	}
`;

const PlatformDot = styled.span<{ $color: string }>`
	width: 8px;
	height: 8px;
	border-radius: 2px;
	background: ${({ $color }) => $color};
`;

const AccountPage = styled.div`
	width: 100%;
	max-width: 860px;
	margin: 0 auto;
	padding: 32px 56px 56px;
`;

const AccountTitle = styled.h1`
	margin: 0 0 28px;
	padding-right: 32px;
	font-size: 24px;
	line-height: 1.15;
	font-weight: 600;
	letter-spacing: -0.03em;
	color: var(--settings-text-primary);
	background: linear-gradient(180deg, var(--settings-text-primary) 30%, var(--settings-text-secondary));
	-webkit-background-clip: text;
	background-clip: text;
	-webkit-text-fill-color: transparent;
`;

const LoginPage = styled.div`
	position: relative;
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 100%;
	padding: 0 56px;
	overflow: clip;
	text-align: center;
	background: radial-gradient(520px 360px at 50% 34%, rgba(145, 71, 255, 0.26), transparent 70%);
`;

const LoginMain = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	max-width: 380px;
`;

const LoginMark = styled.div`
	display: grid;
	place-items: center;
	width: 76px;
	height: 76px;
	border-radius: 22px;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);

	img {
		width: 48px;
		height: 48px;
		border-radius: 12px;
	}
`;

const LoginTitle = styled.h2`
	margin: 24px 0 0;
	font-size: 28px;
	font-weight: 600;
	letter-spacing: -0.035em;
	color: var(--settings-text-primary);
`;

const LoginSubtitle = styled.p`
	margin: 10px 0 24px;
	max-width: 360px;
	font-size: 14.5px;
	line-height: 1.5;
	color: var(--settings-text-secondary);
`;

const LoginButton = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 220px;
	height: 46px;
	padding: 0 24px;
	border: none;
	border-radius: 12px;
	background: var(--settings-accent, #9147ff);
	color: #ffffff;
	font: inherit;
	font-size: 14.5px;
	font-weight: 600;
	cursor: pointer;
	transition:
		background 0.12s ease,
		transform 0.12s ease;

	&:hover:not(:disabled) {
		background: var(--settings-accent-hover, #a970ff);
	}

	&:active:not(:disabled) {
		transform: scale(0.97);
	}

	&:disabled {
		opacity: 0.6;
		cursor: default;
	}
`;

const LoginHint = styled.p<{ $error?: boolean }>`
	margin: 24px 0 0;
	max-width: 320px;
	font-size: 12.5px;
	line-height: 1.5;
	color: ${({ $error }) => ($error ? "var(--settings-danger, #ff4757)" : "var(--settings-text-faint)")};
`;

const LoginFooter = styled.div`
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	justify-content: center;
	gap: 8px;
	padding: 20px 0 22px;
	font-size: 12.5px;
	color: var(--settings-text-faint);

	a {
		color: var(--settings-text-muted);
		text-decoration: none;
	}

	a:hover {
		color: var(--settings-text-primary);
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
		<LoginPage>
			<LoginMain>
				{logoUrl && (
					<LoginMark>
						<img src={logoUrl} alt="" />
					</LoginMark>
				)}
				<LoginTitle>Enhancer Account</LoginTitle>
				<LoginSubtitle>Log in to pick your badges and change how your name looks in chat.</LoginSubtitle>
				<LoginButton type="button" onClick={onLogin} disabled={busy}>
					{busy ? "Waiting for login…" : "Log in"}
				</LoginButton>
				<LoginHint $error={error !== null}>
					{error ?? "Optional. The rest of Enhancer works the same without an account."}
				</LoginHint>
			</LoginMain>
			<LoginFooter>
				<a href={`${DOCUMENTS_URL}/terms-of-service`} target="_blank" rel="noopener noreferrer">
					Terms of Service
				</a>
				<span>·</span>
				<a href={`${DOCUMENTS_URL}/privacy-policy`} target="_blank" rel="noopener noreferrer">
					Privacy Policy
				</a>
				<span>·</span>
				<a href={`${DOCUMENTS_URL}/cookie-policy`} target="_blank" rel="noopener noreferrer">
					Cookie Policy
				</a>
			</LoginFooter>
		</LoginPage>
	);
}

function sameIds(left: ReadonlySet<string>, right: readonly string[]): boolean {
	return left.size === right.length && right.every((id) => left.has(id));
}

function BadgeSlotEditor({ group, onSave }: BadgeSlotEditorProps) {
	const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set(group.visibleAssignmentIds));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cooldown = cooldownMinutesLeft(group.cooldownUntil);
	const dirty = !sameIds(visible, group.visibleAssignmentIds);
	const locked = cooldown > 0 || saving;
	const channelName = group.channelDisplayName ?? group.channelLogin ?? "Channel";
	const title = group.scope === "GLOBAL" ? "Global badges" : channelName;
	const description = group.multi
		? "Extras from admin can be shown next to one regular badge."
		: group.scope === "GLOBAL"
			? "One global badge is shown in chat."
			: `One badge from ${channelName} is shown on that channel.`;
	const rows = [...group.badges].sort((a, b) => a.name.localeCompare(b.name));
	const inputName = `slot-${group.key}`;
	const inputType = group.multi ? "checkbox" : "radio";

	useEffect(() => setVisible(new Set(group.visibleAssignmentIds)), [group.visibleAssignmentIds.join("|")]);

	const choose = (assignmentId: string) =>
		setVisible((current) =>
			group.multi ? toggleSlotBadge(group, current, assignmentId) : pickSlotBadge(group, current, assignmentId),
		);

	const save = async () => {
		setSaving(true);
		setError(null);
		setError(await onSave(group, [...visible]));
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
						const shown = visible.has(badge.assignmentId);
						return (
							<tr key={badge.assignmentId}>
								<td>
									<BadgeCell $disabled={locked}>
										<input
											type={inputType}
											name={inputName}
											checked={shown}
											disabled={locked}
											onChange={() => choose(badge.assignmentId)}
										/>
										{image && <img src={image} alt="" />}
										{badge.name}
									</BadgeCell>
								</td>
								<td>
									<StatusList>
										{shown ? <Status $tone="success">Shown</Status> : <Status $tone="neutral">Hidden</Status>}
										{badge.forced && <Status $tone="info">Extra from admin</Status>}
									</StatusList>
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
									type={inputType}
									name={inputName}
									checked={visible.size === 0}
									disabled={locked}
									onChange={() => setVisible(new Set())}
								/>
								None
							</BadgeCell>
						</td>
						<td>{visible.size === 0 && <Status $tone="neutral">No badge shown</Status>}</td>
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
	const store = getEnhancerAccountStore(workerService);
	const [query, setQuery] = useState("");
	const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

	useEffect(() => {
		store.start();
		void store.refresh();
	}, [store]);

	const account = store.account.value;
	const profile = store.profile.value;
	const badges = store.badges.value;
	const badgesFailed = store.badgesFailed.value;
	const busy = store.busy.value;
	const error = store.error.value;
	const login = () => void store.login();
	const logout = () => void store.logout();
	const saveSlot = (group: BadgeSlotGroup, visibleAssignmentIds: string[]) =>
		store.saveSlot(group, visibleAssignmentIds);
	const billing = store.billing.value;
	const billingFailed = store.billingFailed.value;

	if (!store.ready.value) return null;

	if (!account.loggedIn) {
		return <LoginScreen logoUrl={logoUrl} busy={busy} error={error} onLogin={login} />;
	}

	const user = profile?.user;
	const displayName =
		user?.displayName ?? user?.username ?? account.displayName ?? account.username ?? "Enhancer account";
	const chatAccounts = billing ? sortChatAccounts(billing.accounts, platform) : [];
	const activeAccount = chatAccounts.find((item) => item.accountId === selectedAccountId) ?? chatAccounts[0] ?? null;
	const scopedBadges = badges
		? activeAccount
			? filterAccountBadges(badges, activeAccount.accountId)
			: filterPlatformBadges(badges, platform)
		: null;
	const groups = scopedBadges ? groupBadgeSlots(scopedBadges) : [];
	const visibleGroups = filterSlotGroups(groups, query);
	const badgeCount = badges ? badges.global.length + badges.channels.length : null;

	return (
		<AccountPage>
			<AccountTitle>Account</AccountTitle>
			<Container>
				<Row>
					{user?.avatarUrl ? (
						<Avatar $size={48} src={user.avatarUrl} alt="" />
					) : (
						<AvatarFallback $size={48}>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
					)}
					<RowMain>
						<RowTitle>
							{displayName}
							{badgeCount !== null && (
								<TitleCount>
									· {badgeCount} {badgeCount === 1 ? "badge" : "badges"} collected
								</TitleCount>
							)}
						</RowTitle>
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
						{error && <Muted $error>{error}</Muted>}
					</RowMain>
					<RowActions>
						<LinkButton
							href={`${ENHANCER_ENDPOINTS[account.environment].dashboard}/account`}
							target="_blank"
							rel="noopener noreferrer"
						>
							Manage account
						</LinkButton>
						<Button type="button" onClick={logout} disabled={busy}>
							{busy ? "…" : "Log out"}
						</Button>
					</RowActions>
				</Row>
				{chatAccounts.length > 1 && (
					<AccountTabs role="tablist" aria-label="Linked accounts">
						{chatAccounts.map((item) => (
							<AccountTab
								key={item.accountId}
								type="button"
								role="tab"
								aria-selected={item.accountId === activeAccount?.accountId}
								$active={item.accountId === activeAccount?.accountId}
								onClick={() => {
									setSelectedAccountId(item.accountId);
									setQuery("");
								}}
							>
								<PlatformDot $color={PLATFORM_COLORS[item.platform]?.background ?? "var(--settings-text-muted)"} />@
								{item.login}
							</AccountTab>
						))}
					</AccountTabs>
				)}
				{billing && activeAccount ? (
					<ChatStyleCard
						key={activeAccount.accountId}
						perks={billing.style}
						account={activeAccount}
						plansAvailable={billing.enabled}
						onSaveStyle={(style) => store.saveChatStyle(style)}
						onSubmitNickname={(accountId, nickname) => store.submitNickname(accountId, nickname)}
						onClearNickname={(accountId) => store.clearNickname(accountId)}
					/>
				) : billingFailed ? (
					<Muted $error>Could not load your chat style.</Muted>
				) : null}
				<HeadingRow>
					<Heading>Badges</Heading>
					{groups.length > 0 && (
						<Search>
							<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
								<circle cx="7" cy="7" r="4.5" />
								<path d="M10.5 10.5L14 14" />
							</svg>
							<input
								type="search"
								placeholder="Search channels"
								aria-label="Search channels"
								value={query}
								onInput={(event) => setQuery(event.currentTarget.value)}
							/>
						</Search>
					)}
				</HeadingRow>
				{badges === null ? (
					<Muted $error={badgesFailed}>{badgesFailed ? "Could not load your badges." : "Loading badges…"}</Muted>
				) : groups.length === 0 ? (
					<Muted>{activeAccount ? "No badges on this account yet." : "No badges on this platform yet."}</Muted>
				) : visibleGroups.length === 0 ? (
					<Muted>No channels match "{query.trim()}".</Muted>
				) : (
					visibleGroups.map((group) => <BadgeSlotEditor key={group.key} group={group} onSave={saveSlot} />)
				)}
			</Container>
		</AccountPage>
	);
}
