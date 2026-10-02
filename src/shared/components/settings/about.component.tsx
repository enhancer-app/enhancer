import { DiagnosticLogsComponent } from "$shared/components/diagnostic-logs/diagnostic-logs.component.tsx";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import styled from "styled-components";

const Container = styled.div`
	padding: 0;
	line-height: 1.6;
	color: var(--settings-text);
	width: 100%;
	max-width: none;
	display: flex;
	flex-direction: column;
	gap: 20px;
`;

const Header = styled.div`
	text-align: center;
	padding: 28px 32px;
	background: var(--settings-surface);
	border-radius: 12px;
	border: 1px solid var(--settings-border);
	position: relative;
	overflow: hidden;

	&::before {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 100%;
		background: radial-gradient(circle 260px at 50% 0%, rgba(145, 71, 255, 0.12), transparent 70%);
		pointer-events: none;
	}
`;

const Title = styled.h1`
	color: var(--settings-text-primary);
	margin: 0 0 8px 0;
	font-size: 24px;
	font-weight: 700;
	position: relative;
`;

const Subtitle = styled.p`
	font-size: 12px;
	margin: 0 0 16px 0;
	color: var(--settings-text-secondary);
	position: relative;
`;

const VersionBadge = styled.div`
	display: inline-block;
	background: rgba(145, 71, 255, 0.14);
	color: #9147ff;
	padding: 6px 16px;
	border-radius: 20px;
	font-size: 11px;
	font-weight: 600;
	border: 1px solid rgba(145, 71, 255, 0.3);
	position: relative;
`;

const Card = styled.div`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	padding: 20px;
`;

const SectionTitle = styled.h2`
	color: var(--settings-text-primary);
	margin: 0 0 6px 0;
	font-size: 15px;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 8px;

	&::before {
		content: "";
		width: 3px;
		height: 16px;
		background: #9147ff;
		border-radius: 2px;
	}
`;

const SubSectionTitle = styled.h3`
	margin: 22px 0 12px 0;
	color: var(--settings-text-strong);
	font-size: 12.5px;
	font-weight: 600;
`;

const Description = styled.p`
	margin: 0 0 18px;
	color: var(--settings-text-muted);
	font-size: 11.5px;
`;

const PrivacyDescription = styled(Description)`
	margin-top: 12px;
`;

const DocLink = styled.a`
	color: #9147ff;
	font-weight: 600;
	text-decoration: none;

	&:hover {
		text-decoration: underline;
	}
`;

const ContributorGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	gap: 8px;
`;

const ContributorTag = styled.div`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-border);
	padding: 10px 14px;
	border-radius: 8px;
	font-size: 10.5px;
	color: var(--settings-text);
	text-align: center;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: rgba(145, 71, 255, 0.4);
		color: #9147ff;
	}
`;

const SocialLinksContainer = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 10px;
	margin-top: 16px;
`;

const SocialLink = styled.a`
	color: var(--settings-text);
	text-decoration: none;
	display: flex;
	align-items: center;
	font-size: 11px;
	font-weight: 500;
	padding: 13px 16px;
	background: var(--settings-control-background);
	border: 1px solid var(--settings-border);
	border-radius: 8px;
	transition:
		border-color 0.15s ease,
		color 0.15s ease;

	&:hover {
		border-color: rgba(145, 71, 255, 0.4);
		color: #9147ff;
		text-decoration: none;
	}
`;

const IconImage = styled.img`
	width: 20px;
	height: 20px;
	margin-right: 12px;
	filter: brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(4577%) hue-rotate(252deg) brightness(101%)
		contrast(101%);
`;

const BugReportText = styled.p`
	margin: 0;
	color: var(--settings-text-muted);
	font-size: 11.5px;
`;

const DiagnosticsRow = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20px;
`;

const DiagnosticsInfo = styled.div`
	flex: 1;
	min-width: 0;
`;

const DiagnosticsDescription = styled(Description)`
	margin-bottom: 0;
`;

interface EnhancerAboutComponentProps {
	platform: PlatformType;
	workerService: WorkerService;
	icons: {
		website: string;
		github: string;
		twitter: string;
		discord: string;
	};
}

export function EnhancerAboutComponent({ platform, workerService, icons }: EnhancerAboutComponentProps) {
	const contributors = ["igorovh", "czestereq", "d33zor", "kawre", "usermacieg", "kaedriz", "esteeming"];

	const testers = [
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

	const specialThanks = ["lewus", "b3akers", "xyves"];

	return (
		<Container>
			<Header>
				<Title>Enhancer</Title>
				<Subtitle>Open-source extension that adds missing features to streaming platforms</Subtitle>
				<VersionBadge>Version {__version__}</VersionBadge>
			</Header>

			<Card>
				<SectionTitle>Get in Touch</SectionTitle>
				<BugReportText>
					Found a bug or have a suggestion? We'd love to hear from you! Report issues on GitHub or join our Discord
					community.
				</BugReportText>

				<SocialLinksContainer>
					<SocialLink href="https://enhancer.at" target="_blank" rel="noopener noreferrer">
						<IconImage src={icons.website} alt="Website" />
						Website
					</SocialLink>
					<SocialLink href="https://sh.enhancer.at/github" target="_blank" rel="noopener noreferrer">
						<IconImage src={icons.github} alt="GitHub" />
						GitHub
					</SocialLink>
					<SocialLink href="https://sh.enhancer.at/twitter" target="_blank" rel="noopener noreferrer">
						<IconImage src={icons.twitter} alt="X (Twitter)" />X (Twitter)
					</SocialLink>
					<SocialLink href="https://sh.enhancer.at/dc" target="_blank" rel="noopener noreferrer">
						<IconImage src={icons.discord} alt="Discord" />
						Discord
					</SocialLink>
				</SocialLinksContainer>
			</Card>

			<Card>
				<DiagnosticsRow>
					<DiagnosticsInfo>
						<SectionTitle>Diagnostics</SectionTitle>
						<DiagnosticsDescription>Export recent logs when reporting a problem with Enhancer.</DiagnosticsDescription>
					</DiagnosticsInfo>
					<DiagnosticLogsComponent platform={platform} workerService={workerService} />
				</DiagnosticsRow>
			</Card>

			<Card>
				<SectionTitle>Acknowledgements</SectionTitle>
				<Description>Thanks to everyone who helped make this extension possible:</Description>

				<SubSectionTitle>Contributors</SubSectionTitle>
				<ContributorGrid>
					{contributors.map((contributor) => (
						<ContributorTag key={contributor}>{contributor}</ContributorTag>
					))}
				</ContributorGrid>

				<SubSectionTitle>Testers</SubSectionTitle>
				<ContributorGrid>
					{testers.map((tester) => (
						<ContributorTag key={tester}>{tester}</ContributorTag>
					))}
				</ContributorGrid>

				<SubSectionTitle>Special Thanks</SubSectionTitle>
				<ContributorGrid>
					{specialThanks.map((person) => (
						<ContributorTag key={person}>{person}</ContributorTag>
					))}
				</ContributorGrid>
			</Card>

			<Card>
				<SectionTitle>Privacy &amp; Data</SectionTitle>
				<PrivacyDescription>
					Enhancer may connect to external services depending on the platform and enabled features. See how we handle
					your data in our{" "}
					<DocLink
						href="https://documents.enhancer.at/extension/privacy-policy/"
						target="_blank"
						rel="noopener noreferrer"
					>
						privacy policy
					</DocLink>{" "}
					and which services we use in our{" "}
					<DocLink
						href="https://documents.enhancer.at/extension/third-parties/"
						target="_blank"
						rel="noopener noreferrer"
					>
						third-party overview
					</DocLink>
					.
				</PrivacyDescription>

				<Description>
					If you have any questions, feel free to contact us at{" "}
					<DocLink href="mailto:contact@enhancer.at">contact@enhancer.at</DocLink>.
				</Description>
			</Card>
		</Container>
	);
}
