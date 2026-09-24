import styled from "styled-components";

export const EmotePreview = (src?: string) => {
	return (
		<Wrapper>
			<div>Test Test Test.</div>
		</Wrapper>
	);
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;
