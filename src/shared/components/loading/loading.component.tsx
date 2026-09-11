import styled from "styled-components";

interface LoadingProps {
	text: string;
}

export const LoadingComponent = ({ text }: LoadingProps) => {
	return (
		<LoadingSpinnerWrapper>
			<LoadingSpinner />
			<LoadingText>{text}</LoadingText>
		</LoadingSpinnerWrapper>
	);
};

const LoadingSpinnerWrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 10px 0;
`;

const LoadingSpinner = styled.div`
	width: 20px;
	height: 20px;
	border: 2px solid rgba(255, 255, 255, 0.1);
	border-top: 2px solid var(--main-color);
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin-bottom: 8px;

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
`;

const LoadingText = styled.div`
	color: #8e8e8e;
	font-size: 13px;
`;
