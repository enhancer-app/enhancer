import { spawnSync } from "node:child_process";
import {
	allowActionsToCreatePullRequests,
	configureEnvironments,
	configureRulesets,
	ensureBranch,
	gh,
	REPO,
} from "./release-github";

if (process.argv.includes("--help")) {
	console.log(`Prepare the stable and canary release branches in ${REPO}.

Usage:
  bun run release:setup-branches

Creates the stable and canary branches from the latest v* tag if they are missing, protects them with
merge-commit-only rulesets, allows only squash on the default branch (the enhancer-release app bypasses it
to merge the sync PR), and limits the release environment to stable and canary and release-announce to stable.`);
	process.exit(0);
}

function latestReleaseSha(): { tag: string; sha: string } {
	spawnSync("git", ["fetch", "--tags", "--quiet", "origin"], { stdio: "inherit" });
	const tag = spawnSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], { encoding: "utf8" })
		.stdout.split("\n")
		.find(Boolean);
	if (!tag) throw new Error("No v* tag found.");
	const sha = spawnSync("git", ["rev-list", "-n", "1", tag], { encoding: "utf8" }).stdout.trim();
	return { tag, sha };
}

function main(): void {
	if (spawnSync("gh", ["auth", "status", "-h", "github.com"], { stdio: "ignore" }).status !== 0) {
		throw new Error("Log in to GitHub CLI first: gh auth login");
	}
	gh(["api", `repos/${REPO}`, "-X", "PATCH", "-F", "allow_merge_commit=true"]);
	allowActionsToCreatePullRequests();

	const { tag, sha } = latestReleaseSha();
	console.log(`Latest release: ${tag}`);
	ensureBranch("stable", sha);
	ensureBranch("canary", sha);
	configureRulesets();
	configureEnvironments();
}

try {
	main();
} catch (error) {
	console.error((error as Error).message);
	process.exitCode = 1;
}
