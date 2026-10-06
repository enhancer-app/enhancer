import type { ChatPopupComponentProps } from "$types/shared/components/chat-popup.component.types.ts";
import { useEffect, useRef, useState } from "preact/hooks";
import styled, { css } from "styled-components";

const PopupWrapper = styled.div<{ $variant: "twitch" | "kick"; $compact: boolean }>`
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

export function ChatPopupComponent({
	variant,
	title,
	content,
	compactContent,
	autoclose,
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

	const compact = minimized && compactContent !== undefined;
	const canMinimize = compactContent !== undefined && !minimized;
	const hasTimer = autocloseSeconds > 0;
	const progressWidth = hasTimer && timeLeft > 0 ? `${(timeLeft / autocloseSeconds) * 100}%` : "0%";

	return (
		<PopupWrapper $variant={variant} $compact={compact}>
			<Header $compact={compact}>
				<TitleArea>
					{compact ? compactContent : <Title>{title}</Title>}
					{hasTimer && <AutocloseTimer>({timeLeft}s)</AutocloseTimer>}
				</TitleArea>
				{compact && (
					<HeaderButton type="button" title="Expand" onClick={() => setMinimized(false)}>
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
				{hasTimer && <HeaderProgress $width={progressWidth} />}
			</Header>
			{!compact && <ContentArea>{content}</ContentArea>}
		</PopupWrapper>
	);
}
