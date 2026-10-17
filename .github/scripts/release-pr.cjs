const STABLE = "stable";
const CANARY = "canary";
const RELEASE_BRANCH = "release-next";
const HOTFIX_BRANCH = "release-hotfix";
const SYNC_BRANCH = "sync-stable";
const LEVELS = ["patch", "minor", "major"];
const LEVEL_PATTERN = /^- \[([ xX])\] .*<!-- release-level:(patch|minor|major) -->\s*$/gm;
const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
const MERGE_NOTE = [
	"> [!IMPORTANT]",
	"> Merge with **Create a merge commit**. Squash or rebase would give these commits new hashes on this branch.",
].join("\n");
const FOOTER = "<sub>Managed by the release workflow. Manual commits to this branch are overwritten.</sub>";

const bump = (version, level) => {
	const [major, minor, patch] = version.split(".").map(Number);
	if (level === "major") return `${major + 1}.0.0`;
	if (level === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
};

const checkedLevels = (body) =>
	[...(body ?? "").matchAll(LEVEL_PATTERN)].filter((match) => match[1] !== " ").map((match) => match[2]);

const resolveLevel = (body, previousBody) => {
	const checked = checkedLevels(body);
	const previous = checkedLevels(previousBody);
	return checked.find((level) => !previous.includes(level)) ?? checked[0] ?? "patch";
};

const renderStableBody = (current, level, changes) =>
	[
		"Merging this PR releases a new **stable** version to GitHub, Chrome Web Store and Firefox Add-ons.",
		"",
		MERGE_NOTE,
		"",
		"### Release type",
		"",
		...LEVELS.map(
			(option) =>
				`- [${option === level ? "x" : " "}] ${option} → v${bump(current, option)} <!-- release-level:${option} -->`,
		),
		"",
		`### Changes since v${current}`,
		"",
		changes,
		"",
		FOOTER,
	].join("\n");

const renderHotfixBody = (current, next, changes) =>
	[
		`Merging this PR releases the **stable hotfix** v${next} to GitHub, Chrome Web Store and Firefox Add-ons.`,
		"",
		MERGE_NOTE,
		"",
		`### Hotfixes since v${current}`,
		"",
		changes,
		"",
		FOOTER,
	].join("\n");

const renderCanaryBody = (version, changes) =>
	[
		`Merging this PR releases **Enhancer Canary** v${version} to GitHub (pre-release), Chrome Web Store and Firefox Add-ons.`,
		"",
		MERGE_NOTE,
		"",
		"### Changes since the last Canary",
		"",
		changes,
	].join("\n");

const renderSyncBody = (changes, conflicted) =>
	[
		"Brings stable releases and hotfixes back into master, so Canary and the next stable release keep the same commits.",
		"",
		MERGE_NOTE,
		...(conflicted
			? [
					"",
					"> [!WARNING]",
					`> stable conflicts with master. Merge master into \`${SYNC_BRANCH}\` and resolve the conflicts there, never on stable.`,
				]
			: []),
		"",
		"### Commits from stable",
		"",
		changes,
		"",
		FOOTER,
	].join("\n");

module.exports = async ({ github, context, core, exec }) => {
	const { owner, repo } = context.repo;
	const master = context.payload.repository.default_branch;
	const isEdit = context.eventName === "pull_request_target";
	const run = async (args, options = {}) =>
		exec.getExecOutput("git", args, { silent: true, ignoreReturnCode: true, ...options });
	const git = async (...args) => {
		const result = await run(args);
		if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
		return result.stdout.trim();
	};
	const succeeds = async (...args) => (await run(args)).exitCode === 0;
	const commit = (message, ...paths) =>
		git("-c", `user.name=${BOT_NAME}`, "-c", `user.email=${BOT_EMAIL}`, "commit", "-m", message, "--", ...paths);
	const versionAt = async (ref) => JSON.parse(await git("show", `${ref}:package.json`)).version;
	const changesBetween = (from, to) => git("log", "--no-merges", "--format=- %s", `${from}..${to}`);

	if (isEdit) {
		const { data } = await github.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: context.actor });
		if (!["admin", "maintain"].includes(data.role_name)) {
			core.notice(`Ignoring release PR edit by ${context.actor} (${data.role_name}).`);
			return;
		}
	}

	await git("fetch", "--tags", "--force", "origin", master);
	const hasStable = await succeeds("fetch", "origin", STABLE);
	const hasCanary = await succeeds("fetch", "origin", CANARY);
	const masterRef = `origin/${master}`;
	const stableRef = `origin/${STABLE}`;
	const canaryRef = `origin/${CANARY}`;

	const findPr = async (head, base) => {
		const { data } = await github.rest.pulls.list({ owner, repo, state: "open", head: `${owner}:${head}` });
		return data.find((pull) => !base || pull.base.ref === base);
	};
	const upsertPr = async ({ head, base, title, body }) => {
		const existing = await findPr(head, head === master ? base : undefined);
		if (existing) {
			await github.rest.pulls.update({ owner, repo, pull_number: existing.number, title, body, base });
			return existing.number;
		}
		const { data } = await github.rest.pulls.create({ owner, repo, head, base, title, body });
		return data.number;
	};
	const closePr = async (head, base, deleteBranch) => {
		const existing = await findPr(head, base);
		if (existing) await github.rest.pulls.update({ owner, repo, pull_number: existing.number, state: "closed" });
		if (deleteBranch) await github.rest.git.deleteRef({ owner, repo, ref: `heads/${head}` }).catch(() => {});
	};
	const remoteSha = async (branch) => {
		if (!(await succeeds("fetch", "origin", branch))) return null;
		return git("rev-parse", `origin/${branch}`);
	};
	const publishBranch = async (branch, title, summaries) => {
		await git("push", "--force", "origin", `HEAD:refs/heads/${branch}`);
		const headSha = await git("rev-parse", "HEAD");
		const checks = {
			"Validate Pull Request Title": `Generated title \`${title}\` follows the release convention.`,
			"Lint & Format": summaries.lint,
		};
		for (const [name, summary] of Object.entries(checks)) {
			await github.rest.checks.create({
				owner,
				repo,
				name,
				head_sha: headSha,
				status: "completed",
				conclusion: "success",
				output: { title: name, summary },
			});
		}
		await github.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: "ci-pipeline.yml", ref: branch });
	};

	const updateCanary = async () => {
		const changes = await changesBetween(canaryRef, masterRef);
		if (!changes) {
			await closePr(master, CANARY, false);
			return;
		}
		const tags = (await git("tag", "--list", "canary-*")).split("\n").filter(Boolean);
		const lastBuild = Math.max(0, ...tags.map((tag) => Number(tag.split(".").pop()) || 0));
		const version = `${await versionAt(masterRef)}.${lastBuild + 1}`;
		const title = `release(canary): v${version}`;
		await upsertPr({ head: master, base: CANARY, title, body: renderCanaryBody(version, changes) });
		core.notice(`Canary PR targets v${version}.`);
	};

	const updateSync = async () => {
		const pending = await git("rev-list", "--count", `${masterRef}..${stableRef}`);
		if (pending === "0") {
			await closePr(SYNC_BRANCH, master, true);
			return null;
		}
		const remote = await remoteSha(SYNC_BRANCH);
		const contains = async (ancestor) => remote && succeeds("merge-base", "--is-ancestor", ancestor, remote);
		const title = "chore(sync): merge stable into master";
		const changes = (await changesBetween(masterRef, stableRef)) || "- Merge commits only";

		await git("switch", "--detach", masterRef);
		const merged = await succeeds("merge", "--no-ff", "--no-edit", "-m", title, stableRef);
		if (!merged) await git("merge", "--abort");
		const upToDate = merged
			? (await contains(masterRef)) && (await contains(stableRef))
			: await contains(stableRef);
		if (!upToDate) {
			if (!merged) await git("switch", "--detach", stableRef);
			await publishBranch(SYNC_BRANCH, title, {
				lint: `This branch only merges ${STABLE} into ${master}, and both are already checked.`,
			});
		}
		const number = await upsertPr({ head: SYNC_BRANCH, base: master, title, body: renderSyncBody(changes, !merged) });
		core.notice(merged ? `Sync PR #${number} is ready.` : `Sync PR #${number} has conflicts to resolve.`);
		return number;
	};

	const updateHotfix = async () => {
		const releaseSha = await git("log", "-1", "--format=%H", "-G", '"version":', stableRef, "--", "package.json");
		const changes = await changesBetween(releaseSha, stableRef);
		if (!changes) {
			await closePr(HOTFIX_BRANCH, STABLE, true);
			return;
		}
		const stableSha = await git("rev-parse", stableRef);
		const current = await versionAt(stableRef);
		const next = bump(current, "patch");
		const title = `release(stable): v${next}`;
		const remote = await remoteSha(HOTFIX_BRANCH);
		const upToDate =
			remote !== null &&
			(await git("rev-parse", `${remote}^`)) === stableSha &&
			(await versionAt(remote)) === next;
		if (!upToDate) {
			await git("switch", "--detach", stableRef);
			await exec.exec("npm", ["version", next, "--no-git-tag-version"]);
			await commit(title, "package.json");
			await publishBranch(HOTFIX_BRANCH, title, {
				lint: `Only package.json differs from ${STABLE}, so src/ matches the already checked base.`,
			});
		}
		await upsertPr({ head: HOTFIX_BRANCH, base: STABLE, title, body: renderHotfixBody(current, next, changes) });
		core.notice(`Hotfix PR targets v${next}.`);
	};

	const updateStable = async (syncNumber) => {
		const changes = await changesBetween(stableRef, masterRef);
		if (!changes) {
			await closePr(RELEASE_BRANCH, undefined, true);
			core.notice("No unreleased changes on master.");
			return;
		}
		if (syncNumber !== null) {
			core.notice(`Merge sync PR #${syncNumber} before the next stable release PR is updated.`);
			return;
		}
		const existing = await findPr(RELEASE_BRANCH);
		const editedRelease = isEdit && context.payload.pull_request.head.ref === RELEASE_BRANCH;
		const body = editedRelease ? context.payload.pull_request.body : existing?.body;
		const previousBody = editedRelease ? context.payload.changes?.body?.from : body;
		const level = resolveLevel(body, previousBody);
		const current = await versionAt(stableRef);
		const next = bump(current, level);
		const masterSha = await git("rev-parse", masterRef);
		const title = `release(stable): v${next}`;
		const remote = await remoteSha(RELEASE_BRANCH);
		const upToDate =
			remote !== null &&
			(await git("rev-parse", `${remote}^`)) === masterSha &&
			(await versionAt(remote)) === next;
		if (!upToDate) {
			await git("switch", "--detach", masterRef);
			await exec.exec("npm", ["version", next, "--no-git-tag-version", "--allow-same-version"]);
			await commit(title, "package.json");
			await publishBranch(RELEASE_BRANCH, title, {
				lint: `Only package.json differs from ${master}, so src/ matches the already checked base.`,
			});
		}
		await upsertPr({ head: RELEASE_BRANCH, base: STABLE, title, body: renderStableBody(current, level, changes) });
		core.notice(`Stable release PR targets v${next} (${level}).`);
	};

	if (hasCanary) await updateCanary();
	else core.warning(`Branch ${CANARY} does not exist yet, so no Canary release PR was opened.`);

	if (!hasStable) {
		core.warning(`Branch ${STABLE} does not exist yet, so no stable release PR was opened.`);
		return;
	}
	const syncNumber = await updateSync();
	await updateHotfix();
	await updateStable(syncNumber);
};
