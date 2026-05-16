import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";
import KickModule from "$kick/kick.module.ts";
import type { ChatMessagePopupEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatMessagePopupModule extends KickModule {
	config: KickModuleConfig = {
		name: "message-popup",
		appliers: [
			{
				type: "event",
				event: "kick:chatPopupMessage",
				callback: this.render.bind(this),
				key: "message-popup",
			},
		],
	};

	private render(message: ChatMessagePopupEvent) {
		const contentElement = document.querySelector("#chatroom-footer");
		if (contentElement) {
			let wrapper = contentElement.querySelector(`.${this.getId()}`);
			if (wrapper) wrapper.remove();

			wrapper = document.createElement("div");
			wrapper.classList.add(this.getId());

			contentElement.insertBefore(wrapper, contentElement.firstElementChild);

			render(
				<MessagePopup
					title={message.title}
					autoclose={message.autoclose ?? 15}
					onClose={() => {
						wrapper.remove();
						if (message.onClose) {
							message.onClose();
						}
					}}
					content={message.content}
				/>,
				wrapper,
			);
		} else this.logger.error("Failed to render component in chat");
	}
}

const PopupWrapper = styled.div`
  --main-color: #53fc18;
  padding: 0 1.25rem;
  color: #efeff1;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
  position: relative;
`;

const HeaderProgress = styled.div<{ width: string }>`
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 1px;
  background-color: var(--main-color);
  width: ${(props) => props.width};
  transition: width 1s linear;
  z-index: 1;
`;

const TitleArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Title = styled.strong`
  flex-grow: 1;
`;

const AutocloseTimer = styled.span`
  font-size: 12px;
  color: #8e8e8e;
  white-space: nowrap;
`;

const CloseButton = styled.button`
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
  margin-left: 8px;

  &:hover {
    color: white;
  }
`;

const ContentArea = styled.div`
  padding: 4px 0;
`;

export function MessagePopup({ title, content, autoclose, onClose }: ChatMessagePopupEvent) {
	const [timeLeft, setTimeLeft] = useState(autoclose || 0);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const startTimeRef = useRef<number | null>(null);

	useEffect(() => {
		if (!autoclose || autoclose <= 0) {
			return;
		}

		startTimeRef.current = Date.now();
		setTimeLeft(autoclose);

		intervalRef.current = setInterval(() => {
			if (startTimeRef.current === null) {
				return;
			}

			const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
			const remaining = Math.max(0, autoclose - elapsed);

			setTimeLeft(remaining - 1);

			if (remaining === 0) {
				if (intervalRef.current !== null) {
					window.clearInterval(intervalRef.current);
				}
				onClose?.();
			}
		}, 100);

		return () => {
			if (intervalRef.current !== null) {
				window.clearInterval(intervalRef.current);
			}
		};
	}, [autoclose, onClose]);

	const progressWidth = autoclose && timeLeft > 0 ? `${(timeLeft / autoclose) * 100}%` : "0%";

	const handleClose = () => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
		}
		onClose?.();
	};

	return (
		<PopupWrapper>
			<Header>
				<TitleArea>
					<Title>{title}</Title>
					{autoclose && <AutocloseTimer>({timeLeft}s)</AutocloseTimer>}
				</TitleArea>
				<CloseButton type="button" onClick={handleClose}>
					✕
				</CloseButton>
				{autoclose && <HeaderProgress width={progressWidth} />}
			</Header>
			<ContentArea>{content}</ContentArea>
		</PopupWrapper>
	);
}
