import {
	formatViewers,
	PLATFORM_COLORS,
	PLATFORM_NAMES,
	PlatformIcon,
} from "$shared/components/cross-platform-follows/platform.shared.tsx";
import { searchLinkCandidates } from "$shared/utils/follows-links.utils.ts";
import type {
	ChannelContextMenuProps,
	LinkChannelDialogProps,
	SidebarChannel,
} from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { createPortal } from "preact/compat";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import styled, { keyframes } from "styled-components";

const VIEWPORT_MARGIN = 8;
const MAX_RESULTS = 6;
const PLATFORMS: PlatformType[] = ["twitch", "kick"];
const FONT = 'Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif';

const THEMES: Record<PlatformType, { background: string; accent: string; accentText: string }> = {
	twitch: { background: "#1f1f23", accent: "#9147ff", accentText: "#bf94ff" },
	kick: { background: "#191b1f", accent: "#53fc18", accentText: "#53fc18" },
};

const otherPlatform = (platform: PlatformType): PlatformType => (platform === "twitch" ? "kick" : "twitch");

function useDismiss(ref: { current: HTMLElement | null }, onClose: () => void, anchor?: Element) {
	useEffect(() => {
		const close = (event: Event) => {
			if (!ref.current?.contains(event.target as Node | null)) onClose();
		};
		const closeOnScroll = (event: Event) => {
			const target = event.target;
			if (target === document || (target instanceof Element && anchor && target.contains(anchor))) onClose();
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("pointerdown", close, true);
		document.addEventListener("keydown", handleKey);
		window.addEventListener("resize", onClose);
		if (anchor) window.addEventListener("scroll", closeOnScroll, true);
		return () => {
			document.removeEventListener("pointerdown", close, true);
			document.removeEventListener("keydown", handleKey);
			window.removeEventListener("resize", onClose);
			window.removeEventListener("scroll", closeOnScroll, true);
		};
	}, [onClose]);
}

export function ChannelContextMenu({
	channel,
	anchor,
	x,
	y,
	host,
	pinsEnabled,
	onTogglePin,
	onLink,
	onPrefer,
	onUnlink,
	onClose,
}: ChannelContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	useDismiss(menuRef, onClose, anchor);

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu) return;
		menu.style.left = `${Math.min(x, window.innerWidth - menu.offsetWidth - VIEWPORT_MARGIN)}px`;
		menu.style.top = `${Math.min(y, window.innerHeight - menu.offsetHeight - VIEWPORT_MARGIN)}px`;
		menu.focus();
	}, [x, y]);

	const run = (action: () => void) => {
		onClose();
		action();
	};

	const moveFocus = (event: KeyboardEvent) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		event.preventDefault();
		const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
	};

	return createPortal(
		<Menu ref={menuRef} role="menu" tabIndex={-1} aria-label={channel.displayName} $theme={host} onKeyDown={moveFocus}>
			<MenuTitle>{channel.displayName}</MenuTitle>
			{pinsEnabled && (
				<MenuItem type="button" role="menuitem" $theme={host} onClick={() => run(() => onTogglePin(channel))}>
					{channel.pinned ? "Unpin channel" : "Pin channel"}
				</MenuItem>
			)}
			{channel.linked ? (
				<>
					<MenuSeparator />
					<MenuTitle>When live on both, show</MenuTitle>
					{PLATFORMS.map((platform) => (
						<MenuItem
							key={platform}
							type="button"
							role="menuitemradio"
							aria-checked={channel.linked!.primary === platform}
							$theme={host}
							onClick={() => run(() => onPrefer(channel, platform))}
						>
							<MenuLabel>
								<PlatformIcon platform={platform} size={12} />
								{PLATFORM_NAMES[platform]}
							</MenuLabel>
							{channel.linked!.primary === platform && <CheckIcon />}
						</MenuItem>
					))}
					<MenuSeparator />
					<MenuItem type="button" role="menuitem" $theme={host} onClick={() => run(() => onUnlink(channel))}>
						Unlink channels
					</MenuItem>
				</>
			) : (
				<MenuItem type="button" role="menuitem" $theme={host} onClick={() => run(() => onLink(channel))}>
					Link with {PLATFORM_NAMES[otherPlatform(channel.platform)]} channel…
				</MenuItem>
			)}
		</Menu>,
		document.body,
	);
}

export function LinkChannelDialog({ channel, channels, host, onLink, onClose }: LinkChannelDialogProps) {
	const target = otherPlatform(channel.platform);
	const [query, setQuery] = useState(channel.login);
	const [selected, setSelected] = useState<SidebarChannel | null>(null);
	const [primary, setPrimary] = useState<PlatformType>(host);
	const dialogRef = useRef<HTMLFormElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	useDismiss(dialogRef, onClose);

	const results = searchLinkCandidates(channels, target, query).slice(0, MAX_RESULTS);
	const chosen = selected && results.includes(selected) ? selected : null;

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	const submit = (event: Event) => {
		event.preventDefault();
		const pick = chosen ?? (results.length === 1 ? results[0] : null);
		if (pick) onLink(pick, primary);
	};

	return createPortal(
		<Overlay>
			<Dialog
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="enhancer-link-channel-title"
				$theme={host}
				onSubmit={submit}
			>
				<DialogTitle id="enhancer-link-channel-title">
					Link <strong>{channel.displayName}</strong> with a {PLATFORM_NAMES[target]} channel
				</DialogTitle>
				<SearchInput
					ref={inputRef}
					value={query}
					placeholder={`Search your ${PLATFORM_NAMES[target]} follows`}
					aria-label={`Search your ${PLATFORM_NAMES[target]} follows`}
					onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
					$theme={host}
				/>
				<Results role="listbox" aria-label={`${PLATFORM_NAMES[target]} channels`}>
					{results.map((item) => (
						<Result
							key={item.login}
							type="button"
							role="option"
							aria-selected={item === chosen}
							$theme={host}
							onClick={() => setSelected(item)}
						>
							<ResultAvatar $platform={target}>
								{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : <span />}
							</ResultAvatar>
							<ResultName>
								<strong>{item.displayName}</strong>
								<span>{item.login}</span>
							</ResultName>
							{item.live ? (
								<ResultLive>{formatViewers(item.viewers)}</ResultLive>
							) : (
								<ResultOffline>Offline</ResultOffline>
							)}
						</Result>
					))}
					{results.length === 0 && <Empty>No {PLATFORM_NAMES[target]} channel you follow matches.</Empty>}
				</Results>
				<Field>
					<span>When live on both, show</span>
					<Segmented role="radiogroup" aria-label="When live on both, show">
						{PLATFORMS.map((platform) => (
							<Segment
								key={platform}
								type="button"
								role="radio"
								aria-checked={primary === platform}
								$platform={platform}
								onClick={() => setPrimary(platform)}
							>
								<PlatformIcon platform={platform} size={12} />
								{PLATFORM_NAMES[platform]}
							</Segment>
						))}
					</Segmented>
				</Field>
				<Hint>If they're live on only one site, that site is shown.</Hint>
				<Actions>
					<Button type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" $primary $theme={host} disabled={!chosen && results.length !== 1}>
						Link
					</Button>
				</Actions>
			</Dialog>
		</Overlay>,
		document.body,
	);
}

const CheckIcon = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
		<path
			d="m5 12 5 5 9-10"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
);

type ThemeProps = { $theme: PlatformType };

const fadeIn = keyframes`
	from { opacity: 0; transform: translateY(-4px); }
	to { opacity: 1; transform: none; }
`;

const Menu = styled.div<ThemeProps>`
	position: fixed;
	z-index: 10000;
	display: flex;
	flex-direction: column;
	min-width: 190px;
	padding: 4px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	background: ${({ $theme }) => THEMES[$theme].background};
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	font-family: ${FONT};
	outline: none;
	animation: ${fadeIn} 0.12s ease-out;
`;

const MenuTitle = styled.span`
	padding: 6px 10px 4px;
	overflow: hidden;
	color: #8c8c96;
	font-size: 11px;
	font-weight: 600;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const MenuSeparator = styled.hr`
	margin: 4px 0;
	border: none;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const MenuItem = styled.button<ThemeProps>`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	height: 32px;
	padding: 0 10px;
	border: none;
	border-radius: 5px;
	background: transparent;
	color: #dedee3;
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	text-align: left;
	white-space: nowrap;
	cursor: pointer;
	outline: none;

	&:hover,
	&:focus-visible {
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
	}

	svg {
		color: ${({ $theme }) => THEMES[$theme].accentText};
	}
`;

const MenuLabel = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 8px;
`;

const Overlay = styled.div`
	position: fixed;
	inset: 0;
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.6);
	font-family: ${FONT};
`;

const Dialog = styled.form<ThemeProps>`
	display: flex;
	flex-direction: column;
	gap: 10px;
	box-sizing: border-box;
	width: 340px;
	max-width: calc(100vw - 32px);
	padding: 16px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 10px;
	background: ${({ $theme }) => THEMES[$theme].background};
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	color: #dedee3;
	font-size: 13px;
	animation: ${fadeIn} 0.15s ease-out;
`;

const DialogTitle = styled.h2`
	margin: 0;
	color: #fff;
	font-size: 15px;
	font-weight: 600;
	line-height: 1.3;
`;

const SearchInput = styled.input<ThemeProps>`
	box-sizing: border-box;
	width: 100%;
	height: 34px;
	padding: 0 10px;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.3);
	color: #fff;
	font: inherit;
	outline: none;

	&:focus {
		border-color: ${({ $theme }) => THEMES[$theme].accent};
	}
`;

const Results = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-height: 44px;
`;

const Result = styled.button<ThemeProps>`
	display: flex;
	align-items: center;
	gap: 10px;
	height: 42px;
	padding: 0 8px;
	border: 1px solid transparent;
	border-radius: 6px;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;

	&:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	&[aria-selected="true"] {
		border-color: ${({ $theme }) => THEMES[$theme].accent};
		background: rgba(255, 255, 255, 0.08);
	}
`;

const ResultAvatar = styled.span<{ $platform: PlatformType }>`
	position: relative;
	flex-shrink: 0;
	width: 28px;
	height: 28px;

	img,
	span {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: #232323;
		object-fit: cover;
	}

	&::after {
		content: "";
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 8px;
		height: 8px;
		border: 2px solid #18181b;
		border-radius: 50%;
		background: ${({ $platform }) => PLATFORM_COLORS[$platform]};
	}
`;

const ResultName = styled.span`
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;

	strong,
	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: #fff;
		font-weight: 600;
	}

	span {
		color: #8c8c96;
		font-size: 12px;
	}
`;

const ResultLive = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 5px;
	color: #dedee3;
	font-size: 12px;

	&::before {
		content: "";
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #eb0400;
	}
`;

const ResultOffline = styled.span`
	color: #8c8c96;
	font-size: 12px;
`;

const Empty = styled.p`
	margin: 0;
	padding: 12px 8px;
	color: #8c8c96;
`;

const Field = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding-top: 4px;
`;

const Segmented = styled.div`
	display: flex;
	padding: 2px;
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.3);
`;

const Segment = styled.button<{ $platform: PlatformType }>`
	display: inline-flex;
	align-items: center;
	gap: 5px;
	height: 26px;
	padding: 0 10px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: #8c8c96;
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;

	&[aria-checked="true"] {
		background: ${({ $platform }) => `${PLATFORM_COLORS[$platform]}33`};
		color: #fff;
	}
`;

const Hint = styled.p`
	margin: -4px 0 0;
	color: #8c8c96;
	font-size: 12px;
`;

const Actions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	padding-top: 4px;
`;

const Button = styled.button<{ $primary?: boolean; $theme?: PlatformType }>`
	height: 30px;
	padding: 0 14px;
	border: none;
	border-radius: 5px;
	background: ${({ $primary, $theme }) => ($primary && $theme ? THEMES[$theme].accent : "rgba(255, 255, 255, 0.1)")};
	color: ${({ $primary, $theme }) => ($primary && $theme === "kick" ? "#000" : "#fff")};
	font: inherit;
	font-weight: 600;
	cursor: pointer;

	&:disabled {
		opacity: 0.4;
		cursor: default;
	}
`;
