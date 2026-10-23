import type { SortMenuComponentProps, SortMenuTheme } from "$types/shared/components/sort-menu.component.types.ts";
import { createPortal } from "preact/compat";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import styled, { keyframes } from "styled-components";

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

const THEMES: Record<SortMenuTheme, { background: string; border: string; hover: string; accent: string }> = {
	home: {
		background: "#1f1f23",
		border: "rgba(255, 255, 255, 0.1)",
		hover: "rgba(255, 255, 255, 0.08)",
		accent: "#bf94ff",
	},
	twitch: {
		background: "#1f1f23",
		border: "rgba(255, 255, 255, 0.1)",
		hover: "rgba(255, 255, 255, 0.08)",
		accent: "#bf94ff",
	},
	kick: {
		background: "#191b1f",
		border: "rgba(255, 255, 255, 0.1)",
		hover: "rgba(255, 255, 255, 0.08)",
		accent: "#53fc18",
	},
};

export function SortMenuComponent<T extends string>({
	value,
	options,
	labels,
	onChange,
	theme,
	label,
	align = "start",
	renderTrigger,
}: SortMenuComponentProps<T>) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const button = triggerRef.current;
		const menu = menuRef.current;
		if (!open || !button || !menu) return;
		const anchor = button.getBoundingClientRect();
		const width = menu.offsetWidth;
		const preferred = align === "end" ? anchor.right - width : anchor.left;
		const left = Math.min(Math.max(VIEWPORT_MARGIN, preferred), window.innerWidth - width - VIEWPORT_MARGIN);
		menu.style.left = `${left}px`;
		menu.style.top = `${anchor.bottom + MENU_GAP}px`;
		menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
	}, [open, align]);

	useEffect(() => {
		if (!open) return;
		const close = (event: Event) => {
			const target = event.target as Node | null;
			if (target && (menuRef.current?.contains(target) || triggerRef.current?.contains(target))) return;
			setOpen(false);
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		const dismiss = () => setOpen(false);
		document.addEventListener("pointerdown", close, true);
		document.addEventListener("keydown", handleKey);
		window.addEventListener("resize", dismiss);
		window.addEventListener("scroll", close, true);
		return () => {
			document.removeEventListener("pointerdown", close, true);
			document.removeEventListener("keydown", handleKey);
			window.removeEventListener("resize", dismiss);
			window.removeEventListener("scroll", close, true);
		};
	}, [open]);

	const moveFocus = (event: KeyboardEvent) => {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		event.preventDefault();
		const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
		const index = items.indexOf(document.activeElement as HTMLButtonElement);
		const step = event.key === "ArrowDown" ? 1 : -1;
		items[(index + step + items.length) % items.length]?.focus();
	};

	const select = (option: T) => {
		setOpen(false);
		triggerRef.current?.focus();
		if (option !== value) onChange(option);
	};

	return (
		<>
			<TriggerButton
				ref={triggerRef}
				type="button"
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				data-open={open || undefined}
				onClick={() => setOpen(!open)}
			>
				{renderTrigger(open)}
			</TriggerButton>
			{open &&
				createPortal(
					<Menu ref={menuRef} role="menu" aria-label={label} $theme={theme} onKeyDown={moveFocus}>
						{options.map((option) => (
							<MenuItem
								key={option}
								type="button"
								role="menuitemradio"
								aria-checked={option === value}
								$theme={theme}
								onClick={() => select(option)}
							>
								{labels[option]}
								{option === value && (
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
								)}
							</MenuItem>
						))}
					</Menu>,
					document.body,
				)}
		</>
	);
}

const menuIn = keyframes`
	from { opacity: 0; transform: translateY(-4px); }
	to { opacity: 1; transform: none; }
`;

const TriggerButton = styled.button`
	display: inline-flex;
	align-items: center;
	padding: 0;
	border: none;
	background: none;
	color: inherit;
	font: inherit;
	cursor: pointer;
`;

const Menu = styled.div<{ $theme: SortMenuTheme }>`
	position: fixed;
	z-index: 10000;
	display: flex;
	flex-direction: column;
	min-width: 168px;
	padding: 4px;
	border: 1px solid ${({ $theme }) => THEMES[$theme].border};
	border-radius: 8px;
	background: ${({ $theme }) => THEMES[$theme].background};
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	font-family: Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif;
	animation: ${menuIn} 0.12s ease-out;
`;

const MenuItem = styled.button<{ $theme: SortMenuTheme }>`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	height: 32px;
	padding: 0 10px;
	border: none;
	border-radius: 5px;
	background: transparent;
	color: ${({ "aria-checked": checked }) => (checked ? "#fff" : "#c8c8cc")};
	font: inherit;
	font-size: 13px;
	font-weight: ${({ "aria-checked": checked }) => (checked ? 600 : 500)};
	text-align: left;
	white-space: nowrap;
	cursor: pointer;
	outline: none;

	&:hover,
	&:focus-visible {
		background: ${({ $theme }) => THEMES[$theme].hover};
		color: #fff;
	}

	svg {
		color: ${({ $theme }) => THEMES[$theme].accent};
	}
`;
