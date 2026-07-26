import { Logger } from "$shared/logger/logger.ts";
import type {
	SettingCategory,
	SettingDefinition,
	SettingsProps,
} from "$types/shared/components/settings.component.types.ts";
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled from "styled-components";

const logger = new Logger({ context: "settings-ui" });

const FONT = `"Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif`;

const SettingsContainer = styled.div`
	--settings-background: #0d0d0d;
	--settings-surface: #111111;
	--settings-surface-raised: #121212;
	--settings-border: #1e1e1e;
	--settings-divider: #1c1c1c;
	--settings-divider-subtle: #1a1a1a;
	--settings-control-background: #0d0d0d;
	--settings-control-border: #262626;
	--settings-control-hover: #1c1c1c;
	--settings-toggle-background: #2a2a2a;
	--settings-toggle-hover: #333333;
	--settings-text-primary: #ffffff;
	--settings-text-strong: #f0f0f0;
	--settings-text: #e5e5e5;
	--settings-text-secondary: #a5a5a5;
	--settings-text-muted: #7c7c7c;
	--settings-text-dim: #6a6a6a;
	--settings-text-faint: #565656;
	--settings-input-placeholder: #4f4f4f;

	html.tw-root--theme-light & {
		--settings-background: #f7f7f8;
		--settings-surface: #ffffff;
		--settings-surface-raised: #ffffff;
		--settings-border: #dedee3;
		--settings-divider: #dedee3;
		--settings-divider-subtle: #e5e5e7;
		--settings-control-background: #ffffff;
		--settings-control-border: #cfcfd5;
		--settings-control-hover: #e5e5e7;
		--settings-toggle-background: #c4c4c9;
		--settings-toggle-hover: #b5b5bb;
		--settings-text-primary: #0e0e10;
		--settings-text-strong: #18181b;
		--settings-text: #2f2f35;
		--settings-text-secondary: #53535f;
		--settings-text-muted: #6e6e78;
		--settings-text-dim: #6e6e78;
		--settings-text-faint: #878791;
		--settings-input-placeholder: #8f8f99;
	}

	display: flex;
	flex-direction: column;
	width: min(940px, 92vw);
	height: min(640px, 86vh);
	background-color: var(--settings-background);
	border-radius: 16px;
	border: 1px solid var(--settings-border);
	box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
	position: relative;
	overflow: hidden;
	font-family: ${FONT} !important;

	* {
		box-sizing: border-box;
	}
`;

const Gradient = styled.div`
	position: absolute;
	top: 0;
	left: 0;
	height: 320px;
	width: 420px;
	z-index: 0;
	pointer-events: none;
	background: radial-gradient(circle 320px at 0% 0%, rgba(145, 71, 255, 0.18), transparent 70%);
`;

const Header = styled.header`
	display: flex;
	align-items: center;
	padding: 0 16px;
	color: var(--settings-text-primary);
	gap: 12px;
	height: 60px;
	flex-shrink: 0;
	border-bottom: 1px solid var(--settings-divider);
	position: relative;
	z-index: 2;
`;

const Brand = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	flex-shrink: 0;
`;

const LogoContainer = styled.div`
	width: 34px;
	height: 34px;
	display: flex;
	justify-content: center;
	align-items: center;
	border-radius: 9px;
	box-shadow: inset 0 1px 0 0 var(--settings-control-hover);
	background: linear-gradient(to bottom, var(--settings-control-hover) 5%, var(--settings-divider) 100%);
	flex-shrink: 0;
`;

const Logo = styled.img`
	width: 22px;
	height: 22px;
`;

const BrandText = styled.div`
	display: flex;
	flex-direction: column;
	line-height: 1.15;
`;

const BrandName = styled.span`
	font-size: 14px;
	font-weight: 600;
	color: var(--settings-text-primary);
`;

const BrandMeta = styled.span`
	font-size: 10px;
	color: var(--settings-text-dim);
	text-transform: capitalize;
`;

const HeaderSpacer = styled.div`
	flex: 1;
`;

const SearchContainer = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	width: 260px;
	background: var(--settings-control-background);
	border: 1px solid var(--settings-border);
	border-radius: 9px;
	padding: 0 10px;
	height: 34px;
	color: var(--settings-text-faint);
	transition: border-color 0.15s ease, background 0.15s ease;

	&:focus-within {
		border-color: #9147ff;
		background: var(--settings-surface);
		color: #9147ff;
	}
`;

const SearchInput = styled.input`
	flex: 1;
	min-width: 0;
	background: none;
	border: none;
	color: var(--settings-text-primary);
	font-family: ${FONT};
	font-size: 12px;
	padding: 0;
	outline: none;
	height: 100%;

	&::placeholder {
		color: var(--settings-input-placeholder);
	}
`;

const IconButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	color: var(--settings-text-dim);
	padding: 0;
	width: 22px;
	height: 22px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 5px;
	flex-shrink: 0;
	transition: color 0.15s ease, background 0.15s ease;

	&:hover {
		color: var(--settings-text-primary);
	}
`;

const CloseButton = styled(IconButton)`
	width: 30px;
	height: 30px;

	&:hover {
		background: var(--settings-control-hover);
		color: var(--settings-text-primary);
	}
`;

const Body = styled.div`
	display: flex;
	flex: 1;
	min-height: 0;
	position: relative;
	z-index: 1;
`;

const Sidebar = styled.nav`
	width: 194px;
	flex-shrink: 0;
	border-right: 1px solid var(--settings-divider);
	display: flex;
	flex-direction: column;
	padding: 12px 10px;
	gap: 2px;
	overflow-y: auto;
`;

const NavItem = styled.button<{ active: boolean; dimmed: boolean }>`
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	border: none;
	cursor: pointer;
	text-align: left;
	font-family: ${FONT};
	font-size: 13px;
	padding: 9px 10px;
	border-radius: 8px;
	transition: background 0.15s ease, color 0.15s ease;
	background: ${(props) => (props.active ? "rgba(145, 71, 255, 0.14)" : "transparent")};
	color: ${(props) =>
		props.active
			? "var(--settings-text-primary)"
			: props.dimmed
				? "var(--settings-text-dim)"
				: "var(--settings-text-secondary)"};

	svg {
		flex-shrink: 0;
		color: ${(props) => (props.active ? "#9147ff" : "currentColor")};
	}

	&:hover {
		background: ${(props) => (props.active ? "rgba(145, 71, 255, 0.18)" : "var(--settings-control-hover)")};
		color: ${(props) => (props.active ? "var(--settings-text-primary)" : "var(--settings-text)")};
	}
`;

const NavLabel = styled.span`
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const NavCount = styled.span`
	font-size: 10px;
	font-weight: 600;
	color: #9147ff;
	background: rgba(145, 71, 255, 0.15);
	border-radius: 10px;
	padding: 2px 7px;
`;

const SidebarFooter = styled.div`
	margin-top: auto;
	padding: 12px 10px 2px;
	border-top: 1px solid var(--settings-divider);
	font-size: 10px;
	color: var(--settings-text-dim);
	display: flex;
	justify-content: space-between;
	gap: 6px;
`;

const Content = styled.div`
	flex: 1;
	min-width: 0;
	overflow-y: auto;
	padding: 22px 24px 28px;

	&::-webkit-scrollbar {
		width: 10px;
	}

	&::-webkit-scrollbar-track {
		background: transparent;
	}

	&::-webkit-scrollbar-thumb {
		background: var(--settings-border);
		border-radius: 10px;
		border: 3px solid var(--settings-background);
	}

	&::-webkit-scrollbar-thumb:hover {
		background: var(--settings-control-border);
	}

	scrollbar-width: thin;
	scrollbar-color: var(--settings-border) transparent;
`;

const SectionTitle = styled.h2`
	margin: 0 0 14px;
	font-size: 16px;
	font-weight: 600;
	color: var(--settings-text-primary);
	display: flex;
	align-items: center;
	gap: 8px;

	&::after {
		content: "";
		flex: 1;
		height: 1px;
		background: var(--settings-divider);
	}
`;

const Section = styled.section`
	& + & {
		margin-top: 26px;
	}
`;

const Card = styled.div`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	overflow: hidden;

	& + & {
		margin-top: 12px;
	}
`;

const Panel = styled.div`
	margin: 12px 0 0;

	&:first-child {
		margin-top: 0;
	}
`;

const Row = styled.div<{ disabled: boolean; nested: boolean }>`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	padding: 14px 16px;
	padding-left: ${(props) => (props.nested ? "30px" : "16px")};
	position: relative;
	opacity: ${(props) => (props.disabled ? 0.4 : 1)};
	transition: opacity 0.15s ease;

	& + & {
		border-top: 1px solid var(--settings-divider-subtle);
	}

	${(props) =>
		props.nested
			? `
		&::before {
			content: "";
			position: absolute;
			left: 16px;
			top: 14px;
			bottom: 14px;
			width: 2px;
			border-radius: 2px;
			background: var(--settings-control-border);
		}
	`
			: ""}
`;

const RowInfo = styled.div`
	flex: 1;
	min-width: 0;
`;

const RowTitle = styled.div`
	font-size: 13px;
	font-weight: 500;
	color: var(--settings-text-strong);
	margin-bottom: 3px;
	display: flex;
	align-items: center;
	gap: 8px;
`;

const RowDescription = styled.div`
	color: var(--settings-text-muted);
	font-size: 11.5px;
	line-height: 1.5;
`;

const CategoryTag = styled.span`
	font-size: 9px;
	font-weight: 600;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	color: #7a5cbf;
	border: 1px solid #2a2233;
	border-radius: 5px;
	padding: 2px 6px;
`;

const RowControl = styled.div<{ disabled: boolean }>`
	flex-shrink: 0;
	display: flex;
	justify-content: flex-end;
	pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
`;

const ToggleTrack = styled.label<{ checked: boolean }>`
	position: relative;
	display: inline-block;
	width: 42px;
	height: 24px;
	flex-shrink: 0;
	cursor: pointer;
	border-radius: 24px;
	background-color: ${(props) => (props.checked ? "#9147ff" : "var(--settings-toggle-background)")};
	transition: background-color 0.2s ease;

	&:hover {
		background-color: ${(props) => (props.checked ? "#a06bff" : "var(--settings-toggle-hover)")};
	}

	&:has(input:focus-visible) {
		outline: 2px solid #9147ff;
		outline-offset: 2px;
	}
`;

const ToggleInput = styled.input`
	position: absolute;
	opacity: 0;
	width: 100%;
	height: 100%;
	margin: 0;
	cursor: pointer;
`;

const ToggleCircle = styled.span<{ checked: boolean }>`
	position: absolute;
	top: 3px;
	left: ${(props) => (props.checked ? "21px" : "3px")};
	width: 18px;
	height: 18px;
	background-color: #fff;
	border-radius: 50%;
	pointer-events: none;
	transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;

const TextInput = styled.input`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	color: var(--settings-text-primary);
	font-family: ${FONT};
	font-size: 12px;
	border-radius: 8px;
	padding: 9px 11px;
	min-width: 220px;
	outline: none;
	transition: border-color 0.15s ease;

	&::placeholder {
		color: var(--settings-input-placeholder);
	}

	&:focus {
		border-color: #9147ff;
	}
`;

const NumberField = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const NumberInput = styled(TextInput)`
	min-width: 90px;
	width: 90px;
	text-align: center;

	&::-webkit-inner-spin-button,
	&::-webkit-outer-spin-button {
		opacity: 1;
		height: 22px;
	}
`;

const Unit = styled.span`
	font-size: 11px;
	color: var(--settings-text-dim);
	min-width: 18px;
`;

const SliderField = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 220px;
`;

const Slider = styled.input`
	flex: 1;
	appearance: none;
	height: 4px;
	border-radius: 4px;
	background: var(--settings-control-border);
	outline: none;
	cursor: pointer;

	&::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #9147ff;
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	&::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	&::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: none;
		border-radius: 50%;
		background: #9147ff;
		cursor: pointer;
	}
`;

const SliderValue = styled.span`
	font-size: 11px;
	color: var(--settings-text-secondary);
	min-width: 42px;
	text-align: right;
	font-variant-numeric: tabular-nums;
`;

const FileInputContainer = styled.div`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	border-radius: 8px;
	padding: 4px;
	min-width: 220px;
	min-height: 38px;
	display: flex;
	align-items: center;
	transition: border-color 0.15s ease;

	&:hover {
		border-color: var(--settings-control-border);
	}
`;

const UploadTriggerLabel = styled.label`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	color: var(--settings-text);
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	padding: 5px;
	border-radius: 6px;
	transition: background-color 0.15s ease;

	svg {
		color: #9147ff;
	}

	&:hover {
		background: var(--settings-control-hover);
	}
`;

const FileStatus = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
	padding-left: 8px;
	color: var(--settings-text);
	font-size: 11px;

	svg {
		color: #9147ff;
		flex-shrink: 0;
	}
`;

const FileName = styled.span`
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const HiddenFileInput = styled.input`
	display: none;
`;

const RemoveFileButton = styled.button`
	background: transparent;
	border: none;
	color: var(--settings-text-faint);
	cursor: pointer;
	height: 28px;
	width: 28px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s ease;
	margin-left: auto;

	&:hover {
		background: rgba(255, 71, 87, 0.12);
		color: #ff4757;
	}
`;

const FileUploadError = styled.div`
	color: #ff4757;
	font-size: 11px;
	margin-top: 6px;
	padding: 6px 8px;
	background: rgba(255, 71, 87, 0.1);
	border-radius: 6px;
	border-left: 2px solid #ff4757;
`;

const Select = styled.select`
	background: var(--settings-control-background);
	padding: 9px 11px;
	border-radius: 8px;
	color: var(--settings-text);
	border: 1px solid var(--settings-control-border);
	font-family: ${FONT};
	font-size: 12px;
	cursor: pointer;
	min-width: 160px;
	outline: none;

	&:focus {
		border-color: #9147ff;
	}
`;

const RadioContainer = styled.div`
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	border-radius: 8px;
	padding: 3px;
`;

const RadioInput = styled.input`
	position: absolute;
	opacity: 0;
	pointer-events: none;
`;

const RadioLabel = styled.label<{ checked: boolean }>`
	background: ${(props) => (props.checked ? "#9147ff" : "transparent")};
	padding: 7px 12px;
	border-radius: 6px;
	font-size: 12px;
	color: ${(props) => (props.checked ? "var(--settings-text-primary)" : "var(--settings-text-muted)")};
	cursor: pointer;
	transition: background 0.15s ease, color 0.15s ease;

	&:hover {
		color: ${(props) => (props.checked ? "var(--settings-text-primary)" : "var(--settings-text)")};
	}
`;

const ArrayContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 340px;
`;

const ArrayItem = styled.div`
	display: flex;
	gap: 8px;
	align-items: center;
`;

const ArrayInput = styled(TextInput)`
	min-width: 0;
	flex: 1;
`;

const ArrayEmpty = styled.div`
	font-size: 11.5px;
	color: var(--settings-text-faint);
	padding: 4px 0;
`;

const GhostButton = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	background: transparent;
	border: 1px dashed var(--settings-control-border);
	color: var(--settings-text-secondary);
	padding: 8px 12px;
	border-radius: 8px;
	cursor: pointer;
	font-family: ${FONT};
	font-size: 12px;
	transition: all 0.15s ease;

	&:hover {
		border-color: #9147ff;
		color: #9147ff;
	}
`;

const RemoveButton = styled.button`
	background: transparent;
	border: 1px solid var(--settings-control-border);
	color: var(--settings-text-dim);
	width: 32px;
	height: 34px;
	flex-shrink: 0;
	border-radius: 8px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s ease;

	&:hover {
		border-color: rgba(255, 71, 87, 0.4);
		background: rgba(255, 71, 87, 0.1);
		color: #ff4757;
	}
`;

const RefreshBar = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	flex-shrink: 0;
	padding: 10px 16px;
	border-top: 1px solid var(--settings-divider);
	background: rgba(145, 71, 255, 0.06);
	color: var(--settings-text);
	font-size: 12px;
	position: relative;
	z-index: 2;

	svg {
		color: #9147ff;
		flex-shrink: 0;
	}
`;

const RefreshBarText = styled.span`
	flex: 1;
`;

const PrimaryButton = styled.button`
	background: #9147ff;
	border: none;
	color: white;
	font-family: ${FONT};
	font-size: 12px;
	font-weight: 500;
	padding: 7px 14px;
	border-radius: 7px;
	cursor: pointer;
	transition: background 0.15s ease;

	&:hover {
		background: #7f39e0;
	}
`;

const SecondaryButton = styled(PrimaryButton)`
	background: var(--settings-border);
	color: var(--settings-text);

	&:hover {
		background: var(--settings-control-border);
	}
`;

const NoResults = styled.div`
	padding: 60px 20px;
	text-align: center;
	color: var(--settings-text-faint);
	font-size: 13px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;

	svg {
		color: var(--settings-control-border);
	}
`;

const ModalOverlay = styled.div`
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.65);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10;
	backdrop-filter: blur(3px);
	padding: 20px;
`;

const ModalContent = styled.div`
	background-color: var(--settings-surface-raised);
	border-radius: 14px;
	border: 1px solid var(--settings-control-border);
	font-family: ${FONT} !important;
	padding: 22px;
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
	max-width: 460px;
	width: 100%;
`;

const ModalHeader = styled.h3`
	color: var(--settings-text-primary);
	margin: 0 0 10px;
	font-size: 15px;
	font-weight: 600;
`;

const ModalMessage = styled.p`
	color: var(--settings-text-secondary);
	font-size: 12.5px;
	margin: 0;
	line-height: 1.6;
`;

const ModalButtonContainer = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 20px;
`;

const icon = (paths: JSX.Element, size = 16) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		{paths}
	</svg>
);

const CloseIcon = (size?: number) =>
	icon(
		<>
			<path d="M18 6l-12 12" />
			<path d="M6 6l12 12" />
		</>,
		size,
	);

const SearchIcon = icon(
	<>
		<circle cx="11" cy="11" r="7" />
		<path d="M21 21l-4.3-4.3" />
	</>,
	14,
);

const RefreshIcon = icon(
	<>
		<path d="M20 11a8 8 0 1 0-2.3 5.7" />
		<path d="M20 4v7h-7" />
	</>,
	15,
);

const PlusIcon = icon(
	<>
		<path d="M12 5v14" />
		<path d="M5 12h14" />
	</>,
	14,
);

const CATEGORY_ICONS: Record<string, JSX.Element> = {
	general: icon(
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</>,
	),
	chat: icon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
	channel: icon(
		<>
			<rect x="2" y="7" width="20" height="15" rx="2" />
			<path d="M17 2l-5 5-5-5" />
		</>,
	),
	latency: icon(
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 3" />
		</>,
	),
	about: icon(
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 16v-5" />
			<path d="M12 8h.01" />
		</>,
	),
};

const FALLBACK_CATEGORY_ICON = icon(
	<>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 8v8" />
	</>,
);

function normalize(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");
}

function matchesQuery(text: string, query: string): boolean {
	const textTokens = normalize(text).split(/\s+/).filter(Boolean);
	const queryTokens = normalize(query).split(/\s+/).filter(Boolean);
	return queryTokens.every((qt) => textTokens.some((tt) => tt.includes(qt)));
}

type RenderGroup<T> = { kind: "card"; items: SettingDefinition<T>[] } | { kind: "panel"; item: SettingDefinition<T> };

function groupSettings<T>(settings: SettingDefinition<T>[]): RenderGroup<T>[] {
	const groups: RenderGroup<T>[] = [];
	for (const setting of settings) {
		if (setting.hideInfo) {
			groups.push({ kind: "panel", item: setting });
			continue;
		}
		const last = groups[groups.length - 1];
		if (last?.kind === "card") {
			last.items.push(setting);
			continue;
		}
		groups.push({ kind: "card", items: [setting] });
	}
	return groups;
}

const Settings = <T,>({
	logoSrc = "Logo.svg",
	platform,
	isOpen = true,
	categories,
	settingDefinitions,
	settings,
	onSettingsChange,
	onClose = () => {},
}: SettingsProps<T>) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
	const [pendingToggle, setPendingToggle] = useState<{
		key: keyof T;
		value: boolean;
		confirmationMessage?: string;
	} | null>(null);
	const [pendingArrayRemove, setPendingArrayRemove] = useState<{
		key: keyof T;
		index: number;
		itemTitle?: string;
		confirmationMessage?: string;
	} | null>(null);
	const [refreshPending, setRefreshPending] = useState<string[]>([]);
	const [fileUploadError, setFileUploadError] = useState<string | null>(null);

	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);
	const isSearching = searchQuery.trim().length > 0;

	const selectedCategoryId = activeCategoryId ?? sortedCategories[0]?.id ?? null;

	const matchCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const category of sortedCategories) {
			const matching = settingDefinitions.filter(
				(setting) => setting.categoryId === category.id && settingMatches(setting, category, searchQuery),
			);
			counts.set(category.id, matching.length);
		}
		return counts;
	}, [sortedCategories, settingDefinitions, searchQuery]);

	const visibleSections = useMemo(() => {
		const source = isSearching
			? sortedCategories.filter((category) => (matchCounts.get(category.id) ?? 0) > 0)
			: sortedCategories.filter((category) => category.id === selectedCategoryId);

		return source.map((category) => ({
			category,
			settings: settingDefinitions.filter(
				(setting) =>
					setting.categoryId === category.id && (!isSearching || settingMatches(setting, category, searchQuery)),
			),
		}));
	}, [isSearching, sortedCategories, matchCounts, selectedCategoryId, settingDefinitions, searchQuery]);

	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
			setPendingToggle(null);
			setPendingArrayRemove(null);
			setFileUploadError(null);
			return;
		}
		searchRef.current?.focus();
	}, [isOpen]);

	useEffect(() => {
		contentRef.current?.scrollTo({ top: 0 });
	}, [selectedCategoryId, isSearching]);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			if (pendingToggle) {
				setPendingToggle(null);
				return;
			}
			if (pendingArrayRemove) {
				setPendingArrayRemove(null);
				return;
			}
			if (searchQuery) {
				setSearchQuery("");
				return;
			}
			onClose();
		};
		document.addEventListener("keydown", handleKeyDown, true);
		return () => document.removeEventListener("keydown", handleKeyDown, true);
	}, [isOpen, pendingToggle, pendingArrayRemove, searchQuery, onClose]);

	const updateSetting = (key: keyof T, value: unknown) => {
		const newSettings = { ...settings, [key]: value };
		onSettingsChange(newSettings, key);
	};

	const updateArraySetting = (key: keyof T, index: number, value: unknown, action: "update" | "add" | "remove") => {
		const currentArray = (settings[key] as unknown[]) || [];
		let newArray: unknown[];

		switch (action) {
			case "update":
				newArray = currentArray.map((item, i) => (i === index ? value : item));
				break;
			case "add":
				newArray = [...currentArray, value];
				break;
			case "remove":
				newArray = currentArray.filter((_, i) => i !== index);
				break;
			default:
				return;
		}

		updateSetting(key, newArray);
	};

	const handleFileChange = (event: Event, setting: SettingDefinition<T>) => {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		setFileUploadError(null);

		if (setting.type === "file" && setting.validTypes && setting.validTypes.length > 0) {
			if (!setting.validTypes.includes(file.type)) {
				setFileUploadError("Invalid file type.");
				target.value = "";
				return;
			}
		}

		if (setting.type === "file" && setting.maxSizeBytes && setting.maxSizeBytes > 0) {
			if (file.size > setting.maxSizeBytes) {
				const maxSizeMB = (setting.maxSizeBytes / 1024 / 1024).toFixed(2);
				const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
				setFileUploadError(`File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB.`);
				target.value = "";
				return;
			}
		}

		const reader = new FileReader();
		reader.onload = (e) => {
			updateSetting(setting.id as keyof T, e.target?.result as string);
		};
		reader.onerror = () => {
			setFileUploadError("Failed to read the selected file. Please try again.");
		};
		reader.readAsDataURL(file);
		target.value = "";
	};

	const clearFile = (settingId: keyof T) => {
		updateSetting(settingId, "");
		setFileUploadError(null);
	};

	const handleToggleChange = (event: Event, setting: SettingDefinition<T>, checked: boolean) => {
		event.stopPropagation();

		if (setting.type === "toggle" && setting.confirmOnEnable && checked) {
			setPendingToggle({
				key: setting.id as keyof T,
				value: checked,
				confirmationMessage: setting.confirmationMessage ?? "Are you sure you want to enable this setting?",
			});
			return;
		}

		const wasEnabled = settings[setting.id as keyof T] === true;
		updateSetting(setting.id as keyof T, checked);

		if (setting.requiresRefreshToDisable && wasEnabled && !checked) {
			setRefreshPending((current) =>
				current.includes(setting.id as string) ? current : [...current, setting.id as string],
			);
		} else if (checked) {
			setRefreshPending((current) => current.filter((id) => id !== setting.id));
		}
	};

	const confirmToggle = () => {
		if (!pendingToggle) return;
		updateSetting(pendingToggle.key, pendingToggle.value);
		setPendingToggle(null);
	};

	const handleArrayRemove = (setting: SettingDefinition<T>, index: number, item: unknown) => {
		if (setting.type === "array" && setting.confirmOnRemove) {
			const itemTitle =
				typeof item === "object" && item !== null && "title" in item && typeof item.title === "string"
					? item.title
					: "";
			setPendingArrayRemove({
				key: setting.id as keyof T,
				index,
				itemTitle,
				confirmationMessage: setting.confirmationMessage,
			});
			return;
		}
		updateArraySetting(setting.id as keyof T, index, null, "remove");
	};

	const confirmArrayRemove = () => {
		if (!pendingArrayRemove) return;
		updateArraySetting(pendingArrayRemove.key, pendingArrayRemove.index, null, "remove");
		setPendingArrayRemove(null);
	};

	const isDisabled = (setting: SettingDefinition<T>): boolean => {
		if (!setting.dependsOn) return false;
		const expected = setting.dependsOn.value ?? true;
		return settings[setting.dependsOn.key as keyof T] !== expected;
	};

	const selectCategory = (categoryId: string) => {
		setSearchQuery("");
		setActiveCategoryId(categoryId);
	};

	const renderSettingControl = (setting: SettingDefinition<T>) => {
		const value = settings[setting.id as keyof T];

		switch (setting.type) {
			case "toggle": {
				return (
					<ToggleTrack checked={value as boolean}>
						<ToggleInput
							type="checkbox"
							id={setting.id as string}
							checked={value as boolean}
							onChange={(e) => handleToggleChange(e, setting, (e.target as HTMLInputElement).checked)}
						/>
						<ToggleCircle checked={value as boolean} />
					</ToggleTrack>
				);
			}
			case "input": {
				return (
					<TextInput
						value={(value as string) || ""}
						placeholder={setting.placeholder}
						onChange={(e) => updateSetting(setting.id as keyof T, (e.target as HTMLInputElement).value)}
					/>
				);
			}
			case "number": {
				if (setting.slider) {
					return (
						<SliderField>
							<Slider
								type="range"
								value={(value as number) ?? 0}
								min={setting.min ?? 0}
								max={setting.max ?? 100}
								step={setting.step ?? 1}
								onInput={(e) => updateSetting(setting.id as keyof T, Number((e.target as HTMLInputElement).value))}
							/>
							<SliderValue>
								{(value as number) ?? 0}
								{setting.unit ?? ""}
							</SliderValue>
						</SliderField>
					);
				}
				return (
					<NumberField>
						<NumberInput
							type="number"
							value={(value as number) ?? 0}
							min={setting.min}
							max={setting.max}
							step={setting.step}
							onChange={(e) => updateSetting(setting.id as keyof T, Number((e.target as HTMLInputElement).value))}
						/>
						{setting.unit ? <Unit>{setting.unit}</Unit> : null}
					</NumberField>
				);
			}
			case "select": {
				return (
					<Select
						value={value as string}
						onChange={(e) => updateSetting(setting.id as keyof T, (e.target as HTMLSelectElement).value)}
					>
						{setting.options?.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				);
			}
			case "radio": {
				return (
					<RadioContainer>
						{setting.options?.map((option) => (
							<div key={option.value}>
								<RadioInput
									type="radio"
									name={setting.id as string}
									id={`${setting.id as string}-${option.value}`}
									checked={value === option.value}
									onChange={() => updateSetting(setting.id as keyof T, option.value)}
								/>
								<RadioLabel htmlFor={`${setting.id as string}-${option.value}`} checked={value === option.value}>
									{option.label}
								</RadioLabel>
							</div>
						))}
					</RadioContainer>
				);
			}
			case "array": {
				const arrayValue = (value as unknown[]) || [];
				const fields = setting.arrayItemFields || [{ name: "page", placeholder: "Enter value..." }];

				return (
					<ArrayContainer>
						{arrayValue.length === 0 ? <ArrayEmpty>No items yet.</ArrayEmpty> : null}
						{arrayValue.map((item, index) => (
							<ArrayItem key={`array-item-${setting.id as string}-${index}`}>
								{fields.map((field: { name: string; placeholder: string }) => (
									<ArrayInput
										key={`${setting.id as string}-${index}-${field.name}`}
										value={
											typeof item === "object" && item !== null
												? (item as Record<string, string>)[field.name] || ""
												: String(item)
										}
										placeholder={field.placeholder}
										onChange={(e) => {
											const newValue =
												typeof item === "object" && item !== null
													? {
															...(item as Record<string, unknown>),
															[field.name]: (e.target as HTMLInputElement).value,
														}
													: { [field.name]: (e.target as HTMLInputElement).value };
											updateArraySetting(setting.id as keyof T, index, newValue, "update");
										}}
									/>
								))}
								<RemoveButton
									title="Remove"
									aria-label="Remove"
									onClick={() => handleArrayRemove(setting, index, item)}
								>
									{CloseIcon(14)}
								</RemoveButton>
							</ArrayItem>
						))}
						<GhostButton
							onClick={() => {
								const newValue = fields.reduce(
									(acc: Record<string, string>, field: { name: string; placeholder: string }) => {
										acc[field.name] = "";
										return acc;
									},
									{},
								);
								updateArraySetting(setting.id as keyof T, arrayValue.length, newValue, "add");
							}}
						>
							{PlusIcon}
							Add item
						</GhostButton>
					</ArrayContainer>
				);
			}
			case "text": {
				try {
					const Component = setting.content;
					return <Component />;
				} catch (e) {
					logger.error("Enhancer Error when rendering component", e);
				}
				return null;
			}
			case "file": {
				const fileValue = value as string;
				const hasFile = fileValue && fileValue.length > 0;

				return (
					<div>
						<FileInputContainer>
							{hasFile ? (
								<>
									<FileStatus>
										{icon(
											<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
										)}
										<FileName>File uploaded</FileName>
									</FileStatus>
									<RemoveFileButton onClick={() => clearFile(setting.id as keyof T)} title="Remove file">
										{CloseIcon(14)}
									</RemoveFileButton>
								</>
							) : (
								<UploadTriggerLabel htmlFor={`file-${setting.id as string}`}>
									{icon(
										<>
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
											<polyline points="17 8 12 3 7 8" />
											<line x1="12" y1="3" x2="12" y2="15" />
										</>,
									)}
									Upload file
									<HiddenFileInput
										id={`file-${setting.id as string}`}
										type="file"
										accept={setting.accept || "audio/*"}
										onChange={(e) => handleFileChange(e, setting)}
									/>
								</UploadTriggerLabel>
							)}
						</FileInputContainer>
						{fileUploadError && <FileUploadError>{fileUploadError}</FileUploadError>}
					</div>
				);
			}
			default:
				return null;
		}
	};

	const totalMatches = isSearching ? visibleSections.reduce((total, section) => total + section.settings.length, 0) : 0;

	return (
		<>
			<SettingsOverlayBackground onClick={onClose} />
			{/* biome-ignore lint/a11y/useSemanticElements: native <dialog> renders in the top layer and breaks styling inside the injected overlay */}
			<SettingsContainer role="dialog" aria-modal="true" aria-label="Enhancer settings">
				<Gradient />
				<Header>
					<Brand>
						<LogoContainer>
							<Logo src={logoSrc} alt="Enhancer" />
						</LogoContainer>
						<BrandText>
							<BrandName>Enhancer</BrandName>
							<BrandMeta>{platform ? `${platform} settings` : "Settings"}</BrandMeta>
						</BrandText>
					</Brand>
					<HeaderSpacer />
					<SearchContainer>
						{SearchIcon}
						<SearchInput
							ref={searchRef}
							type="text"
							placeholder="Search settings..."
							value={searchQuery}
							onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
						/>
						{searchQuery && (
							<IconButton onClick={() => setSearchQuery("")} title="Clear search" aria-label="Clear search">
								{CloseIcon(14)}
							</IconButton>
						)}
					</SearchContainer>
					<CloseButton onClick={onClose} title="Close" aria-label="Close settings">
						{CloseIcon(18)}
					</CloseButton>
				</Header>
				<Body>
					<Sidebar>
						{sortedCategories.map((category) => {
							const count = matchCounts.get(category.id) ?? 0;
							return (
								<NavItem
									key={category.id}
									active={!isSearching && category.id === selectedCategoryId}
									dimmed={isSearching && count === 0}
									onClick={() => selectCategory(category.id)}
								>
									{CATEGORY_ICONS[category.id] ?? FALLBACK_CATEGORY_ICON}
									<NavLabel>{category.title}</NavLabel>
									{isSearching && count > 0 ? <NavCount>{count}</NavCount> : null}
								</NavItem>
							);
						})}
						<SidebarFooter>
							<span>Enhancer</span>
							<span>v{__version__}</span>
						</SidebarFooter>
					</Sidebar>
					<Content ref={contentRef}>
						{isSearching && totalMatches === 0 ? (
							<NoResults>
								{icon(
									<>
										<circle cx="11" cy="11" r="7" />
										<path d="M21 21l-4.3-4.3" />
									</>,
									28,
								)}
								No settings found matching "{searchQuery}"
							</NoResults>
						) : (
							visibleSections.map((section) => (
								<Section key={section.category.id}>
									<SectionTitle>{section.category.title}</SectionTitle>
									{groupSettings(section.settings).map((group, groupIndex) =>
										group.kind === "panel" ? (
											<Panel key={`panel-${group.item.id as string}`}>{renderSettingControl(group.item)}</Panel>
										) : (
											<Card key={`card-${section.category.id}-${groupIndex}`}>
												{group.items.map((setting) => {
													const disabled = isDisabled(setting);
													return (
														<Row
															key={`setting-${setting.id as string}`}
															disabled={disabled}
															nested={Boolean(setting.dependsOn)}
														>
															<RowInfo>
																<RowTitle>
																	{setting.title}
																	{isSearching ? <CategoryTag>{section.category.title}</CategoryTag> : null}
																</RowTitle>
																<RowDescription>{setting.description}</RowDescription>
															</RowInfo>
															<RowControl disabled={disabled}>{renderSettingControl(setting)}</RowControl>
														</Row>
													);
												})}
											</Card>
										),
									)}
								</Section>
							))
						)}
					</Content>
				</Body>
				{refreshPending.length > 0 && (
					<RefreshBar>
						{RefreshIcon}
						<RefreshBarText>Some of your changes need a page refresh to fully take effect.</RefreshBarText>
						<SecondaryButton onClick={() => setRefreshPending([])}>Dismiss</SecondaryButton>
						<PrimaryButton onClick={() => window.location.reload()}>Reload page</PrimaryButton>
					</RefreshBar>
				)}
				{pendingToggle && (
					<ModalOverlay onClick={() => setPendingToggle(null)}>
						<ModalContent onClick={(e) => e.stopPropagation()}>
							<ModalHeader>Confirm action</ModalHeader>
							<ModalMessage>
								{pendingToggle.confirmationMessage || "Are you sure you want to enable this setting?"}
							</ModalMessage>
							<ModalButtonContainer>
								<SecondaryButton onClick={() => setPendingToggle(null)}>Cancel</SecondaryButton>
								<PrimaryButton onClick={confirmToggle}>Confirm</PrimaryButton>
							</ModalButtonContainer>
						</ModalContent>
					</ModalOverlay>
				)}
				{pendingArrayRemove && (
					<ModalOverlay onClick={() => setPendingArrayRemove(null)}>
						<ModalContent onClick={(e) => e.stopPropagation()}>
							<ModalHeader>Confirm removal</ModalHeader>
							<ModalMessage>
								{pendingArrayRemove.confirmationMessage ||
									(pendingArrayRemove.itemTitle
										? `Are you sure you want to remove "${pendingArrayRemove.itemTitle}"?`
										: "Are you sure you want to remove this item?")}
							</ModalMessage>
							<ModalButtonContainer>
								<SecondaryButton onClick={() => setPendingArrayRemove(null)}>Cancel</SecondaryButton>
								<PrimaryButton onClick={confirmArrayRemove}>Remove</PrimaryButton>
							</ModalButtonContainer>
						</ModalContent>
					</ModalOverlay>
				)}
			</SettingsContainer>
		</>
	);
};

function settingMatches<T>(setting: SettingDefinition<T>, category: SettingCategory, query: string): boolean {
	if (!query.trim()) return true;
	const settingText = [setting.title, setting.description, String(setting.id), ...(setting.tags || [])].join(" ");
	const categoryText = [category.title, ...(category.tags || [])].join(" ");
	return matchesQuery(settingText, query) || matchesQuery(categoryText, query);
}

export default Settings;

const SettingsOverlayBackground = styled.div`
	position: absolute;
	inset: 0;
	z-index: -1;
`;

export const SettingsOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background: rgba(0, 0, 0, 0.8);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10000;
	backdrop-filter: blur(4px);
`;
