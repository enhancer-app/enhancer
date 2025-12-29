import { useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";

export interface MessageMenuOption {
	label: string;
	onClick: () => void;
	key: string;
}

export interface MessageMenuEvent {
	options: MessageMenuOption[];
	x: number;
	y: number;
	onClose?: () => void;
}

export interface MessageMenuProps {
	options: MessageMenuOption[];
	x: number;
	y: number;
	onClose: () => void;
}

export function MessageMenuComponent({ options, x, y, onClose }: MessageMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ left: x, top: y });

	useEffect(() => {
		if (!menuRef.current) return;
		const menu = menuRef.current.getBoundingClientRect();
		let left = x;
		let top = y;
		const spacing = 8;
		if (left + menu.width > window.innerWidth - spacing) {
			left = window.innerWidth - menu.width - spacing;
		}
		if (top + menu.height > window.innerHeight - spacing) {
			top = window.innerHeight - menu.height - spacing;
		}
		if (left < spacing) left = spacing;
		if (top < spacing) top = spacing;
		setPos({ left, top });
	}, [x, y, options.length]);

	useEffect(() => {
		const handle = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("mousedown", handle);
		window.addEventListener("keydown", handleEsc);
		return () => {
			window.removeEventListener("mousedown", handle);
			window.removeEventListener("keydown", handleEsc);
		};
	}, [onClose]);

	return (
		<MenuContainer ref={menuRef} style={{ left: pos.left, top: pos.top }}>
			<div>
				{options.map((opt, i) => (
					<div key={`${opt.key}-${i}`}>
						<MenuOption
							onClick={() => {
								opt.onClick();
								onClose();
							}}
						>
							{opt.label}
						</MenuOption>
						{i < options.length - 1 && <MenuDivider />}
					</div>
				))}
			</div>
		</MenuContainer>
	);
}

const MenuContainer = styled.div`
	position: fixed;
	z-index: 99999999999;
	background: rgba(25, 25, 28, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	backdrop-filter: blur(8px);
	min-width: 180px;
	max-width: 300px;
	animation: tooltipFadeIn 0.2s ease-out;
	pointer-events: auto;
	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
`;

const MenuOption = styled.button`
	width: 100%;
	background: none;
	border: none;
	color: #fff;
	font-size: 14px;
	text-align: left;
	padding: 10px 20px;
	cursor: pointer;
	transition: background 0.15s;
	&:hover {
		background: rgba(255, 255, 255, 0.08);
	}
`;

const MenuDivider = styled.div`
	height: 1px;
	background: rgba(255, 255, 255, 0.08);
	margin: 0 10px;
`;
