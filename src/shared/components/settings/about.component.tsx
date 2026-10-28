import { EXTENSION_NAME } from "$shared/extension.constants.ts";
import { DiagnosticLogsComponent } from "$shared/components/diagnostic-logs/diagnostic-logs.component.tsx";
import type { EnhancerAboutComponentProps } from "$types/shared/components/about.component.types.ts";
import styled from "styled-components";

const CONTRIBUTORS = ["igorovh", "czestereq", "d33zor", "kawre", "usermacieg", "kaedriz", "esteeming"];
const TESTERS = [
	"piotrgamerpl",
	"m0rtak_",
	"conki__",
	"grzegoryflorida",
	"jsdthe1st",
	"mxj1337",
	"h2p_ygus",
	"marekkk2007",
	"nowy_lepszy_silver",
	"plyta__",
	"kolegajakub_",
	"mrsono1212",
	"rqqn_",
	"x3te",
	"nyloniarz",
];
const SPECIAL_THANKS = ["lewus", "b3akers", "xyves"];

const LINKS = {
	website: "https://enhancer.at",
	github: "https://sh.enhancer.at/github",
	twitter: "https://sh.enhancer.at/twitter",
	discord: "https://sh.enhancer.at/dc",
	issues: "https://github.com/enhancer-app/enhancer/issues",
	privacy: "https://documents.enhancer.at/extension/privacy-policy/",
	thirdParties: "https://documents.enhancer.at/extension/third-parties/",
	email: "mailto:contact@enhancer.at",
};

const Container = styled.div`
	display: flex;
	flex-direction: column;
	gap: 32px;
`;

const Hero = styled.div`
	display: flex;
	align-items: center;
	gap: 18px;
`;

const Logo = styled.img`
	width: 64px;
	height: 64px;
	flex-shrink: 0;
	border-radius: 16px;
	box-shadow: 0 10px 30px var(--settings-glow);
`;

const HeroText = styled.div`
	flex: 1;
	min-width: 0;
`;

const Name = styled.div`
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: 10px;
	font-size: 20px;
	font-weight: 600;
	letter-spacing: -0.02em;
	color: var(--settings-text-primary);
`;

const Version = styled.span`
	font-size: 12.5px;
	font-weight: 500;
	letter-spacing: 0;
	color: var(--settings-text-muted);
	font-variant-numeric: tabular-nums;
`;

const Tagline = styled.div`
	margin-top: 4px;
	font-size: 13px;
	color: var(--settings-text-muted);
`;

const Links = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 12px;
`;

const LinkButton = styled.a`
	display: inline-flex;
	align-items: center;
	gap: 7px;
	height: 30px;
	padding: 0 11px;
	border-radius: 8px;
	background: var(--settings-surface-raised);
	box-shadow: inset 0 0 0 1px var(--settings-control-border);
	color: var(--settings-text-primary);
	font-size: 12.5px;
	font-weight: 500;
	text-decoration: none;
	white-space: nowrap;
	transition: background 0.12s ease;

	&:hover {
		background: var(--settings-surface-hover);
	}

	svg {
		flex-shrink: 0;
		color: var(--settings-text-muted);
		transition: color 0.12s ease;
	}

	&:hover svg {
		color: var(--settings-text-primary);
	}
`;

const SectionTitle = styled.h2`
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0 0 10px;
	font-size: 14px;
	font-weight: 600;
	letter-spacing: -0.01em;
	color: var(--settings-text-primary);

	&::before {
		content: "";
		width: 3px;
		height: 12px;
		border-radius: 2px;
		background: linear-gradient(180deg, var(--settings-accent-hover), var(--settings-accent));
	}
`;

const Card = styled.div`
	border-radius: 12px;
	overflow: hidden;
	background: linear-gradient(180deg, var(--settings-sheen), transparent 140px), var(--settings-surface);
	box-shadow:
		inset 0 0 0 1px var(--settings-border),
		inset 0 1px 0 var(--settings-highlight);
`;

const Row = styled.div<{ $stack?: boolean }>`
	display: flex;
	flex-direction: ${({ $stack }) => ($stack ? "column" : "row")};
	align-items: ${({ $stack }) => ($stack ? "stretch" : "center")};
	justify-content: space-between;
	gap: ${({ $stack }) => ($stack ? "10px" : "24px")};
	min-height: 60px;
	padding: 14px 18px;

	& + & {
		border-top: 1px solid var(--settings-divider);
	}
`;

const RowInfo = styled.div`
	flex: 1;
	min-width: 0;
`;

const RowTitle = styled.div`
	font-size: 14px;
	font-weight: 500;
	letter-spacing: -0.005em;
	color: var(--settings-text-strong);
`;

const RowDescription = styled.div`
	margin-top: 3px;
	font-size: 13px;
	line-height: 1.45;
	color: var(--settings-text-muted);
`;

const RowActions = styled.div`
	display: flex;
	flex-shrink: 0;
	gap: 8px;
`;

const ActionLink = styled.a`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 34px;
	padding: 0 14px;
	border-radius: 8px;
	background: var(--settings-surface-raised);
	box-shadow: inset 0 0 0 1px var(--settings-control-border);
	color: var(--settings-text-primary);
	font-size: 13px;
	font-weight: 500;
	text-decoration: none;
	white-space: nowrap;
	transition: background 0.12s ease;

	&:hover {
		background: var(--settings-surface-hover);
	}

	svg {
		color: var(--settings-text-muted);
	}
`;

const Names = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
`;

const NameChip = styled.span`
	display: inline-flex;
	align-items: center;
	height: 26px;
	padding: 0 10px;
	border-radius: 999px;
	background: var(--settings-surface-raised);
	box-shadow: inset 0 0 0 1px var(--settings-border);
	color: var(--settings-text-secondary);
	font-size: 12.5px;
`;

const brandIcon = (path: string) => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d={path} />
	</svg>
);

const WebsiteIcon = (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
		<path d="M2 12h20" />
	</svg>
);

const DiscordIcon = brandIcon(
	"M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.007.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z",
);

const GitHubIcon = brandIcon(
	"M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
);

const XIcon = brandIcon(
	"M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
);

const ExternalIcon = (
	<svg
		width="13"
		height="13"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M7 17 17 7" />
		<path d="M8 7h9v9" />
	</svg>
);

function External({ href, children }: { href: string; children: preact.ComponentChildren }) {
	return (
		<ActionLink href={href} target="_blank" rel="noopener noreferrer">
			{children}
			{ExternalIcon}
		</ActionLink>
	);
}

function CreditRow({ title, names }: { title: string; names: string[] }) {
	return (
		<Row $stack>
			<RowTitle>{title}</RowTitle>
			<Names>
				{names.map((name) => (
					<NameChip key={name}>{name}</NameChip>
				))}
			</Names>
		</Row>
	);
}

export function EnhancerAboutComponent({ platform, workerService, logoUrl }: EnhancerAboutComponentProps) {
	return (
		<Container>
			<Hero>
				<Logo src={logoUrl} alt="" />
				<HeroText>
					<Name>
						{EXTENSION_NAME}
						<Version>v{__version__}</Version>
					</Name>
					<Tagline>Free, open-source add-ons for Twitch and Kick.</Tagline>
					<Links>
						<LinkButton href={LINKS.website} target="_blank" rel="noopener noreferrer">
							{WebsiteIcon}
							Website
						</LinkButton>
						<LinkButton href={LINKS.discord} target="_blank" rel="noopener noreferrer">
							{DiscordIcon}
							Discord
						</LinkButton>
						<LinkButton href={LINKS.github} target="_blank" rel="noopener noreferrer">
							{GitHubIcon}
							GitHub
						</LinkButton>
						<LinkButton href={LINKS.twitter} target="_blank" rel="noopener noreferrer">
							{XIcon}X
						</LinkButton>
					</Links>
				</HeroText>
			</Hero>

			<section>
				<SectionTitle>Help</SectionTitle>
				<Card>
					<Row>
						<RowInfo>
							<RowTitle>Report a problem</RowTitle>
							<RowDescription>Tell us on Discord or GitHub.</RowDescription>
						</RowInfo>
						<RowActions>
							<External href={LINKS.discord}>Discord</External>
							<External href={LINKS.issues}>GitHub</External>
						</RowActions>
					</Row>
					<Row>
						<RowInfo>
							<RowTitle>Logs</RowTitle>
							<RowDescription>Add them to your report so we can find the cause.</RowDescription>
						</RowInfo>
						<DiagnosticLogsComponent platform={platform} workerService={workerService} />
					</Row>
				</Card>
			</section>

			<section>
				<SectionTitle>Privacy</SectionTitle>
				<Card>
					<Row>
						<RowInfo>
							<RowTitle>Privacy policy</RowTitle>
							<RowDescription>What data Enhancer uses and why.</RowDescription>
						</RowInfo>
						<External href={LINKS.privacy}>Open</External>
					</Row>
					<Row>
						<RowInfo>
							<RowTitle>Third-party services</RowTitle>
							<RowDescription>Services Enhancer connects to for some features.</RowDescription>
						</RowInfo>
						<External href={LINKS.thirdParties}>Open</External>
					</Row>
					<Row>
						<RowInfo>
							<RowTitle>Contact</RowTitle>
							<RowDescription>contact@enhancer.at</RowDescription>
						</RowInfo>
						<ActionLink href={LINKS.email}>Email us</ActionLink>
					</Row>
				</Card>
			</section>

			<section>
				<SectionTitle>Credits</SectionTitle>
				<Card>
					<CreditRow title="Contributors" names={CONTRIBUTORS} />
					<CreditRow title="Testers" names={TESTERS} />
					<CreditRow title="Special thanks" names={SPECIAL_THANKS} />
				</Card>
			</section>
		</Container>
	);
}
