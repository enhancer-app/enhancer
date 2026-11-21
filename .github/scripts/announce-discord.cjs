const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { isChangesetFile, parseChangeset, changelogSection, renderChangesets, toDiscord } = require("./changelog.cjs");

const NOTHING_USER_FACING = "- Bug fixes and stability improvements";
const MAX_MESSAGE_LENGTH = 2000;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

// Canary ships master, whose changesets are only versioned by the next stable release.
const pendingChangesets = (from, to) =>
	git("diff", "--diff-filter=A", "--name-only", from, to, "--", ".changeset")
		.split("\n")
		.filter(isChangesetFile)
		.map((path) => parseChangeset(git("show", `${to}:${path}`)))
		.filter(Boolean);

const releaseSection = (version) =>
	changelogSection(existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8") : "", version.replace(/^v/, ""));

module.exports = async ({ core }) => {
	for (const name of ["DISCORD_CHANGELOG_WEBHOOK", "VERSION"]) {
		if (!process.env[name]) {
			core.setFailed(`Missing required environment variable: ${name}`);
			return;
		}
	}
	core.setSecret(process.env.DISCORD_CHANGELOG_WEBHOOK);

	const { VERSION: version, PREVIOUS_TAG: previousTag } = process.env;
	const canary = process.env.CHANNEL === "canary";
	const section = canary
		? previousTag && renderChangesets(pendingChangesets(previousTag, "HEAD"))
		: releaseSection(version);
	const notes = section ? toDiscord(section) : NOTHING_USER_FACING;
	const heading = canary ? `Enhancer Canary changelog ${version}` : `Changelog ${version}`;
	let message = `**${heading}**\n\n${notes}`;
	if (message.length > MAX_MESSAGE_LENGTH) message = `${message.slice(0, MAX_MESSAGE_LENGTH - 3)}...`;
	core.info(message);

	const discordResponse = await fetch(process.env.DISCORD_CHANGELOG_WEBHOOK, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: "Enhancer Releases", allowed_mentions: { parse: [] }, content: message }),
	});
	if (!discordResponse.ok) throw new Error(`Discord webhook failed with status ${discordResponse.status}.`);
};
