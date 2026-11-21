import { execFileSync } from "node:child_process";
import { getCommitInfo } from "@changesets/get-github-info";

const PICKED_PATTERN = /^\(cherry picked from commit ([0-9a-f]{40})\)$/m;

// Cherry-picked release commits are unknown to GitHub, so look up the commit they were picked from.
const sourceCommit = (sha) =>
	execFileSync("git", ["log", "-1", "--format=%B", sha], { encoding: "utf8" }).match(PICKED_PATTERN)?.[1] ?? sha;

const credit = async (commit, repo) => {
	if (!commit || !repo) return "";
	try {
		const info = await getCommitInfo({ repo, commit: sourceCommit(commit) });
		const links = [info?.pull?.markdownLink, info?.author && `by ${info.author.markdownLink}`].filter(Boolean);
		return links.length ? ` (${links.join(" ")})` : "";
	} catch (error) {
		console.warn(`Could not find the pull request for ${commit.slice(0, 7)}: ${error.message}`);
		return "";
	}
};

export default {
	getReleaseLine: async (changeset, _type, options) => {
		const [firstLine, ...rest] = changeset.summary
			.trim()
			.split("\n")
			.map((line) => line.trimEnd());
		const details = rest.map((line) => (line ? `  ${line}` : line));
		return [`- ${firstLine}${await credit(changeset.commit, options?.repo)}`, ...details].join("\n");
	},
	getDependencyReleaseLine: async () => "",
};
