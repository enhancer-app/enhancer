import type { ChatPopupComponentProps, ChatPopupVariant } from "$types/shared/components/chat-popup.component.types.ts";
import { useEffect, useRef, useState } from "preact/hooks";
import styled, { css } from "styled-components";

const PopupWrapper = styled.div<{ $variant: ChatPopupVariant; $compact: boolean }>`
	--main-color: ${({ $variant }) => ($variant === "kick" ? "#53fc18" : "#bf94ff")};
	color: #efeff1;
	font-size: 14px;
	display: flex;
	flex-direction: column;
	gap: ${({ $compact }) => ($compact ? "0" : "8px")};
	position: relative;
	${({ $variant, $compact }) =>
		$variant === "kick"
			? css`
					padding: ${$compact ? "4px 1.25rem" : "0 1.25rem"};
				`
			: css`
					margin-bottom: 8px;
					background: #18181b;
					padding: ${$compact ? "6px 10px" : "10px"};
					border-radius: 4px;
					border-top: 1px solid rgba(255, 255, 255, 0.1);
				`}
`;

const Header = styled.div<{ $compact: boolean }>`
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
	border-bottom: ${({ $compact }) => ($compact ? "none" : "1px solid rgba(255, 255, 255, 0.1)")};
	padding-bottom: ${({ $compact }) => ($compact ? "0" : "8px")};
	position: relative;
`;

const HeaderProgress = styled.div<{ $width: string }>`
	position: absolute;
	bottom: -1px;
	left: 0;
	height: 1px;
	background-color: var(--main-color);
	width: ${({ $width }) => $width};
	transition: width 1s linear;
	z-index: 1;
`;

const TitleArea = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 0;
`;

const Title = styled.strong`
	flex-grow: 1;
	min-width: 0;
`;

const AutocloseTimer = styled.span`
	font-size: 12px;
	color: #8e8e8e;
	white-space: nowrap;
`;

const HeaderButton = styled.button`
	cursor: pointer;
	background: transparent;
	border: none;
	color: #8e8e8e;
	font-size: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	flex-shrink: 0;

	&:hover {
		color: white;
	}
`;

const ContentArea = styled.div`
	padding: 4px 0;
`;

const Card = styled.div<{ $variant: ChatPopupVariant }>`
	--m-bg: #1f1f23;
	--m-border: rgba(255, 255, 255, 0.1);
	--m-text: #efeff1;
	--m-muted: #adadb8;
	--m-accent: #9147ff;
	--m-accent-hover: #772ce8;
	--m-accent-text: #bf94ff;
	--m-on-accent: #fff;
	--m-chip: #2f2f35;
	--m-chip-hover: #3a3a3d;
	--m-button-radius: 4px;
	${({ $variant }) =>
		$variant === "kick" &&
		css`
			--m-bg: #191b1f;
			--m-border: #2a2d33;
			--m-text: #fff;
			--m-muted: #a8b1b7;
			--m-accent: #53fc18;
			--m-accent-hover: #46d614;
			--m-accent-text: #53fc18;
			--m-on-accent: #000;
			--m-chip: #24272c;
			--m-chip-hover: #2f3338;
			--m-button-radius: 6px;
		`}
	position: relative;
	margin: ${({ $variant }) => ($variant === "kick" ? "0 0 8px" : "0 10px 8px")};
	background: var(--m-bg);
	border: 1px solid var(--m-border);
	border-radius: 6px;
	color: var(--m-text);
	font-size: 13px;
	overflow: hidden;
`;

const CardBar = styled.div<{ $bottom: boolean }>`
	position: absolute;
	left: 0;
	${({ $bottom }) => ($bottom ? "bottom: 0;" : "top: 0;")}
	height: 2px;
	background: var(--m-accent);
	transition: width 1s linear;
`;

const CardBody = styled.div<{ $compact: boolean }>`
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: ${({ $compact }) => ($compact ? "5px 6px 5px 8px" : "10px")};
`;

const CardRow = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

const CardRowMain = styled.div`
	flex: 1;
	min-width: 0;
`;

const CardButton = styled.button`
	width: 24px;
	height: 24px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--m-muted);
	cursor: pointer;
	display: grid;
	place-items: center;
	flex-shrink: 0;
	padding: 0;

	&:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--m-text);
	}

	svg {
		width: 12px;
		height: 12px;
	}
`;

function CloseIcon() {
	return (
		<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<path d="M4 4l8 8M12 4l-8 8" />
		</svg>
	);
}

export function ChatPopupComponent({
	variant,
	title,
	content,
	compactContent,
	autoclose,
	appearance = "default",
	progress,
	onClose,
}: ChatPopupComponentProps) {
	const autocloseSeconds = (typeof autoclose === "number" ? autoclose : autoclose?.value) ?? 0;
	const [timeLeft, setTimeLeft] = useState(autocloseSeconds);
	const [minimized, setMinimized] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const onCloseRef = useRef(onClose);

	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		if (autocloseSeconds <= 0) return;
		const startedAt = Date.now();
		setTimeLeft(autocloseSeconds);
		intervalRef.current = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startedAt) / 1000);
			const remaining = Math.max(0, autocloseSeconds - elapsed);
			setTimeLeft(remaining);
			if (remaining === 0) {
				if (intervalRef.current !== null) clearInterval(intervalRef.current);
				onCloseRef.current?.();
			}
		}, 100);
		return () => {
			if (intervalRef.current !== null) clearInterval(intervalRef.current);
		};
	}, [autocloseSeconds]);

	const close = () => {
		if (intervalRef.current !== null) clearInterval(intervalRef.current);
		onCloseRef.current?.();
	};
	const expand = () => setMinimized(false);

	const compact = minimized && compactContent !== undefined;
	const canMinimize = compactContent !== undefined && !minimized;
	const hasTimer = autocloseSeconds > 0;
	const timerRatio = hasTimer && timeLeft > 0 ? timeLeft / autocloseSeconds : 0;

	if (appearance === "card") {
		const ratio = hasTimer ? timerRatio : (progress?.value ?? null);
		return (
			<Card $variant={variant}>
				{ratio !== null && <CardBar $bottom={compact} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />}
				<CardBody $compact={compact}>
					<CardRow>
						<CardRowMain>{compact ? compactContent?.(expand) : title}</CardRowMain>
						<CardButton
							type="button"
							title={canMinimize ? "Minimize" : "Close"}
							aria-label={canMinimize ? "Minimize" : "Close"}
							onClick={canMinimize ? () => setMinimized(true) : close}
						>
							<CloseIcon />
						</CardButton>
					</CardRow>
					{!compact && content}
				</CardBody>
			</Card>
		);
	}

	return (
		<PopupWrapper $variant={variant} $compact={compact}>
			<Header $compact={compact}>
				<TitleArea>
					{compact ? compactContent?.(expand) : <Title>{title}</Title>}
					{hasTimer && <AutocloseTimer>({timeLeft}s)</AutocloseTimer>}
				</TitleArea>
				{compact && (
					<HeaderButton type="button" title="Expand" onClick={expand}>
						▴
					</HeaderButton>
				)}
				<HeaderButton
					type="button"
					title={canMinimize ? "Minimize" : "Close"}
					onClick={canMinimize ? () => setMinimized(true) : close}
				>
					✕
				</HeaderButton>
				{hasTimer && <HeaderProgress $width={`${timerRatio * 100}%`} />}
			</Header>
			{!compact && <ContentArea>{content}</ContentArea>}
		</PopupWrapper>
	);
}
