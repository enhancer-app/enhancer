import { filterPlatformBadges, findShownGlobalBadge, groupBadgeSlots } from "$shared/enhancer-account/badge-slots.ts";
import { getEnhancerAccountStore } from "$shared/enhancer-account/enhancer-account.store.ts";
import { pickBadgeImage } from "$shared/utils/badge-image.utils.ts";
import type { EnhancerAccountIdentityProps } from "$types/shared/components/enhancer-account.component.types.ts";
import { useEffect } from "preact/hooks";
import styled from "styled-components";

const IdentityButton = styled.button<{ $active: boolean }>`
	display: flex;
	align-items: center;
	flex-shrink: 0;
	gap: 10px;
	width: 100%;
	padding: 8px;
	border: none;
	border-radius: 10px;
	background: ${({ $active }) => ($active ? "var(--settings-surface)" : "transparent")};
	color: var(--settings-text-primary);
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition: background 0.12s ease;

	&:hover {
		background: var(--settings-surface);
	}
`;

const AvatarWrap = styled.span<{ $accent: boolean }>`
	position: relative;
	display: grid;
	place-items: center;
	flex-shrink: 0;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	background: ${({ $accent }) => ($accent ? "linear-gradient(135deg, #5b5bd6, #8d4bd6)" : "var(--settings-surface-raised)")};
	box-shadow: ${({ $accent }) =>
		$accent
			? "0 0 0 2px var(--settings-rail), 0 0 0 3px rgba(145, 71, 255, 0.5)"
			: "inset 0 0 0 1px var(--settings-control-border)"};
	color: ${({ $accent }) => ($accent ? "#ffffff" : "var(--settings-text-muted)")};
	font-size: 14px;
	font-weight: 600;

	img.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
`;

const Pip = styled.span`
	position: absolute;
	right: -3px;
	bottom: -3px;
	display: grid;
	place-items: center;
	width: 18px;
	height: 18px;
	border-radius: 5px;
	background: var(--settings-rail);

	img {
		width: 14px;
		height: 14px;
		border-radius: 3px;
	}
`;

const Who = styled.span`
	flex: 1;
	min-width: 0;
	line-height: 1.3;
`;

const Name = styled.span`
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 14px;
	font-weight: 600;
	letter-spacing: -0.01em;
`;

const Meta = styled.span<{ $cta: boolean }>`
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
	color: ${({ $cta }) => ($cta ? "var(--settings-accent-hover)" : "var(--settings-text-muted)")};
`;

const Chevron = styled.svg`
	flex-shrink: 0;
	color: var(--settings-text-faint);
`;

const PersonIcon = (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21a8 8 0 0 1 16 0" />
	</svg>
);

export function EnhancerAccountIdentity({
	open,
	active,
	onSelect,
	workerService,
	platform,
}: EnhancerAccountIdentityProps) {
	const store = getEnhancerAccountStore(workerService);

	useEffect(() => {
		if (open) store.start();
	}, [open, store]);

	const account = store.account.value;
	const profile = store.profile.value;
	const badges = store.badges.value;

	if (!account.loggedIn) {
		return (
			<IdentityButton type="button" $active={active} aria-current={active ? "page" : undefined} onClick={onSelect}>
				<AvatarWrap $accent={false}>{PersonIcon}</AvatarWrap>
				<Who>
					<Name>Enhancer Account</Name>
					<Meta $cta>Log in</Meta>
				</Who>
				<Chevron width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="m9 18 6-6-6-6" />
				</Chevron>
			</IdentityButton>
		);
	}

	const user = profile?.user;
	const displayName =
		user?.displayName ?? user?.username ?? account.displayName ?? account.username ?? "Enhancer Account";
	const shownBadge = badges ? findShownGlobalBadge(groupBadgeSlots(filterPlatformBadges(badges, platform))) : null;
	const badgeImage = shownBadge ? pickBadgeImage(shownBadge.sources) : null;
	const meta = badges ? (shownBadge?.name ?? "No badge shown") : "Enhancer Account";

	return (
		<IdentityButton type="button" $active={active} aria-current={active ? "page" : undefined} onClick={onSelect}>
			<AvatarWrap $accent>
				{user?.avatarUrl ? <img className="avatar" src={user.avatarUrl} alt="" /> : displayName.charAt(0).toUpperCase()}
				{badgeImage && (
					<Pip>
						<img src={badgeImage} alt="" />
					</Pip>
				)}
			</AvatarWrap>
			<Who>
				<Name>{displayName}</Name>
				<Meta $cta={false}>{meta}</Meta>
			</Who>
			<Chevron width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="m9 18 6-6-6-6" />
			</Chevron>
		</IdentityButton>
	);
}
