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

const Disclosure = styled.details`
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	overflow: hidden;
`;

const DisclosureSummary = styled.summary`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	padding: 20px;
	cursor: pointer;
	list-style: none;

	&::-webkit-details-marker {
		display: none;
	}

	&:hover > span:first-child {
		color: #9147ff;
	}
`;

const DisclosureTitle = styled.span`
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--settings-text-primary);
	font-size: 15px;
	font-weight: 600;
	line-height: 1;
	transition: color 0.15s ease;

	&::before {
		content: "";
		width: 3px;
		height: 16px;
		background: #9147ff;
		border-radius: 2px;
	}
`;

const DisclosureHint = styled.span`
	display: flex;
	align-items: center;
	color: var(--settings-text-muted);
	font-size: 11px;
	line-height: 1;
	flex-shrink: 0;

	&::after {
		content: "+";
		color: #9147ff;
		font-size: 16px;
		margin-left: 8px;
	}

	${Disclosure}[open] &::after {
		content: "-";
	}
`;

const DisclosureContent = styled.div`
	border-top: 1px solid var(--settings-border);
	padding: 16px 20px 20px;
	color: var(--settings-text-muted);
	font-size: 11.5px;
	line-height: 1.6;

	p {
		margin: 0;
	}

	p + p {
		margin-top: 12px;
	}

	p + ul {
		margin-top: 18px;
	}
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
		content: '';
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

const ServiceList = styled.ul`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 10px;
	margin: 0;
	padding: 0;
	list-style: none;
`;

const ServiceItem = styled.li`
	padding: 14px;
	background: var(--settings-control-background);
	border: 1px solid var(--settings-border);
	border-radius: 8px;
	transition: border-color 0.15s ease;

	&:hover {
		border-color: var(--settings-control-border);
	}

	a {
		color: #9147ff;
		font-size: 11px;
		font-weight: 600;
		text-decoration: none;
	}

	p {
		margin: 6px 0 0;
		color: var(--settings-text-muted);
		font-size: 10px;
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
	transition: border-color 0.15s ease, color 0.15s ease;

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
	transition: border-color 0.15s ease, color 0.15s ease;

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

interface EnhancerAboutComponentProps {
	icons: {
		website: string;
		github: string;
		twitter: string;
		discord: string;
	};
}

export function EnhancerAboutComponent({ icons }: EnhancerAboutComponentProps) {
	const externalServices = [
		{
			name: "api.enhancer.at",
			url: "https://api.enhancer.at",
			description: "Enhancer's backend for custom badges, nickname customizations, and real-time extension data.",
		},
		{
			name: "xayo.pl",
			url: "https://xayo.pl",
			description: "Retrieves viewer watchtime for Polish Twitch channels when Usercard Watchtime is enabled.",
		},
		{
			name: "gql.twitch.tv",
			url: "https://gql.twitch.tv/gql",
			description: "Twitch's API for feature data such as chatter counts and VOD timestamps.",
		},
		{
			name: "kick.com/api/v2",
			url: "https://kick.com/api/v2",
			description: "Kick's API for channel information used by Kick features.",
		},
		{
			name: "corsgo.enhancer.at",
			url: "https://corsgo.enhancer.at",
			description: "Loads metadata for supported chat image links when the source blocks browser requests.",
		},
		{
			name: "preview.enhancer.at",
			url: "https://preview.enhancer.at",
			description: "Resolves previews for Discord cached image links when chat images are enabled.",
		},
		{
			name: "Google Fonts",
			url: "https://fonts.google.com",
			description: "Loads optional custom fonts when Additional Fonts is enabled.",
		},
	];
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

			<Disclosure>
				<DisclosureSummary>
					<DisclosureTitle>External APIs and Services</DisclosureTitle>
					<DisclosureHint>View details</DisclosureHint>
				</DisclosureSummary>
				<DisclosureContent>
					<Description>Depending on the platform and enabled features, Enhancer uses these services:</Description>
					<ServiceList>
						{externalServices.map((service) => (
							<ServiceItem key={service.name}>
								<a href={service.url} target="_blank" rel="noopener noreferrer">
									{service.name}
								</a>
								<p>{service.description}</p>
							</ServiceItem>
						))}
					</ServiceList>
				</DisclosureContent>
			</Disclosure>

			<Disclosure>
				<DisclosureSummary>
					<DisclosureTitle>Privacy &amp; data</DisclosureTitle>
					<DisclosureHint>View details</DisclosureHint>
				</DisclosureSummary>
				<DisclosureContent>
					<p>
						Enhancer connects to our API to provide data required by some features. During a connection, we process
						limited technical information such as the extension version and connection source type. The country may be
						inferred from the connection IP address.
					</p>
					<p>
						Enhancer does not store IP addresses or use them for profiling, advertising, or identifying users. An IP
						address may only be processed temporarily to determine the country and to prevent abuse or excessive
						connections. It is not stored in user-facing metrics.
					</p>
					<p>
						Technical information may be used in aggregated statistics for compatibility, security, and service
						performance monitoring, and retained according to the monitoring system&apos;s retention period.
					</p>
				</DisclosureContent>
			</Disclosure>
		</Container>
	);
}
