import styled from "styled-components";

const ModalOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1001;
	backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
	background-color: #0d0d0d;
	border-radius: 15px;
	border: 1px solid #232323;
	font-family: "Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
	padding: 25px;
	box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.5);
	max-width: 500px;
	width: 90%;
`;

const ModalHeader = styled.h3`
	color: white;
	margin-bottom: 15px;
	font-size: 18px;
	text-align: center;
`;

const ModalMessage = styled.p`
	color: #ccc;
	font-size: 14px;
	margin-bottom: 20px;
	line-height: 1.5;
`;

const ModalButtonContainer = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 10px;
	margin-top: 20px;
`;

const ModalButton = styled.button<{ primary?: boolean }>`
	padding: 8px 15px;
	border-radius: 5px;
	font-size: 12px;
	cursor: pointer;
	border: none;
	transition: background-color 0.2s ease, color 0.2s ease;
	${(props) =>
		props.primary
			? `
    background-color: #9147ff;
    color: white;
    &:hover {
      background-color: #7a3cc8;
    }
  `
			: `
    background-color: #232323;
    color: #ccc;
    &:hover {
      background-color: #333333;
    }
  `}
`;

export interface ConfirmationModalProps {
	isOpen: boolean;
	title?: string;
	message?: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmationModal = ({
	isOpen,
	title = "Confirm Action",
	message = "Are you sure you want to proceed?",
	confirmText = "Confirm",
	cancelText = "Cancel",
	onConfirm,
	onCancel,
}: ConfirmationModalProps) => {
	if (!isOpen) return null;

	return (
		<ModalOverlay onClick={onCancel}>
			<ModalContent onClick={(e) => e.stopPropagation()}>
				<ModalHeader>{title}</ModalHeader>
				<ModalMessage>{message}</ModalMessage>
				<ModalButtonContainer>
					<ModalButton primary onClick={onConfirm}>
						{confirmText}
					</ModalButton>
					<ModalButton onClick={onCancel}>{cancelText}</ModalButton>
				</ModalButtonContainer>
			</ModalContent>
		</ModalOverlay>
	);
};
