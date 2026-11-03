import type { EnhancerAccountFrameProps } from "$types/shared/components/enhancer-account.component.types.ts";
import { useState } from "preact/hooks";
import styled from "styled-components";

const Frame = styled.iframe`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	border: none;
	background: var(--settings-background);
`;

function accountPageUrl({ platform, logoUrl }: EnhancerAccountFrameProps): string {
	const url = new URL("/account.html", logoUrl);
	url.searchParams.set("platform", platform);
	if (document.documentElement.classList.contains("tw-root--theme-light")) url.searchParams.set("theme", "light");
	return url.toString();
}

export function EnhancerAccountFrame(props: EnhancerAccountFrameProps) {
	const [src] = useState(() => accountPageUrl(props));
	return <Frame src={src} title="Enhancer Account" />;
}
