import type {
	EmoteBarClickAction,
	EmoteBarEntry,
	EmoteBarProps,
	EmoteBarRemoval,
	EmoteBarRemovalState,
	EmoteCatalog,
} from "$types/platforms/twitch/twitch.emote-bar.types.ts";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled from "styled-components";
import { EMOTE_BAR_RECENT_WINDOW, selectVisible } from "./emote-bar.frecency.ts";
import { getEmoteClickAction, isMacPlatform } from "./emote-bar.send.ts";

const IS_MAC = isMacPlatform();
const SEND_HINT = IS_MAC ? "Cmd+Click to send" : "Ctrl+Click to send";
const EMOTE_HEIGHT = 24;
const BUTTON_HEIGHT = 30;
const MAX_RATIO = 3;
const ITEM_PADDING = 2;
const GAP = 2;
const REMOVAL_ARM_DELAY = 1000;
const REMOVAL_TIMEOUT = 5000;

function widthOf(entry: EmoteBarEntry): number {
	const ratio = Math.min(Math.max(entry.ratio || 1, 0.5), MAX_RATIO);
	return Math.ceil(EMOTE_HEIGHT * ratio) + ITEM_PADDING * 2 + GAP;
}

function isAvailable(entry: EmoteBarEntry, catalog: EmoteCatalog | null): boolean {
	if (!catalog || entry.provider === "twitch" || entry.lastUsed > catalog.loadedAt) return true;
	if (!catalog.providers.has(entry.provider)) return false;
	return catalog.names.get(entry.provider)?.has(entry.name) ?? true;
}

export function EmoteBarComponent({ entries, catalog, onInsert, onSend, onRemove, onRatio }: EmoteBarProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [hovered, setHovered] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const [displayed, setDisplayed] = useState<EmoteBarEntry[]>([]);
	const [removal, setRemoval] = useState<EmoteBarRemoval | null>(null);
	const currentEntries = entries.value;
	const currentCatalog = catalog.value;

	useEffect(() => {
		if (!ref.current) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(ref.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		setNow(Date.now());
		const timeout = setTimeout(() => setNow(Date.now()), EMOTE_BAR_RECENT_WINDOW + 1000);
		return () => clearTimeout(timeout);
	}, [currentEntries]);

	const removalName = removal?.name;
	useEffect(() => {
		if (!removalName) return;
		const arm = setTimeout(() => setRemoval({ name: removalName, armed: true }), REMOVAL_ARM_DELAY);
		const cancel = setTimeout(() => setRemoval(null), REMOVAL_TIMEOUT);
		return () => {
			clearTimeout(arm);
			clearTimeout(cancel);
		};
	}, [removalName]);

	const requestRemoval = (name: string) => {
		if (removal?.name !== name) {
			setRemoval({ name, armed: false });
			return;
		}
		if (!removal.armed) return;
		setRemoval(null);
		onRemove(name);
	};

	const handleAction = (name: string, action: EmoteBarClickAction, removalState: EmoteBarRemovalState) => {
		if (action === "remove") {
			requestRemoval(name);
			return;
		}
		if (action === "none") return;
		if (removalState !== "none") setRemoval(null);
		if (action === "send") onSend(name);
		else onInsert(name);
	};

	const available = useMemo(
		() => currentEntries.filter((entry) => isAvailable(entry, currentCatalog)),
		[currentEntries, currentCatalog],
	);
	const computed = useMemo(() => selectVisible(available, now, width + GAP, widthOf), [available, now, width]);

	useEffect(() => {
		if (!hovered) setDisplayed(computed);
	}, [computed, hovered]);

	const byName = new Map(available.map((entry) => [entry.name, entry]));
	const visible = displayed.flatMap((entry) => byName.get(entry.name) ?? []);
	const leftover = width + GAP - visible.reduce((total, entry) => total + widthOf(entry), 0);

	return (
		<Bar
			ref={ref}
			$empty={visible.length === 0}
			$full={visible.length > 1 && (visible.length < available.length || leftover < EMOTE_HEIGHT * 2)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{visible.map((entry) => {
				const removalState = removal?.name === entry.name ? (removal.armed ? "armed" : "pending") : "none";
				return (
					<EmoteButton
						key={entry.name}
						type="button"
						$removal={removalState}
						title={
							removalState === "none" ? `${entry.name} (${SEND_HINT})` : `${entry.name} (right-click again to remove)`
						}
						aria-label={entry.name}
						onClick={(event) => handleAction(entry.name, getEmoteClickAction(event, IS_MAC), removalState)}
						onContextMenu={(event) => {
							event.preventDefault();
							handleAction(entry.name, getEmoteClickAction(event, IS_MAC), removalState);
						}}
					>
						<img
							src={entry.src}
							alt={entry.name}
							onLoad={(event) => {
								const image = event.currentTarget;
								if (!image.naturalHeight) return;
								const ratio = image.naturalWidth / image.naturalHeight;
								if (Math.abs(ratio - entry.ratio) > 0.05) onRatio(entry.name, ratio);
							}}
						/>
					</EmoteButton>
				);
			})}
		</Bar>
	);
}

const Bar = styled.div<{ $empty: boolean; $full: boolean }>`
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	justify-content: ${({ $full }) => ($full ? "space-between" : "flex-start")};
	gap: ${GAP}px;
	overflow: hidden;
	box-sizing: content-box;
	height: ${({ $empty }) => ($empty ? "0" : `${BUTTON_HEIGHT}px`)};
	padding-top: ${({ $empty }) => ($empty ? "0" : "6px")};
	margin-bottom: ${({ $empty }) => ($empty ? "0" : "6px")};
	border-top: ${({ $empty }) => ($empty ? "none" : "1px solid rgba(255, 255, 255, 0.1)")};
`;

const REMOVAL_BACKGROUNDS: Record<EmoteBarRemovalState, string> = {
	none: "transparent",
	pending: "rgba(255, 71, 87, 0.2)",
	armed: "rgba(255, 71, 87, 0.45)",
};

const EmoteButton = styled.button<{ $removal: EmoteBarRemovalState }>`
	display: flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	height: ${BUTTON_HEIGHT}px;
	padding: 0 ${ITEM_PADDING}px;
	border: none;
	border-radius: var(--border-radius-medium, 4px);
	background: ${({ $removal }) => REMOVAL_BACKGROUNDS[$removal]};
	box-shadow: ${({ $removal }) => ($removal === "none" ? "none" : "inset 0 0 0 1px #ff4757")};
	cursor: pointer;
	transition:
		background-color 0.15s ease,
		box-shadow 0.15s ease;

	&:hover {
		background: ${({ $removal }) =>
			$removal === "none"
				? "var(--color-background-button-text-hover, rgba(83, 83, 95, 0.48))"
				: REMOVAL_BACKGROUNDS[$removal]};
	}

	&:active {
		background: ${({ $removal }) =>
			$removal === "none"
				? "var(--color-background-button-text-active, rgba(83, 83, 95, 0.55))"
				: REMOVAL_BACKGROUNDS[$removal]};
	}

	img {
		height: ${EMOTE_HEIGHT}px;
		width: auto;
		max-width: ${EMOTE_HEIGHT * MAX_RATIO}px;
		object-fit: contain;
		pointer-events: none;
	}
`;
