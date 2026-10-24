import { EXTENSION_NAME } from "$shared/extension.constants.ts";
import { Logger } from "$shared/logger/logger.ts";
import type {
	ArraySettingDefinition,
	PairSettingDefinition,
	SettingCategory,
	SettingDefinition,
	SettingsProps,
} from "$types/shared/components/settings.component.types.ts";
import { Fragment, type JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled from "styled-components";

const logger = new Logger({ context: "settings-ui" });

const FONT = `"Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace`;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const ACCENT_GRADIENT = "linear-gradient(135deg, #a873ff, #7c3aed)";

const SettingsContainer = styled.div`
	--settings-background: #0e0e10;
	--settings-rail: #0e0e10;
	--settings-surface: #151517;
	--settings-surface-raised: #1c1c1f;
	--settings-surface-hover: #252528;
	--settings-well: #0a0a0b;
	--settings-border: #222225;
	--settings-divider: #1f1f22;
	--settings-divider-subtle: #1f1f22;
	--settings-control-background: #1c1c1f;
	--settings-control-border: #2a2a2e;
	--settings-control-hover: #252528;
	--settings-toggle-background: #2a2a2e;
	--settings-toggle-hover: #333338;
	--settings-toggle-knob: #d4d4d8;
	--settings-text-primary: #f4f4f5;
	--settings-text-strong: #f4f4f5;
	--settings-text: #d4d4d8;
	--settings-text-secondary: #b4b4bb;
	--settings-text-muted: #85858e;
	--settings-text-dim: #85858e;
	--settings-text-faint: #5a5a62;
	--settings-input-placeholder: #5a5a62;
	--settings-accent: #9147ff;
	--settings-accent-hover: #a970ff;
	--settings-accent-soft: rgba(145, 71, 255, 0.14);
	--settings-danger: #ff5c6c;
	--settings-sheen: rgba(255, 255, 255, 0.035);
	--settings-highlight: rgba(255, 255, 255, 0.06);
	--settings-glow: rgba(145, 71, 255, 0.16);
	--settings-shadow: rgba(0, 0, 0, 0.7);

	html.tw-root--theme-light & {
		--settings-background: #f7f7f8;
		--settings-rail: #f0f0f2;
		--settings-surface: #ffffff;
		--settings-surface-raised: #ffffff;
		--settings-surface-hover: #ececef;
		--settings-well: #ececef;
		--settings-border: #dedee3;
		--settings-divider: #e5e5e7;
		--settings-divider-subtle: #e5e5e7;
		--settings-control-background: #ffffff;
		--settings-control-border: #cfcfd5;
		--settings-control-hover: #e5e5e7;
		--settings-toggle-background: #c4c4c9;
		--settings-toggle-hover: #b5b5bb;
		--settings-toggle-knob: #ffffff;
		--settings-text-primary: #0e0e10;
		--settings-text-strong: #18181b;
		--settings-text: #2f2f35;
		--settings-text-secondary: #53535f;
		--settings-text-muted: #6e6e78;
		--settings-text-dim: #6e6e78;
		--settings-text-faint: #878791;
		--settings-input-placeholder: #8f8f99;
		--settings-sheen: rgba(255, 255, 255, 0);
		--settings-highlight: rgba(255, 255, 255, 0);
		--settings-glow: rgba(145, 71, 255, 0.1);
		--settings-shadow: rgba(0, 0, 0, 0.25);
	}

	display: grid;
	grid-template-columns: 248px minmax(0, 1fr);
	width: min(1000px, 94vw);
	height: min(680px, 86vh);
	background-color: var(--settings-background);
	border-radius: 16px;
	box-shadow:
		0 0 0 1px var(--settings-border),
		0 40px 100px var(--settings-shadow),
		0 0 120px rgba(145, 71, 255, 0.08);
	position: relative;
	overflow: clip;
	font-family: ${FONT} !important;
	color: var(--settings-text-primary);
	-webkit-font-smoothing: antialiased;

	* {
		box-sizing: border-box;
	}
`;

const Rail = styled.nav`
	display: flex;
	flex-direction: column;
	min-height: 0;
	gap: 4px;
	padding: 12px;
	border-right: 1px solid var(--settings-divider);
	background: linear-gradient(180deg, rgba(145, 71, 255, 0.07), transparent 220px), var(--settings-rail);
`;

const SearchContainer = styled.label`
	display: flex;
	align-items: center;
	gap: 8px;
	height: 34px;
	margin: 6px 0 10px;
	padding: 0 8px 0 10px;
	flex-shrink: 0;
	border-radius: 9px;
	background: linear-gradient(180deg, var(--settings-sheen), transparent), var(--settings-surface);
	box-shadow: inset 0 0 0 1px var(--settings-border);
	color: var(--settings-text-faint);
	cursor: text;
	transition:
		box-shadow 0.15s ${EASE},
		color 0.15s ${EASE};

	&:focus-within {
		box-shadow: inset 0 0 0 1px var(--settings-control-border);
		color: var(--settings-text-secondary);
	}
`;

const SearchInput = styled.input`
	flex: 1;
	min-width: 0;
	height: 100%;
	padding: 0;
	border: none;
	outline: none;
	background: none;
	color: var(--settings-text-primary);
	font-family: ${FONT};
	font-size: 13px;

	&::placeholder {
		color: var(--settings-input-placeholder);
	}
`;

const Kbd = styled.kbd`
	padding: 3px 5px;
	border-radius: 5px;
	background: var(--settings-surface-raised);
	color: var(--settings-text-muted);
	font-family: ${MONO};
	font-size: 11px;
	line-height: 1;
`;

const IconButton = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 22px;
	height: 22px;
	padding: 0;
	border: none;
	border-radius: 5px;
	background: none;
	color: var(--settings-text-muted);
	cursor: pointer;
	transition:
		color 0.15s ${EASE},
		background 0.15s ${EASE};

	&:hover {
		color: var(--settings-text-primary);
	}
`;

const NavList = styled.div`
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: 1px;
	overflow-y: auto;
	scrollbar-width: none;
`;

const NavSeparator = styled.div`
	flex-shrink: 0;
	height: 1px;
	margin: 8px 10px;
	background: var(--settings-divider);
`;

const NavItem = styled.button<{ $active: boolean; $dimmed: boolean }>`
	display: flex;
	align-items: center;
	flex-shrink: 0;
	gap: 11px;
	width: 100%;
	height: 34px;
	padding: 0 10px;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	text-align: left;
	font-family: ${FONT};
	font-size: 14px;
	font-weight: ${(props) => (props.$active ? 500 : 450)};
	color: ${(props) =>
		props.$active
			? "var(--settings-text-primary)"
			: props.$dimmed
				? "var(--settings-text-faint)"
				: "var(--settings-text-secondary)"};
	background: ${(props) =>
		props.$active ? "linear-gradient(90deg, rgba(145, 71, 255, 0.2), rgba(145, 71, 255, 0.04))" : "transparent"};
	box-shadow: ${(props) => (props.$active ? "inset 0 0 0 1px rgba(145, 71, 255, 0.18)" : "none")};
	transition:
		background 0.12s ${EASE},
		color 0.12s ${EASE};

	svg {
		flex-shrink: 0;
		color: ${(props) =>
			props.$active ? "var(--settings-accent-hover)" : props.$dimmed ? "currentColor" : "var(--settings-text-faint)"};
	}

	&:hover {
		color: var(--settings-text-primary);
		${(props) => (props.$active ? "" : "background: var(--settings-surface);")}
	}

	&:hover svg {
		${(props) => (props.$active ? "" : "color: var(--settings-text-muted);")}
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
	font-family: ${MONO};
	font-size: 11px;
	color: var(--settings-text-secondary);
`;

const RailFooter = styled.div`
	display: flex;
	align-items: center;
	flex-shrink: 0;
	gap: 9px;
	margin-top: 6px;
	padding: 12px 8px 0;
	border-top: 1px solid var(--settings-divider);
`;

const FooterLogo = styled.img`
	display: block;
	width: 20px;
	height: 20px;
	border-radius: 5px;
`;

const FooterName = styled.span`
	flex: 1;
	min-width: 0;
	height: 20px;
	line-height: 20px;
	font-size: 13px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--settings-text-primary);
`;

const FooterVersion = styled.span`
	height: 20px;
	line-height: 20px;
	font-family: ${MONO};
	font-size: 12px;
	color: var(--settings-text-faint);
`;

const Main = styled.section`
	position: relative;
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	overflow: clip;
`;

const MainGlow = styled.div`
	position: absolute;
	top: -220px;
	left: 50%;
	width: 760px;
	height: 440px;
	transform: translateX(-50%);
	background: radial-gradient(closest-side, var(--settings-glow), rgba(145, 71, 255, 0.05) 55%, transparent);
	pointer-events: none;
`;

const CloseButton = styled(IconButton)`
	position: absolute;
	top: 16px;
	right: 16px;
	z-index: 5;
	width: 32px;
	height: 32px;
	border-radius: 8px;

	&:hover {
		background: var(--settings-surface-raised);
	}
`;

const Content = styled.div`
	position: relative;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	scrollbar-width: thin;
	scrollbar-color: var(--settings-surface-hover) transparent;

	&::-webkit-scrollbar {
		width: 10px;
	}

	&::-webkit-scrollbar-track {
		background: transparent;
	}

	&::-webkit-scrollbar-thumb {
		background: var(--settings-surface-hover);
		border-radius: 10px;
		border: 3px solid var(--settings-background);
	}
`;

const Page = styled.div`
	flex-shrink: 0;
	width: 100%;
	max-width: 860px;
	margin: 0 auto;
	padding: 32px 40px 56px;
`;

const BarePage = styled.div`
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 100%;

	& > * {
		flex: 1;
	}
`;

const PageTitle = styled.h1`
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

const Section = styled.section`
	& + & {
		margin-top: 32px;
	}
`;

const SectionTitle = styled.h2`
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0 0 10px;
	font-size: 14px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--settings-text-primary);

	&::before {
		content: "";
		width: 3px;
		height: 12px;
		border-radius: 2px;
		background: linear-gradient(180deg, var(--settings-accent-hover), var(--settings-accent));
	}
`;

const Panel = styled.div`
	margin: 12px 0 0;

	&:first-child {
		margin-top: 0;
	}
`;

const Card = styled.div`
	border-radius: 12px;
	overflow: hidden;
	background: linear-gradient(180deg, var(--settings-sheen), transparent 140px), var(--settings-surface);
	box-shadow:
		inset 0 0 0 1px var(--settings-border),
		inset 0 1px 0 var(--settings-highlight);

	& + &,
	${Panel} + & {
		margin-top: 12px;
	}
`;

const Item = styled.div`
	& + & {
		border-top: 1px solid var(--settings-divider);
	}
`;

const RowInfo = styled.div`
	flex: 1;
	min-width: 0;
`;

const RowTitle = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: -0.005em;
	color: var(--settings-text-strong);
`;

const RowDescription = styled.div`
	margin-top: 3px;
	font-size: 13px;
	line-height: 1.45;
	color: var(--settings-text-muted);
	text-wrap: pretty;
`;

const RowHint = styled.div`
	margin-top: 5px;
	font-size: 12.5px;
	line-height: 1.45;
	color: var(--settings-text-faint);
	text-wrap: pretty;
`;

const RefreshMark = styled.span`
	display: inline-flex;
	color: var(--settings-text-faint);
	cursor: help;
`;

const Row = styled.div<{ $disabled: boolean; $child: boolean; $stack?: boolean }>`
	display: flex;
	flex-direction: ${(props) => (props.$stack ? "column" : "row")};
	align-items: ${(props) => (props.$stack ? "stretch" : "center")};
	justify-content: space-between;
	gap: ${(props) => (props.$stack ? "14px" : "24px")};
	padding: ${(props) => (props.$child ? "12px 18px" : "14px 18px")};
	min-height: ${(props) => (props.$child ? "0" : "60px")};
	opacity: ${(props) => (props.$disabled ? 0.4 : 1)};
	transition: opacity 0.15s ${EASE};

	${(props) =>
		props.$child
			? `
		border-top: 1px solid var(--settings-divider);

		${RowTitle} {
			font-weight: 450;
			color: var(--settings-text-secondary);
		}

		${RowDescription} {
			font-size: 12.5px;
		}
	`
			: ""}
`;

const Children = styled.div<{ $open: boolean }>`
	display: grid;
	grid-template-rows: ${(props) => (props.$open ? "1fr" : "0fr")};
	transition: grid-template-rows 0.24s ${EASE};

	& > div {
		min-height: 0;
		overflow: hidden;
	}
`;

const RowControl = styled.div<{ $disabled: boolean }>`
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex-shrink: 0;
	gap: 8px;
	pointer-events: ${(props) => (props.$disabled ? "none" : "auto")};
`;

const ToggleTrack = styled.label<{ $checked: boolean }>`
	position: relative;
	display: inline-block;
	flex-shrink: 0;
	width: 36px;
	height: 21px;
	border-radius: 999px;
	cursor: pointer;
	background: ${(props) => (props.$checked ? ACCENT_GRADIENT : "var(--settings-toggle-background)")};
	box-shadow: ${(props) => (props.$checked ? "0 0 14px rgba(145, 71, 255, 0.35)" : "none")};
	transition:
		background 0.2s ${EASE},
		box-shadow 0.2s ${EASE};

	&:hover {
		${(props) => (props.$checked ? "" : "background: var(--settings-toggle-hover);")}
	}

	&:has(input:focus-visible) {
		outline: 2px solid var(--settings-accent);
		outline-offset: 2px;
	}
`;

const ToggleInput = styled.input`
	position: absolute;
	width: 100%;
	height: 100%;
	margin: 0;
	opacity: 0;
	cursor: pointer;
`;

const ToggleKnob = styled.span<{ $checked: boolean }>`
	position: absolute;
	top: 2.5px;
	left: 2.5px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: ${(props) => (props.$checked ? "#ffffff" : "var(--settings-toggle-knob)")};
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
	pointer-events: none;
	transform: translateX(${(props) => (props.$checked ? "15px" : "0")});
	transition:
		transform 0.22s ${EASE},
		background 0.2s ${EASE};
`;

const controlStyles = `
	height: 34px;
	padding: 0 11px;
	border: none;
	border-radius: 8px;
	outline: none;
	background-color: var(--settings-control-background);
	box-shadow: inset 0 0 0 1px var(--settings-border);
	color: var(--settings-text-primary);
	font-family: ${FONT};
	font-size: 13px;
	transition: box-shadow 0.15s ${EASE};

	&:hover {
		box-shadow: inset 0 0 0 1px var(--settings-control-border);
	}

	&:focus {
		box-shadow: inset 0 0 0 1px var(--settings-accent);
	}

	&[aria-invalid="true"] {
		box-shadow: inset 0 0 0 1px var(--settings-danger);
	}
`;

const TextInput = styled.input`
	${controlStyles}
	min-width: 220px;

	&::placeholder {
		color: var(--settings-input-placeholder);
	}
`;

const NumberField = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const NumberInput = styled(TextInput)`
	width: 84px;
	min-width: 84px;
	text-align: right;
	font-family: ${MONO};
	font-size: 12.5px;
	font-variant-numeric: tabular-nums;
`;

const Unit = styled.span`
	min-width: 12px;
	font-size: 13px;
	color: var(--settings-text-muted);
`;

const SliderField = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 220px;
`;

const Slider = styled.input`
	flex: 1;
	height: 4px;
	border-radius: 4px;
	outline: none;
	appearance: none;
	background: var(--settings-control-border);
	cursor: pointer;

	&::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--settings-accent);
		cursor: pointer;
		transition: transform 0.15s ${EASE};
	}

	&::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	&::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: none;
		border-radius: 50%;
		background: var(--settings-accent);
		cursor: pointer;
	}
`;

const SliderValue = styled.span`
	min-width: 40px;
	text-align: right;
	font-family: ${MONO};
	font-size: 12.5px;
	color: var(--settings-text-secondary);
	font-variant-numeric: tabular-nums;
`;

const FileInputContainer = styled.div`
	display: flex;
	align-items: center;
	min-width: 220px;
	min-height: 34px;
	padding: 2px;
	border-radius: 8px;
	background: var(--settings-control-background);
	box-shadow: inset 0 0 0 1px var(--settings-border);
`;

const UploadTriggerLabel = styled.label`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	padding: 6px;
	border-radius: 6px;
	color: var(--settings-text);
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s ${EASE};

	svg {
		color: var(--settings-text-muted);
	}

	&:hover {
		background: var(--settings-control-hover);
	}
`;

const FileStatus = styled.div`
	display: flex;
	align-items: center;
	flex: 1;
	min-width: 0;
	gap: 8px;
	padding-left: 9px;
	color: var(--settings-text);
	font-size: 13px;

	svg {
		flex-shrink: 0;
		color: var(--settings-text-muted);
	}
`;

const FileName = styled.span`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const HiddenFileInput = styled.input`
	display: none;
`;

const RemoveFileButton = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	margin-left: auto;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--settings-text-faint);
	cursor: pointer;
	transition: all 0.15s ${EASE};

	&:hover {
		background: rgba(255, 92, 108, 0.12);
		color: var(--settings-danger);
	}
`;

const FileUploadError = styled.div`
	margin-top: 6px;
	font-size: 12.5px;
	color: var(--settings-danger);
`;

const Select = styled.select`
	${controlStyles}
	min-width: 160px;
	padding-right: 30px;
	appearance: none;
	cursor: pointer;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2385858e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 10px center;

	option {
		background: var(--settings-surface-raised);
		color: var(--settings-text-primary);
	}
`;

const RadioContainer = styled.div`
	display: inline-flex;
	flex-wrap: wrap;
	gap: 2px;
	padding: 3px;
	border-radius: 9px;
	background: var(--settings-well);
	box-shadow: inset 0 0 0 1px var(--settings-border);
`;

const RadioInput = styled.input`
	position: absolute;
	opacity: 0;
	pointer-events: none;
`;

const RadioLabel = styled.label<{ $checked: boolean }>`
	display: block;
	padding: 6px 12px;
	border-radius: 6px;
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	background: ${(props) => (props.$checked ? "var(--settings-surface-hover)" : "transparent")};
	color: ${(props) => (props.$checked ? "var(--settings-text-primary)" : "var(--settings-text-muted)")};
	transition:
		background 0.15s ${EASE},
		color 0.15s ${EASE};

	&:hover {
		color: var(--settings-text-primary);
	}
`;

const ArrayEmpty = styled.div`
	padding: 4px 0;
	font-size: 13px;
	color: var(--settings-text-faint);
`;

const RemoveButton = styled.button`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 34px;
	height: 34px;
	border: none;
	border-radius: 8px;
	background: transparent;
	color: var(--settings-text-muted);
	cursor: pointer;
	transition: all 0.15s ${EASE};

	&:hover {
		background: rgba(255, 92, 108, 0.1);
		color: var(--settings-danger);
	}
`;

const Button = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 7px;
	height: 34px;
	padding: 0 14px;
	border: none;
	border-radius: 8px;
	font-family: ${FONT};
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;
	transition:
		background 0.12s ${EASE},
		color 0.12s ${EASE},
		transform 0.12s ${EASE};

	&:active {
		transform: scale(0.97);
	}
`;

const PrimaryButton = styled(Button)`
	background: var(--settings-text-primary);
	color: var(--settings-background);

	&:hover {
		opacity: 0.92;
	}
`;

const BrandButton = styled(Button)`
	background: var(--settings-accent);
	color: #ffffff;

	&:hover {
		background: var(--settings-accent-hover);
	}
`;

const DangerButton = styled(Button)`
	background: var(--settings-danger);
	color: #ffffff;

	&:hover {
		background: #ff7482;
	}
`;

const SecondaryButton = styled(Button)`
	background: var(--settings-surface-raised);
	color: var(--settings-text-primary);

	&:hover {
		background: var(--settings-surface-hover);
	}
`;

const QuietButton = styled(Button)`
	padding: 0 10px;
	background: transparent;
	color: var(--settings-text-muted);

	&:hover {
		background: var(--settings-surface-hover);
		color: var(--settings-text-primary);
	}
`;

const PreviewButton = styled.button`
	display: grid;
	place-items: center;
	flex-shrink: 0;
	width: 30px;
	height: 30px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: var(--settings-surface-raised);
	box-shadow: inset 0 0 0 1px var(--settings-control-border);
	color: var(--settings-text-primary);
	cursor: pointer;
	transition:
		background 0.15s ${EASE},
		transform 0.12s ${EASE};

	&:hover {
		background: var(--settings-accent);
	}

	&:active {
		transform: scale(0.94);
	}
`;

const ControlColumn = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 6px;
`;

const PairSeparator = styled.span`
	color: var(--settings-text-faint);
	font-size: 13px;
`;

const FieldError = styled.div`
	max-width: 320px;
	font-size: 12.5px;
	line-height: 1.4;
	text-align: right;
	color: var(--settings-danger);
`;

const ChoiceButton = styled.button<{ $checked: boolean }>`
	padding: 6px 12px;
	border: none;
	border-radius: 6px;
	font-family: ${FONT};
	font-size: 13px;
	font-weight: 500;
	cursor: pointer;
	background: ${(props) => (props.$checked ? "var(--settings-surface-hover)" : "transparent")};
	color: ${(props) => (props.$checked ? "var(--settings-text-primary)" : "var(--settings-text-muted)")};
	transition:
		background 0.15s ${EASE},
		color 0.15s ${EASE};

	&:hover {
		color: var(--settings-text-primary);
	}
`;

const ListContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 100%;
`;

const ListItem = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

const ListItemRow = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const ListInput = styled(TextInput)<{ $narrow: boolean }>`
	min-width: 0;
	flex: ${(props) => (props.$narrow ? "0 1 160px" : "1 1 0")};
	${(props) => (props.$narrow ? "" : `font-family: ${MONO}; font-size: 12.5px;`)}
`;

const ListItemError = styled.div`
	padding-left: 64px;
	font-size: 12.5px;
	color: var(--settings-danger);
`;

const MoveButtons = styled.div`
	display: flex;
	gap: 2px;
`;

const MoveButton = styled(IconButton)`
	width: 26px;
	height: 26px;

	&:hover:not(:disabled) {
		background: var(--settings-surface-raised);
	}

	&:disabled {
		opacity: 0.3;
		cursor: default;
	}
`;

const ListFooter = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 4px;
`;

const ListFooterSpacer = styled.span`
	flex: 1;
`;

const VariableHint = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12.5px;
	color: var(--settings-text-faint);
`;

const VariableChip = styled.button`
	padding: 3px 7px;
	border: none;
	border-radius: 6px;
	background: var(--settings-accent-soft);
	color: var(--settings-accent-hover);
	font-family: ${MONO};
	font-size: 12px;
	cursor: pointer;

	&:hover {
		background: rgba(145, 71, 255, 0.24);
	}
`;

const Facts = styled.dl`
	display: grid;
	grid-template-columns: 128px 1fr;
	gap: 10px 16px;
	margin: 16px 0 0;
	padding: 14px 16px;
	border-radius: 10px;
	background: var(--settings-well);
	box-shadow: inset 0 0 0 1px var(--settings-border);
	font-size: 13px;
	line-height: 1.5;

	dt {
		font-weight: 600;
		color: var(--settings-text-primary);
	}

	dd {
		margin: 0;
		color: var(--settings-text-secondary);
	}
`;

const ModalNote = styled.p`
	margin: 14px 0 0;
	font-size: 12.5px;
	line-height: 1.5;
	color: var(--settings-text-muted);
`;

const RefreshToast = styled.div`
	position: absolute;
	left: 50%;
	bottom: 18px;
	z-index: 6;
	display: flex;
	align-items: center;
	gap: 12px;
	width: max-content;
	max-width: calc(100% - 32px);
	padding: 8px 8px 8px 16px;
	border-radius: 12px;
	background: var(--settings-surface-raised);
	box-shadow:
		0 0 0 1px var(--settings-control-border),
		0 12px 32px rgba(0, 0, 0, 0.5);
	color: var(--settings-text-secondary);
	font-size: 13px;
	line-height: 1.4;
	transform: translateX(-50%);
	animation: settings-toast-in 0.25s ${EASE};

	span {
		flex: 1;
		min-width: 0;
	}

	button {
		flex-shrink: 0;
	}

	svg {
		flex-shrink: 0;
		color: var(--settings-text-muted);
	}

	@keyframes settings-toast-in {
		from {
			opacity: 0;
			transform: translate(-50%, 12px);
		}
	}
`;

const NoResults = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 80px 20px;
	text-align: center;
	font-size: 14px;
	color: var(--settings-text-muted);

	svg {
		color: var(--settings-text-faint);
	}
`;

const ModalOverlay = styled.div`
	position: absolute;
	inset: 0;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 24px;
	background: rgba(0, 0, 0, 0.55);
`;

const ModalContent = styled.div<{ $wide?: boolean }>`
	width: 100%;
	max-width: ${(props) => (props.$wide ? "600px" : "460px")};
	max-height: 100%;
	display: flex;
	flex-direction: column;
	padding: 22px;
	border-radius: 14px;
	background: var(--settings-surface);
	box-shadow:
		0 0 0 1px var(--settings-control-border),
		0 24px 60px rgba(0, 0, 0, 0.6);
	font-family: ${FONT} !important;
	animation: settings-modal-in 0.2s ${EASE};

	@keyframes settings-modal-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
`;

const ModalHeader = styled.h3`
	margin: 0 0 8px;
	font-size: 16px;
	font-weight: 600;
	letter-spacing: -0.02em;
	color: var(--settings-text-primary);
`;

const ModalBody = styled.div`
	min-height: 0;
	overflow-y: auto;
`;

const ModalMessage = styled.p`
	margin: 0;
	font-size: 13.5px;
	line-height: 1.55;
	color: var(--settings-text-secondary);
	white-space: pre-line;
`;

const ModalButtonContainer = styled.div`
	display: flex;
	justify-content: flex-end;
	flex-shrink: 0;
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
	16,
);

const PlayIcon = (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
	</svg>
);

const ReloadMarkIcon = icon(
	<>
		<path d="M20 11a8 8 0 1 0-2.3 5.7" />
		<path d="M20 4v7h-7" />
	</>,
	13,
);

const ArrowRightIcon = icon(<path d="m9 18 6-6-6-6" />, 14);

const ArrowUpIcon = icon(<path d="m18 15-6-6-6 6" />, 14);

const ArrowDownIcon = icon(<path d="m6 9 6 6 6-6" />, 14);

const ResetIcon = icon(
	<>
		<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
		<path d="M3 3v5h5" />
	</>,
	14,
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
	player: icon(<polygon points="6 4 20 12 6 20 6 4" />),
	latency: icon(
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3 3" />
		</>,
	),
	experimental: icon(
		<>
			<path d="M9 3h6" />
			<path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" />
			<path d="M7 15h10" />
		</>,
	),
	data: icon(
		<>
			<ellipse cx="12" cy="5" rx="8" ry="3" />
			<path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
			<path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
		</>,
	),
	account: icon(
		<>
			<circle cx="12" cy="8" r="4" />
			<path d="M4 21a8 8 0 0 1 16 0" />
		</>,
	),
	about: icon(
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 16v-5" />
			<path d="M12 8h.01" />
		</>,
	),
	developer: icon(
		<>
			<path d="m16 18 6-6-6-6" />
			<path d="M8 6l-6 6 6 6" />
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

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isValidLink(value: string): boolean {
	try {
		const url = new URL(value.replaceAll("%username%", "user"));
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

function asRecord(item: unknown): Record<string, unknown> {
	return typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
}

function formatNumber(value: number): string {
	return Number.isFinite(value) ? String(value) : "";
}

type PairControlProps = {
	setting: PairSettingDefinition;
	values: [number, number];
	onCommit: (values: [number, number]) => void;
};

function PairControl({ setting, values, onCommit }: PairControlProps) {
	const [drafts, setDrafts] = useState<[string, string]>([formatNumber(values[0]), formatNumber(values[1])]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setDrafts([formatNumber(values[0]), formatNumber(values[1])]);
		setError(null);
	}, [values[0], values[1]]);

	const commit = (next: [string, string]) => {
		setDrafts(next);
		const numbers = next.map(Number) as [number, number];
		if (next.some((draft) => draft.trim() === "") || numbers.some((number) => !Number.isFinite(number))) {
			setError("Enter a number in both fields.");
			return;
		}
		const outOfRange = numbers.some(
			(number) =>
				(setting.min !== undefined && number < setting.min) || (setting.max !== undefined && number > setting.max),
		);
		if (outOfRange) {
			setError(
				setting.max !== undefined
					? `Use values from ${setting.min ?? 0} to ${setting.max}.`
					: `Use values of ${setting.min ?? 0} or more.`,
			);
			return;
		}
		if (numbers[0] > numbers[1]) {
			setError(setting.orderError ?? "The first value can't be higher than the second one.");
			return;
		}
		setError(null);
		if (numbers[0] !== values[0] || numbers[1] !== values[1]) onCommit(numbers);
	};

	return (
		<ControlColumn>
			<NumberField>
				{[0, 1].map((index) => (
					<Fragment key={`${setting.id as string}-${index}`}>
						{index === 1 ? <PairSeparator>–</PairSeparator> : null}
						<NumberInput
							type="number"
							aria-label={`${setting.title} ${index === 0 ? "from" : "to"}`}
							aria-invalid={error !== null}
							value={drafts[index]}
							min={setting.min}
							max={setting.max}
							step={setting.step}
							onChange={(event) => {
								const next: [string, string] = [...drafts];
								next[index] = (event.target as HTMLInputElement).value;
								commit(next);
							}}
						/>
					</Fragment>
				))}
				{setting.unit ? <Unit>{setting.unit}</Unit> : null}
			</NumberField>
			{error ? <FieldError role="alert">{error}</FieldError> : null}
		</ControlColumn>
	);
}

type ListControlProps = {
	setting: ArraySettingDefinition;
	items: unknown[];
	onChange: (items: unknown[]) => void;
	onRemove: (index: number, item: unknown) => void;
	onReset?: () => void;
};

function ListControl({ setting, items, onChange, onRemove, onReset }: ListControlProps) {
	const fields = setting.arrayItemFields;
	const focused = useRef<{ index: number; field: string; input: HTMLInputElement } | null>(null);
	const itemLabel = setting.itemLabel ?? "item";

	const setField = (index: number, field: string, value: string) => {
		onChange(items.map((item, i) => (i === index ? { ...asRecord(item), [field]: value } : item)));
	};

	const move = (index: number, delta: number) => {
		const next = [...items];
		const [item] = next.splice(index, 1);
		next.splice(index + delta, 0, item);
		onChange(next);
	};

	const insertVariable = (variable: string) => {
		const target = focused.current;
		if (target?.input.isConnected) {
			const { input, index, field } = target;
			const start = input.selectionStart ?? input.value.length;
			const end = input.selectionEnd ?? start;
			setField(index, field, input.value.slice(0, start) + variable + input.value.slice(end));
			requestAnimationFrame(() => {
				input.focus();
				input.setSelectionRange(start + variable.length, start + variable.length);
			});
			return;
		}
		if (items.length === 0) return;
		const field = fields.find((item) => item.validate === "url")?.name ?? fields[fields.length - 1]?.name;
		if (!field) return;
		const index = items.length - 1;
		setField(index, field, String(asRecord(items[index])[field] ?? "") + variable);
	};

	return (
		<ListContainer>
			{items.length === 0 ? <ArrayEmpty>No {itemLabel}s yet.</ArrayEmpty> : null}
			{items.map((item, index) => {
				const record = asRecord(item);
				const invalidFields = fields.filter(
					(field) =>
						field.validate === "url" &&
						String(record[field.name] ?? "") !== "" &&
						!isValidLink(String(record[field.name])),
				);
				return (
					<ListItem key={`list-${setting.id as string}-${index}`}>
						<ListItemRow>
							{setting.reorderable ? (
								<MoveButtons>
									<MoveButton
										type="button"
										title="Move up"
										aria-label="Move up"
										disabled={index === 0}
										onClick={() => move(index, -1)}
									>
										{ArrowUpIcon}
									</MoveButton>
									<MoveButton
										type="button"
										title="Move down"
										aria-label="Move down"
										disabled={index === items.length - 1}
										onClick={() => move(index, 1)}
									>
										{ArrowDownIcon}
									</MoveButton>
								</MoveButtons>
							) : null}
							{fields.map((field) => (
								<ListInput
									key={`${setting.id as string}-${index}-${field.name}`}
									$narrow={field.width === "narrow"}
									aria-label={field.placeholder}
									aria-invalid={invalidFields.includes(field)}
									value={String(record[field.name] ?? (typeof item === "object" ? "" : String(item)))}
									placeholder={field.placeholder}
									onFocus={(event) => {
										focused.current = { index, field: field.name, input: event.target as HTMLInputElement };
									}}
									onChange={(event) => setField(index, field.name, (event.target as HTMLInputElement).value)}
								/>
							))}
							<RemoveButton
								type="button"
								title={`Remove ${itemLabel}`}
								aria-label={`Remove ${itemLabel}`}
								onClick={() => onRemove(index, item)}
							>
								{CloseIcon(14)}
							</RemoveButton>
						</ListItemRow>
						{invalidFields.length > 0 ? (
							<ListItemError style={setting.reorderable ? undefined : { paddingLeft: 0 }}>
								Enter a full link that starts with https://
							</ListItemError>
						) : null}
					</ListItem>
				);
			})}
			<ListFooter>
				<SecondaryButton
					type="button"
					onClick={() => onChange([...items, Object.fromEntries(fields.map((field) => [field.name, ""]))])}
				>
					{PlusIcon}
					{setting.addLabel ?? "Add item"}
				</SecondaryButton>
				{setting.variables && setting.variables.length > 0 ? (
					<VariableHint>
						Insert into the focused field:
						{setting.variables.map((variable) => (
							<VariableChip
								key={variable}
								type="button"
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => insertVariable(variable)}
							>
								{variable}
							</VariableChip>
						))}
					</VariableHint>
				) : null}
				<ListFooterSpacer />
				{onReset ? (
					<QuietButton type="button" onClick={onReset}>
						{ResetIcon}
						Reset to defaults
					</QuietButton>
				) : null}
			</ListFooter>
		</ListContainer>
	);
}

type SettingNode<T> = { setting: SettingDefinition<T>; children: SettingDefinition<T>[] };

type RenderGroup<T> = { kind: "card"; items: SettingNode<T>[] } | { kind: "panel"; item: SettingDefinition<T> };

function splitSections<T>(settings: SettingDefinition<T>[]): { title?: string; settings: SettingDefinition<T>[] }[] {
	const parts: { title?: string; settings: SettingDefinition<T>[] }[] = [];
	for (const setting of settings) {
		const last = parts[parts.length - 1];
		if (!last || (setting.section !== undefined && setting.section !== last.title)) {
			parts.push({ title: setting.section, settings: [setting] });
		} else {
			last.settings.push(setting);
		}
	}
	return parts;
}

function groupSettings<T>(settings: SettingDefinition<T>[], nest: boolean): RenderGroup<T>[] {
	const groups: RenderGroup<T>[] = [];
	for (const setting of settings) {
		if (setting.hideInfo) {
			groups.push({ kind: "panel", item: setting });
			continue;
		}
		let last = groups[groups.length - 1];
		if (last?.kind !== "card") {
			last = { kind: "card", items: [] };
			groups.push(last);
		}
		const dependency = setting.dependsOn;
		const parent =
			nest && dependency && (dependency.value ?? true) === true
				? last.items.find((node) => node.setting.id === dependency.key && node.setting.type === "toggle")
				: undefined;
		if (parent) parent.children.push(setting);
		else last.items.push({ setting, children: [] });
	}
	return groups;
}

const Settings = <T,>({
	logoSrc = "Logo.svg",
	isOpen = true,
	identity,
	identityCategoryId,
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
		confirmationTitle?: string;
		confirmationMessage?: string;
		confirmText?: string;
		confirmTone?: "default" | "danger";
		confirmationFacts?: { term: string; detail: string }[];
		confirmationNote?: string;
	} | null>(null);
	const [pendingArrayRemove, setPendingArrayRemove] = useState<{
		key: keyof T;
		index: number;
		itemTitle?: string;
		itemLabel?: string;
		listTitle?: string;
		confirmationMessage?: string;
	} | null>(null);
	const [pendingReset, setPendingReset] = useState<{
		key: keyof T;
		title: string;
		value: unknown[];
	} | null>(null);
	const [refreshPending, setRefreshPending] = useState<string[]>([]);
	const [fileUploadError, setFileUploadError] = useState<string | null>(null);

	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	const visibleCategories = useMemo(
		() =>
			[...categories]
				.filter((category) => !category.isVisible || category.isVisible(settings))
				.sort((a, b) => a.order - b.order),
		[categories, settings],
	);
	const navCategories = visibleCategories.filter((category) => !category.hiddenInNav);
	const mainCategories = navCategories.filter((category) => category.placement !== "utility");
	const utilityCategories = navCategories.filter((category) => category.placement === "utility");
	const isSearching = searchQuery.trim().length > 0;

	const selectedCategoryId =
		activeCategoryId && visibleCategories.some((category) => category.id === activeCategoryId)
			? activeCategoryId
			: (navCategories[0]?.id ?? null);
	const selectedCategory = visibleCategories.find((category) => category.id === selectedCategoryId) ?? null;

	const matchCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const category of visibleCategories) {
			if (category.bare) continue;
			const matching = settingDefinitions.filter(
				(setting) => setting.categoryId === category.id && settingMatches(setting, category, searchQuery),
			);
			counts.set(category.id, matching.length);
		}
		return counts;
	}, [visibleCategories, settingDefinitions, searchQuery]);

	const visibleSections = useMemo(() => {
		const source = isSearching
			? visibleCategories.filter((category) => (matchCounts.get(category.id) ?? 0) > 0)
			: visibleCategories.filter((category) => category.id === selectedCategoryId);

		return source.map((category) => ({
			category,
			settings: settingDefinitions.filter(
				(setting) =>
					setting.categoryId === category.id && (!isSearching || settingMatches(setting, category, searchQuery)),
			),
		}));
	}, [isSearching, visibleCategories, matchCounts, selectedCategoryId, settingDefinitions, searchQuery]);

	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
			setPendingToggle(null);
			setPendingArrayRemove(null);
			setPendingReset(null);
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
			if (
				event.key === "/" &&
				!pendingToggle &&
				!pendingArrayRemove &&
				!pendingReset &&
				!isTypingTarget(event.target)
			) {
				event.preventDefault();
				event.stopPropagation();
				searchRef.current?.focus();
				return;
			}
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
			if (pendingReset) {
				setPendingReset(null);
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
	}, [isOpen, pendingToggle, pendingArrayRemove, pendingReset, searchQuery, onClose]);

	const updateSetting = (key: keyof T, value: unknown) => {
		const newSettings = { ...settings, [key]: value };
		onSettingsChange(newSettings, key);
	};

	const updateSettings = (patch: Partial<T>) => {
		const keys = Object.keys(patch) as (keyof T)[];
		if (keys.length === 0) return;
		onSettingsChange({ ...settings, ...patch }, keys[0], keys.slice(1));
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
			const result = e.target?.result as string;
			if (setting.type === "file" && setting.fileNameKey) {
				updateSettings({ [setting.id]: result, [setting.fileNameKey]: file.name } as Partial<T>);
			} else {
				updateSetting(setting.id as keyof T, result);
			}
		};
		reader.onerror = () => {
			setFileUploadError("Failed to read the selected file. Please try again.");
		};
		reader.readAsDataURL(file);
		target.value = "";
	};

	const clearFile = (setting: SettingDefinition<T>) => {
		if (setting.type === "file" && setting.fileNameKey) {
			updateSettings({ [setting.id]: "", [setting.fileNameKey]: "" } as Partial<T>);
		} else {
			updateSetting(setting.id as keyof T, "");
		}
		setFileUploadError(null);
	};

	const handleToggleChange = (event: Event, setting: SettingDefinition<T>, checked: boolean) => {
		event.stopPropagation();

		if (setting.type === "toggle" && setting.confirmOnEnable && checked) {
			setPendingToggle({
				key: setting.id as keyof T,
				value: checked,
				confirmationTitle: setting.confirmationTitle,
				confirmationMessage: setting.confirmationMessage ?? "Are you sure you want to enable this setting?",
				confirmText: setting.confirmText,
				confirmTone: setting.confirmTone,
				confirmationFacts: setting.confirmationFacts,
				confirmationNote: setting.confirmationNote,
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
				itemLabel: setting.itemLabel,
				listTitle: setting.title,
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
					<ToggleTrack $checked={value === true}>
						<ToggleInput
							type="checkbox"
							role="switch"
							aria-checked={value === true}
							aria-label={setting.title}
							checked={value === true}
							onChange={(e) => handleToggleChange(e, setting, (e.target as HTMLInputElement).checked)}
						/>
						<ToggleKnob $checked={value === true} />
					</ToggleTrack>
				);
			}
			case "input": {
				return (
					<TextInput
						value={(value as string) || ""}
						placeholder={setting.placeholder}
						aria-label={setting.title}
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
								aria-label={setting.title}
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
							{setting.onPreview ? (
								<PreviewButton
									type="button"
									title={setting.previewLabel ?? "Preview"}
									aria-label={setting.previewLabel ?? "Preview"}
									onClick={() => setting.onPreview?.(settings)}
								>
									{PlayIcon}
								</PreviewButton>
							) : null}
						</SliderField>
					);
				}
				return (
					<NumberField>
						<NumberInput
							type="number"
							aria-label={setting.title}
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
						aria-label={setting.title}
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
					<RadioContainer role="radiogroup" aria-label={setting.title}>
						{setting.options?.map((option) => (
							<div key={option.value}>
								<RadioInput
									type="radio"
									name={setting.id as string}
									id={`${setting.id as string}-${option.value}`}
									checked={value === option.value}
									onChange={() => updateSetting(setting.id as keyof T, option.value)}
								/>
								<RadioLabel htmlFor={`${setting.id as string}-${option.value}`} $checked={value === option.value}>
									{option.label}
								</RadioLabel>
							</div>
						))}
					</RadioContainer>
				);
			}
			case "array": {
				const defaults = setting.defaultValue;
				return (
					<ListControl
						setting={setting}
						items={(value as unknown[]) || []}
						onChange={(items) => updateSetting(setting.id as keyof T, items)}
						onRemove={(index, item) => handleArrayRemove(setting, index, item)}
						onReset={
							defaults
								? () => setPendingReset({ key: setting.id as keyof T, title: setting.title, value: defaults })
								: undefined
						}
					/>
				);
			}
			case "pair": {
				const [fromKey, toKey] = setting.keys;
				return (
					<PairControl
						setting={setting}
						values={[Number(settings[fromKey as keyof T]), Number(settings[toKey as keyof T])]}
						onCommit={([from, to]) => updateSettings({ [fromKey]: from, [toKey]: to } as Partial<T>)}
					/>
				);
			}
			case "action": {
				return (
					<SecondaryButton type="button" onClick={() => selectCategory(setting.targetCategoryId)}>
						{setting.actionLabel}
						{ArrowRightIcon}
					</SecondaryButton>
				);
			}
			case "choice": {
				const selected = setting.options.findIndex((option) =>
					Object.entries(option.value).every(([key, expected]) => settings[key as keyof T] === expected),
				);
				return (
					<RadioContainer role="radiogroup" aria-label={setting.title}>
						{setting.options.map((option, index) => (
							<ChoiceButton
								key={option.label}
								type="button"
								role="radio"
								aria-checked={index === selected}
								$checked={index === selected}
								onClick={() => updateSettings(option.value)}
							>
								{option.label}
							</ChoiceButton>
						))}
					</RadioContainer>
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
											14,
										)}
										<FileName>
											{(setting.fileNameKey ? String(settings[setting.fileNameKey as keyof T] ?? "") : "") ||
												setting.uploadedLabel ||
												"File uploaded"}
										</FileName>
									</FileStatus>
									<RemoveFileButton onClick={() => clearFile(setting)} title="Remove file" aria-label="Remove file">
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
										14,
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

	const renderRow = (setting: SettingDefinition<T>, child: boolean) => {
		const disabled = isDisabled(setting);
		const stack = setting.type === "array";
		return (
			<Row key={`setting-${setting.id as string}`} $disabled={disabled} $child={child} $stack={stack}>
				<RowInfo>
					<RowTitle>
						{setting.title}
						{setting.requiresRefreshToDisable ? (
							<RefreshMark
								title="Turning this off takes effect after you reload the page."
								aria-label="Turning this off takes effect after you reload the page."
							>
								{ReloadMarkIcon}
							</RefreshMark>
						) : null}
					</RowTitle>
					<RowDescription>{setting.description}</RowDescription>
					{setting.hint ? <RowHint>{setting.hint}</RowHint> : null}
				</RowInfo>
				<RowControl $disabled={disabled} style={stack ? { justifyContent: "stretch" } : undefined}>
					{renderSettingControl(setting)}
				</RowControl>
			</Row>
		);
	};

	const renderGroups = (category: SettingCategory<T>, sectionSettings: SettingDefinition<T>[]) =>
		groupSettings(sectionSettings, !isSearching).map((group, groupIndex) =>
			group.kind === "panel" ? (
				<Panel key={`panel-${group.item.id as string}`}>{renderSettingControl(group.item)}</Panel>
			) : (
				<Card key={`card-${category.id}-${groupIndex}`}>
					{group.items.map(({ setting, children }) => {
						const open = settings[setting.id as keyof T] === true;
						return (
							<Item key={`item-${setting.id as string}`}>
								{renderRow(setting, Boolean(setting.dependsOn))}
								{children.length > 0 && (
									<Children $open={open} inert={!open} aria-hidden={!open}>
										<div>{children.map((childSetting) => renderRow(childSetting, true))}</div>
									</Children>
								)}
							</Item>
						);
					})}
				</Card>
			),
		);

	const renderNavItem = (category: SettingCategory<T>) => {
		const count = matchCounts.get(category.id) ?? 0;
		const active = !isSearching && category.id === selectedCategoryId;
		return (
			<NavItem
				key={category.id}
				$active={active}
				$dimmed={isSearching && count === 0}
				aria-current={active ? "page" : undefined}
				onClick={() => selectCategory(category.id)}
			>
				{CATEGORY_ICONS[category.id] ?? FALLBACK_CATEGORY_ICON}
				<NavLabel>{category.title}</NavLabel>
				{isSearching && count > 0 ? <NavCount>{count}</NavCount> : null}
			</NavItem>
		);
	};

	const totalMatches = isSearching ? visibleSections.reduce((total, section) => total + section.settings.length, 0) : 0;
	const showBare = !isSearching && selectedCategory?.bare === true;
	const identityElement = identity?.({
		open: isOpen,
		active: !isSearching && identityCategoryId !== undefined && selectedCategoryId === identityCategoryId,
		onSelect: () => {
			if (identityCategoryId) selectCategory(identityCategoryId);
		},
	});

	const renderContent = () => {
		if (isSearching && totalMatches === 0) {
			return (
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
			);
		}
		if (showBare) {
			return (
				<BarePage>
					{visibleSections[0]?.settings.map((setting) => (
						<div key={`bare-${setting.id as string}`}>{renderSettingControl(setting)}</div>
					))}
				</BarePage>
			);
		}
		if (isSearching) {
			return visibleSections.map((section) => (
				<Section key={section.category.id}>
					<SectionTitle>{section.category.title}</SectionTitle>
					{renderGroups(section.category, section.settings)}
				</Section>
			));
		}
		const section = visibleSections[0];
		if (!section) return null;
		return (
			<>
				<PageTitle>{section.category.title}</PageTitle>
				{splitSections(section.settings).map((part, index) => (
					<Section key={`part-${section.category.id}-${part.title ?? index}`}>
						{part.title ? <SectionTitle>{part.title}</SectionTitle> : null}
						{renderGroups(section.category, part.settings)}
					</Section>
				))}
			</>
		);
	};

	return (
		<>
			<SettingsOverlayBackground onClick={onClose} />
			{/* native <dialog> renders in the top layer and breaks styling inside the injected overlay */}
			<SettingsContainer role="dialog" aria-modal="true" aria-label={`${EXTENSION_NAME} settings`}>
				<Rail aria-label="Settings categories">
					{identityElement}
					<SearchContainer>
						{SearchIcon}
						<SearchInput
							ref={searchRef}
							type="text"
							placeholder="Search settings..."
							aria-label="Search settings"
							value={searchQuery}
							onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
						/>
						{searchQuery ? (
							<IconButton onClick={() => setSearchQuery("")} title="Clear search" aria-label="Clear search">
								{CloseIcon(14)}
							</IconButton>
						) : (
							<Kbd>/</Kbd>
						)}
					</SearchContainer>
					<NavList>
						{mainCategories.map(renderNavItem)}
						{utilityCategories.length > 0 && mainCategories.length > 0 ? <NavSeparator /> : null}
						{utilityCategories.map(renderNavItem)}
					</NavList>
					<RailFooter>
						<FooterLogo src={logoSrc} alt="" />
						<FooterName>{EXTENSION_NAME}</FooterName>
						<FooterVersion>v{__version__}</FooterVersion>
					</RailFooter>
				</Rail>
				<Main>
					{showBare ? null : <MainGlow />}
					<CloseButton onClick={onClose} title="Close" aria-label="Close settings">
						{CloseIcon(18)}
					</CloseButton>
					<Content ref={contentRef}>
						{showBare ? (
							renderContent()
						) : (
							<Page style={refreshPending.length > 0 ? { paddingBottom: "104px" } : undefined}>{renderContent()}</Page>
						)}
					</Content>
					{refreshPending.length > 0 && (
						<RefreshToast role="status">
							{RefreshIcon}
							<span>Some changes take effect after you reload the page.</span>
							<QuietButton onClick={() => setRefreshPending([])}>Dismiss</QuietButton>
							<PrimaryButton onClick={() => window.location.reload()}>Reload page</PrimaryButton>
						</RefreshToast>
					)}
				</Main>
				{pendingToggle && (
					<ModalOverlay onClick={() => setPendingToggle(null)}>
						<ModalContent
							role="alertdialog"
							aria-modal="true"
							$wide={Boolean(pendingToggle.confirmationFacts?.length)}
							onClick={(e) => e.stopPropagation()}
						>
							<ModalHeader>{pendingToggle.confirmationTitle ?? "Confirm action"}</ModalHeader>
							<ModalBody>
								<ModalMessage>
									{pendingToggle.confirmationMessage || "Are you sure you want to enable this setting?"}
								</ModalMessage>
								{pendingToggle.confirmationFacts?.length ? (
									<Facts>
										{pendingToggle.confirmationFacts.map((fact) => (
											<Fragment key={fact.term}>
												<dt>{fact.term}</dt>
												<dd>{fact.detail}</dd>
											</Fragment>
										))}
									</Facts>
								) : null}
								{pendingToggle.confirmationNote ? <ModalNote>{pendingToggle.confirmationNote}</ModalNote> : null}
							</ModalBody>
							<ModalButtonContainer>
								<SecondaryButton onClick={() => setPendingToggle(null)}>Cancel</SecondaryButton>
								{pendingToggle.confirmTone === "danger" ? (
									<DangerButton onClick={confirmToggle}>{pendingToggle.confirmText ?? "Confirm"}</DangerButton>
								) : (
									<BrandButton onClick={confirmToggle}>{pendingToggle.confirmText ?? "Confirm"}</BrandButton>
								)}
							</ModalButtonContainer>
						</ModalContent>
					</ModalOverlay>
				)}
				{pendingReset && (
					<ModalOverlay onClick={() => setPendingReset(null)}>
						<ModalContent role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
							<ModalHeader>Reset {pendingReset.title.toLowerCase()}?</ModalHeader>
							<ModalMessage>Your current list will be replaced with the default one.</ModalMessage>
							<ModalButtonContainer>
								<SecondaryButton onClick={() => setPendingReset(null)}>Cancel</SecondaryButton>
								<DangerButton
									onClick={() => {
										updateSetting(pendingReset.key, pendingReset.value);
										setPendingReset(null);
									}}
								>
									Reset
								</DangerButton>
							</ModalButtonContainer>
						</ModalContent>
					</ModalOverlay>
				)}
				{pendingArrayRemove && (
					<ModalOverlay onClick={() => setPendingArrayRemove(null)}>
						<ModalContent role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
							<ModalHeader>
								{pendingArrayRemove.itemLabel ? `Remove ${pendingArrayRemove.itemLabel}?` : "Confirm removal"}
							</ModalHeader>
							<ModalMessage>
								{pendingArrayRemove.itemTitle && pendingArrayRemove.listTitle
									? `“${pendingArrayRemove.itemTitle}” will be removed from ${pendingArrayRemove.listTitle.toLowerCase()}.`
									: pendingArrayRemove.confirmationMessage || "Are you sure you want to remove this item?"}
							</ModalMessage>
							<ModalButtonContainer>
								<SecondaryButton onClick={() => setPendingArrayRemove(null)}>Cancel</SecondaryButton>
								<DangerButton onClick={confirmArrayRemove}>Remove</DangerButton>
							</ModalButtonContainer>
						</ModalContent>
					</ModalOverlay>
				)}
			</SettingsContainer>
		</>
	);
};

function settingMatches<T>(setting: SettingDefinition<T>, category: SettingCategory<T>, query: string): boolean {
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
`;
