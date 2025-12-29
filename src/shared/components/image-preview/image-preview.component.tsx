import styled from "styled-components";

export const ImagePreview = (src: string) => {
	return (
		<Wrapper>
			<div>This image will be shown in chat.</div>
			{src && <Image src={src} alt="Preview of image" />}
		</Wrapper>
	);
};

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const Image = styled.img`
  max-height: 200px;
  object-fit: contain;
  width: auto;
  border-radius: 4px;
`;
