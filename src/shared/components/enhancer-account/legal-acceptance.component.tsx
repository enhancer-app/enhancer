import type { LegalAcceptanceScreenProps } from "$types/shared/components/enhancer-account.component.types.ts";
import { useState } from "preact/hooks";
import styled from "styled-components";

const DOCUMENTS_URL = "https://documents.enhancer.at/dashboard";

const DOCUMENTS: Record<string, { title: string; path: string }> = {
	TERMS: { title: "Terms of Service", path: "terms-of-service" },
	PRIVACY: { title: "Privacy Policy", path: "privacy-policy" },
};

const Page = styled.div`
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100%;
	padding: 48px 56px;
	background: radial-gradient(520px 360px at 50% 30%, rgba(145, 71, 255, 0.22), transparent 70%);
`;

const Main = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
	max-width: 420px;
	text-align: center;
`;

const Mark = styled.div`
	display: grid;
	place-items: center;
	width: 64px;
	height: 64px;
	border-radius: 18px;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);

	img {
		width: 40px;
		height: 40px;
		border-radius: 10px;
	}
`;

const Eyebrow = styled.p`
	margin: 22px 0 0;
	font-size: 11.5px;
	font-weight: 600;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--settings-accent, #9147ff);
`;

const Title = styled.h2`
	margin: 8px 0 0;
	font-size: 24px;
	font-weight: 600;
	letter-spacing: -0.03em;
	color: var(--settings-text-primary);
`;

const Lead = styled.p`
	margin: 10px 0 22px;
	font-size: 14px;
	line-height: 1.5;
	color: var(--settings-text-secondary);
`;

const Documents = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 100%;
`;

const DocumentLink = styled.a`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 14px;
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	background: var(--settings-surface);
	color: var(--settings-text);
	text-align: left;
	text-decoration: none;

	&:hover {
		border-color: var(--settings-text-faint);
	}

	strong {
		display: block;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--settings-text-strong);
	}

	span {
		font-size: 12px;
		color: var(--settings-text-muted);
	}

	svg {
		width: 14px;
		height: 14px;
		margin-left: auto;
		flex-shrink: 0;
		color: var(--settings-text-muted);
	}
`;

const Consent = styled.label`
	display: flex;
	align-items: flex-start;
	gap: 10px;
	width: 100%;
	margin: 18px 0 14px;
	font-size: 13px;
	line-height: 1.45;
	text-align: left;
	color: var(--settings-text);
	cursor: pointer;

	input {
		margin: 2px 0 0;
		accent-color: #9147ff;
		flex-shrink: 0;
	}
`;

const AcceptButton = styled.button`
	width: 100%;
	height: 44px;
	border: none;
	border-radius: 12px;
	background: var(--settings-accent, #9147ff);
	color: #ffffff;
	font: inherit;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;

	&:hover:not(:disabled) {
		background: var(--settings-accent-hover, #a970ff);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const ErrorText = styled.p`
	margin: 0 0 12px;
	font-size: 12.5px;
	color: var(--settings-danger, #ff4757);
`;

const Footer = styled.div`
	display: flex;
	justify-content: center;
	gap: 8px;
	margin-top: 20px;
	font-size: 12.5px;
	color: var(--settings-text-faint);

	a,
	button {
		padding: 0;
		border: none;
		background: none;
		color: var(--settings-text-muted);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	a:hover,
	button:hover:not(:disabled) {
		color: var(--settings-text-primary);
	}
`;

function documentInfo(document: string) {
	return DOCUMENTS[document] ?? { title: document, path: "" };
}

export function LegalAcceptanceScreen({
	logoUrl,
	pending,
	dashboardUrl,
	busy,
	onAccept,
	onLogout,
}: LegalAcceptanceScreenProps) {
	const [agreed, setAgreed] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const names = pending.map((item) => documentInfo(item.document).title);

	const accept = async () => {
		setSaving(true);
		setError(null);
		const message = await onAccept();
		setError(message);
		setSaving(false);
	};

	return (
		<Page>
			<Main>
				{logoUrl && (
					<Mark>
						<img src={logoUrl} alt="" />
					</Mark>
				)}
				<Eyebrow>Before you continue</Eyebrow>
				<Title>Review our updated documents</Title>
				<Lead>
					We updated how we describe the service and handle your data. Open each document, then confirm to keep using
					your Enhancer account.
				</Lead>
				<Documents>
					{pending.map((item) => {
						const info = documentInfo(item.document);
						return (
							<DocumentLink
								key={item.document}
								href={`${DOCUMENTS_URL}/${info.path}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<div>
									<strong>{info.title}</strong>
									<span>Version {item.version}</span>
								</div>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
									<path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
								</svg>
							</DocumentLink>
						);
					})}
				</Documents>
				<Consent>
					<input
						type="checkbox"
						checked={agreed}
						disabled={saving}
						onChange={(event) => setAgreed(event.currentTarget.checked)}
					/>
					I have read and accept the {names.join(" and the ")}.
				</Consent>
				{error && <ErrorText>{error}</ErrorText>}
				<AcceptButton type="button" disabled={!agreed || saving || busy} onClick={accept}>
					{saving ? "Saving…" : "Accept and continue"}
				</AcceptButton>
				<Footer>
					<button type="button" onClick={onLogout} disabled={saving || busy}>
						Log out
					</button>
					<span>·</span>
					<a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
						Don't agree?
					</a>
				</Footer>
			</Main>
		</Page>
	);
}
