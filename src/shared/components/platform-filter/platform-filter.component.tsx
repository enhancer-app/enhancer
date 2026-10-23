import { PLATFORM_NAMES, PlatformIcon } from "$shared/components/cross-platform-follows/platform.shared.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import { FOLLOWS_PLATFORM_FILTERS } from "$shared/utils/follows-filter.utils.ts";
import type {
	PlatformFilterComponentProps,
	PlatformFilterTheme,
} from "$types/shared/components/platform-filter.component.types.ts";
import styled, { css } from "styled-components";

export function PlatformFilterComponent({
	value,
	onChange,
	theme,
	liveCounts,
	children,
}: PlatformFilterComponentProps) {
	return (
		<FilterBar role="group" aria-label="Filter followed channels by platform" $theme={theme}>
			{FOLLOWS_PLATFORM_FILTERS.map((option) => {
				const button = (
					<FilterButton
						key={option}
						type="button"
						aria-pressed={value === option}
						aria-label={option === "all" ? undefined : PLATFORM_NAMES[option]}
						$theme={theme}
						$active={value === option}
						$icon={option !== "all"}
						$counted={!!liveCounts}
						onClick={() => option !== value && onChange(option)}
					>
						{option === "all" ? "All" : <PlatformIcon platform={option} size={14} />}
						{liveCounts && <LiveCount>{liveCounts[option]}</LiveCount>}
					</FilterButton>
				);
				return option === "all" ? (
					button
				) : (
					<TooltipComponent key={option} content={PLATFORM_NAMES[option]} position="top">
						{button}
					</TooltipComponent>
				);
			})}
			{children}
		</FilterBar>
	);
}

type ThemeProps = { $theme: PlatformFilterTheme };

const FilterBar = styled.div<ThemeProps>`
	flex: ${({ $theme }) => ($theme === "home" ? "none" : 1)};
	display: flex;
	align-items: center;
	gap: ${({ $theme }) => ($theme === "home" ? "8px" : "4px")};
	min-width: 0;
`;

const FilterButton = styled.button<ThemeProps & { $active: boolean; $icon: boolean; $counted: boolean }>`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 28px;
	min-width: 28px;
	padding: ${({ $icon }) => ($icon ? "0" : "0 10px")};
	border: none;
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	border-radius: ${({ $theme }) => ($theme === "twitch" ? "var(--border-radius-medium)" : "6px")};

	${({ $theme, $active, $icon, $counted }) => {
		if ($theme === "home") {
			return css`
				gap: 8px;
				height: 36px;
				min-width: 36px;
				padding: ${$counted ? `0 8px 0 ${$icon ? "12px" : "14px"}` : $icon ? "0" : "0 14px"};
				border-radius: 999px;
				font-size: 13px;
				color: ${$active ? "#fff" : "#a6a6a6"};
				background: ${$active ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.05)"};
				transition:
					background 0.2s ease,
					color 0.2s ease;
				&:hover {
					color: #fff;
					background: ${$active ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.09)"};
				}
			`;
		}
		if ($theme === "kick") {
			return css`
				color: ${$active ? "#fff" : "rgba(255, 255, 255, 0.6)"};
				background: ${$active ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.04)"};
				&:hover {
					color: #fff;
					background: ${$active ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.08)"};
				}
			`;
		}
		return css`
			color: ${$active ? "var(--color-text-base)" : "var(--color-text-alt-2)"};
			background: ${$active ? "var(--color-background-button-secondary-default)" : "transparent"};
			&:hover {
				color: var(--color-text-base);
				background: ${
					$active ? "var(--color-background-button-secondary-hover)" : "var(--color-background-button-text-hover)"
				};
			}
		`;
	}}

	svg {
		display: block;
		flex-shrink: 0;
	}
`;

const LiveCount = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 5px;
	height: 22px;
	padding: 0 8px;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.35);
	color: #e5e5e5;
	font-size: 12px;
	font-variant-numeric: tabular-nums;

	&::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #eb0400;
	}
`;
