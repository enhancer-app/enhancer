const LEVELS = ["patch", "minor", "major"];
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?([\s\S]*)$/;
const RELEASE_PATTERN = /^\s*["']?enhancer["']?\s*:\s*(patch|minor|major)\s*$/m;
const DISCORD_HEADINGS = {
	"Major Changes": "Breaking changes",
	"Minor Changes": "New",
	"Patch Changes": "Fixes and improvements",
};

const isChangesetFile = (path) => /^\.changeset\/[^/]+\.md$/.test(path) && path !== ".changeset/README.md";

const parseChangeset = (content) => {
	const match = content.match(FRONTMATTER_PATTERN);
	if (!match) return null;
	return { level: match[1].match(RELEASE_PATTERN)?.[1] ?? null, summary: match[2].trim() };
};

const highestLevel = (levels) =>
	levels.reduce((highest, level) => (LEVELS.indexOf(level) > LEVELS.indexOf(highest) ? level : highest), null);

const changelogSection = (changelog, version) => {
	const lines = (changelog ?? "").split("\n");
	const start = lines.findIndex((line) => line.trim() === `## ${version}`);
	if (start === -1) return null;
	const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
	return (
		lines
			.slice(start + 1, end === -1 ? undefined : end)
			.join("\n")
			.trim() || null
	);
};

const renderChangesets = (changesets) =>
	[...LEVELS]
		.reverse()
		.map((level) => {
			const lines = changesets.filter((changeset) => changeset.level === level && changeset.summary);
			if (!lines.length) return null;
			const heading = `### ${level[0].toUpperCase()}${level.slice(1)} Changes`;
			return [heading, "", ...lines.map(({ summary }) => `- ${summary.replace(/\n/g, "\n  ")}`)].join("\n");
		})
		.filter(Boolean)
		.join("\n\n");

const toDiscord = (section) =>
	section
		.replace(/^### (.+)$/gm, (_, heading) => `**${DISCORD_HEADINGS[heading] ?? heading}**`)
		.replace(/\]\((https?:\/\/[^)\s]+)\)/g, "](<$1>)")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

module.exports = {
	isChangesetFile,
	parseChangeset,
	highestLevel,
	changelogSection,
	renderChangesets,
	toDiscord,
};
