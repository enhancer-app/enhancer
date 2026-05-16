import styled from "styled-components";

const Container = styled.div`
	padding: 0;
	line-height: 1.6;
	color: #ccc;
	width: 100%;
	max-width: none;
`;

const Header = styled.div`
	text-align: center;
	margin-bottom: 40px;
	padding: 30px 40px;
	background: linear-gradient(135deg, rgba(145, 71, 255, 0.1) 0%, rgba(145, 71, 255, 0.05) 100%);
	border-radius: 12px;
	border: 1px solid rgba(145, 71, 255, 0.2);
`;

const Title = styled.h1`
	color: #9147ff;
	margin: 0 0 12px 0;
	font-size: 30px;
	font-weight: 700;
	text-shadow: 0 0 20px rgba(145, 71, 255, 0.3);
`;

const Subtitle = styled.p`
	font-size: 13px;
	margin: 0 0 16px 0;
	color: #e0e0e0;
	opacity: 0.9;
`;

const VersionBadge = styled.div`
	display: inline-block;
	background: rgba(145, 71, 255, 0.2);
	color: #9147ff;
	padding: 9px 22px;
	border-radius: 20px;
	font-size: 11px;
	font-weight: 600;
	border: 1px solid rgba(145, 71, 255, 0.3);
`;

const Section = styled.div`
	padding: 0 20px;
`;

const SectionTitle = styled.h2`
	color: #9147ff;
	margin: 0 0 20px 0;
	font-size: 18px;
	font-weight: 600;
	display: flex;
	align-items: center;
	gap: 8px;

	&::before {
		content: '';
		width: 4px;
		height: 22px;
		background: linear-gradient(to bottom, #9147ff, #b147ff);
		border-radius: 2px;
	}
`;

const SubSectionTitle = styled.h3`
	margin: 26px 0 14px 0;
	color: #fff;
	font-size: 13.5px;
	font-weight: 500;
`;

const Description = styled.p`
	margin-bottom: 22px;
	color: #ccc;
	font-size: 11px;
`;

const ContributorGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	gap: 12px;
	margin-bottom: 22px;
`;

const ContributorTag = styled.div`
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	padding: 12px 16px;
	border-radius: 8px;
	font-size: 10px;
	color: #e0e0e0;
	text-align: center;
	transition: all 0.2s ease;

	&:hover {
		background: rgba(145, 71, 255, 0.1);
		border-color: rgba(145, 71, 255, 0.3);
		color: #fff;
		transform: translateY(-1px);
	}
`;

const SocialSection = styled.div`
	background: rgba(255, 255, 255, 0.02);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	padding: 26px;
	margin: 34px 20px 32px 20px;
`;

const SocialLinksContainer = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
	gap: 16px;
	margin-top: 18px;
`;

const SocialLink = styled.a`
	color: #9147ff;
	text-decoration: none;
	display: flex;
	align-items: center;
	font-size: 11px;
	padding: 15px 20px;
	background: rgba(145, 71, 255, 0.05);
	border: 1px solid rgba(145, 71, 255, 0.2);
	border-radius: 8px;
	transition: all 0.2s ease;

	&:hover {
		background: rgba(145, 71, 255, 0.1);
		border-color: rgba(145, 71, 255, 0.4);
		transform: translateY(-1px);
		text-decoration: none;
	}
`;

const IconImage = styled.img`
	width: 24px;
	height: 24px;
	margin-right: 12px;
	filter: brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(4577%) hue-rotate(252deg) brightness(101%)
	contrast(101%);
`;

const _SmallText = styled.p`
	font-size: 10px;
	color: #999;
	margin: 26px 20px 0 20px;
	text-align: center;
	font-style: italic;
`;

const BugReportText = styled.p`
	margin-bottom: 18px;
	color: #ccc;
	font-size: 11px;
`;

interface EnhancerAboutComponentProps {
	icons: {
		website: string;
		github: string;
		twitter: string;
		discord: string;
		email: string;
	};
}

export function EnhancerAboutComponent({ icons }: EnhancerAboutComponentProps) {
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

			<SocialSection>
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
					<SocialLink href="mailto:contact@enhancer.at">
						<IconImage src={icons.email} alt="Email" />
						contact@enhancer.at
					</SocialLink>
				</SocialLinksContainer>
			</SocialSection>

			<Section>
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
			</Section>
		</Container>
	);
}
