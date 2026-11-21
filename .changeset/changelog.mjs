import { execFileSync } from "node:child_process";
import { getCommitInfo, getPullRequestInfo } from "@changesets/get-github-info";

const PICKED_PATTERN = /^\(cherry picked from commit ([0-9a-f]{40})\)$/m;
const PULL_PATTERN = /^pr:\s*#?(\d+)$/i;

// Cherry-picked release commits are unknown to GitHub, so look up the commit they were picked from.
const sourceCommit = (sha) =>
	execFileSync("git", ["log", "-1", "--format=%B", sha], { encoding: "utf8" }).match(PICKED_PATTERN)?.[1] ?? sha;

const credit = async ({ commit, pull }, repo) => {
	if ((!commit && !pull) || !repo) return "";
	try {
		const info = pull
			? await getPullRequestInfo({ repo, pull })
			: await getCommitInfo({ repo, commit: sourceCommit(commit) });
		const links = [info?.pull?.markdownLink, info?.author && `by ${info.author.markdownLink}`].filter(Boolean);
		return links.length ? ` (${links.join(" ")})` : "";
	} catch (error) {
		console.warn(`Could not find the pull request for ${pull ? `#${pull}` : commit.slice(0, 7)}: ${error.message}`);
		return "";
	}
};

export default {
	getReleaseLine: async (changeset, _type, options) => {
		let lines = changeset.summary
			.trim()
			.split("\n")
			.map((line) => line.trimEnd());
		const pull = Number(lines[0].match(PULL_PATTERN)?.[1]) || undefined;
		if (pull) lines = lines.slice(1).join("\n").trim().split("\n");
		const [firstLine, ...rest] = lines;
		const details = rest.map((line) => (line ? `  ${line}` : line));
		return [`- ${firstLine}${await credit({ commit: changeset.commit, pull }, options?.repo)}`, ...details].join("\n");
	},
	getDependencyReleaseLine: async () => "",
};
