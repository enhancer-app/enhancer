const { existsSync, readFileSync } = require("node:fs");
const { isChangesetFile, parseChangeset, highestLevel, changelogSection } = require("./changelog.cjs");

const STABLE = "stable";
const CANARY = "canary";
const RELEASE_BRANCH = "release-stable";
const HOTFIX_BRANCH = "release-hotfix";
const SYNC_BRANCH = "sync-stable";
const CHANGESET_CLI = "node_modules/@changesets/cli/bin.js";
const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
const MERGE_NOTE = [
	"> [!IMPORTANT]",
	"> Merge with **Create a merge commit**. Squash or rebase would give these commits new hashes on this branch.",
].join("\n");
const SYNC_NOTE = [
	"> [!IMPORTANT]",
	"> Do not merge this PR by hand. The Merge Sync PR workflow merges it with a merge commit on its own when it only brings stable's changes, and comments here when it cannot. Then review the branch and add the `merge-sync` label.",
].join("\n");
const RELEASE_APP_SLUG = "enhancer-release";
const PROVENANCE_SCRIPT = ".github/scripts/sync-provenance.sh";
const FOOTER =
	"<sub>Managed by the release workflow. Only the release app and maintainers can push to this branch.</sub>";

const bump = (version, level) => {
	const [major, minor, patch] = version.split(".").map(Number);
	if (level === "major") return `${major + 1}.0.0`;
	if (level === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
};

const COMMIT_PATTERN = /^- \[([ xX])\] .*<!-- commit:([0-9a-f]{40}) -->\s*$/gm;
const PLAN_PATTERN = /<!-- release-plan:([^ ]+) -->/;
const PICKED_PATTERN = /\(cherry picked from commit ([0-9a-f]{40})\)/g;

const uncheckedCommits = (body) =>
	new Set([...(body ?? "").matchAll(COMMIT_PATTERN)].filter((match) => match[1] === " ").map((match) => match[2]));

// The bot saves this body, so changeset text must not smuggle in commit or plan markers.
const renderChangelog = (section) =>
	section
		? ["### Changelog", "", section.replace(/<!--/g, "&lt;!--").replace(/^### /gm, "#### ")]
		: ["### Changelog", "", "_No selected change has a changeset, so this release has no changelog entry._"];

const renderStableBody = ({ current, next, section, candidates, selected, levels, mode, warning, plan }) =>
	[
		"Merging this PR releases a new **stable** version to GitHub, Chrome Web Store and Firefox Add-ons.",
		"",
		MERGE_NOTE,
		...(warning
			? [
					"",
					"> [!WARNING]",
					`> ${warning} The branch still holds the previous selection, so this PR stays a draft until then.`,
				]
			: []),
		"",
		"### Version",
		"",
		`v${current} → **v${next}**`,
		"",
		"<sub>The highest changeset level among the selected changes sets the version. Without changesets it is a patch release.</sub>",
		"",
		...renderChangelog(section),
		"",
		`### Changes since v${current}`,
		"",
		"Untick a change to keep it out of this release. New changes are ticked by default.",
		"",
		...candidates.map(({ sha, subject }) => {
			const level = levels.get(sha);
			return `- [${selected.has(sha) ? "x" : " "}] ${subject} (\`${sha.slice(0, 7)}\`${level ? `, \`${level}\`` : ""}) <!-- commit:${sha} -->`;
		}),
		"",
		mode === "cherry-pick"
			? "<sub>Some changes are left out, so the selected ones are cherry-picked onto stable and get new hashes there.</sub>"
			: "<sub>The selected changes are merged with their original commits.</sub>",
		"",
		FOOTER,
		`<!-- release-plan:${plan} -->`,
	].join("\n");

const renderHotfixBody = (current, next, changes, section) =>
	[
		`Merging this PR releases the **stable hotfix** v${next} to GitHub, Chrome Web Store and Firefox Add-ons.`,
		"",
		MERGE_NOTE,
		"",
		...renderChangelog(section),
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
		SYNC_NOTE,
		...(conflicted
			? [
					"",
					"> [!WARNING]",
					`> stable conflicts with master. Merge master into \`${SYNC_BRANCH}\` and resolve the conflicts there, never on stable. The workflow cannot verify a conflict resolution, so review the merge commit before adding the label.`,
				]
			: []),
		"",
		"### Commits from stable",
		"",
		changes,
		"",
		FOOTER,
	].join("\n");

module.exports = async ({ github, app, context, core, exec }) => {
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
	const commit = (message) =>
		git("-c", `user.name=${BOT_NAME}`, "-c", `user.email=${BOT_EMAIL}`, "commit", "-m", message);
	const versionAt = async (ref) => JSON.parse(await git("show", `${ref}:package.json`)).version;
	const changesBetween = (from, to) => git("log", "--no-merges", "--format=- %s", `${from}..${to}`);
	const changelogAt = async (ref, version) =>
		changelogSection(await git("show", `${ref}:CHANGELOG.md`).catch(() => ""), version);
	const changesetLevel = async (sha) => {
		const added = await git("diff-tree", "--no-commit-id", "--name-only", "--diff-filter=A", "-r", sha);
		const levels = [];
		for (const path of added.split("\n").filter(isChangesetFile)) {
			const changeset = parseChangeset(await git("show", `${sha}:${path}`));
			if (changeset?.level) levels.push(changeset.level);
		}
		return highestLevel(levels);
	};
	// Changesets bump from the version in package.json, which lags behind stable until the sync PR is merged.
	const versionRelease = async (current) => {
		const packageVersion = () => JSON.parse(readFileSync("package.json", "utf8")).version;
		await exec.exec("npm", ["version", current, "--no-git-tag-version", "--allow-same-version"]);
		if (existsSync(".changeset/config.json")) {
			const result = await exec.getExecOutput("bun", [CHANGESET_CLI, "version"], { ignoreReturnCode: true });
			if (result.exitCode !== 0 && !`${result.stdout}${result.stderr}`.includes("No unreleased changesets")) {
				throw new Error(`changeset version failed: ${(result.stderr || result.stdout).trim()}`);
			}
		}
		if (packageVersion() === current) {
			await exec.exec("npm", ["version", bump(current, "patch"), "--no-git-tag-version"]);
		}
		const next = packageVersion();
		await git("add", "--all", "--", ...["package.json", "CHANGELOG.md", ".changeset"].filter(existsSync));
		await commit(`release(stable): v${next}`);
		return next;
	};

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
			await app.rest.pulls.update({ owner, repo, pull_number: existing.number, title, body, base });
			return existing.number;
		}
		const { data } = await app.rest.pulls.create({ owner, repo, head, base, title, body });
		return data.number;
	};
	const closePr = async (head, base, deleteBranch) => {
		const existing = await findPr(head, base);
		if (existing) await app.rest.pulls.update({ owner, repo, pull_number: existing.number, state: "closed" });
		if (deleteBranch) await app.rest.git.deleteRef({ owner, repo, ref: `heads/${head}` }).catch(() => {});
	};
	const setDraft = async (number, draft) => {
		const { data } = await app.rest.pulls.get({ owner, repo, pull_number: number });
		if (data.draft === draft) return;
		const mutation = draft ? "convertPullRequestToDraft" : "markPullRequestReadyForReview";
		await app.graphql(`mutation($id: ID!) { ${mutation}(input: { pullRequestId: $id }) { clientMutationId } }`, {
			id: data.node_id,
		});
	};
	const roles = new Map();
	const isTrusted = async (editor) => {
		if (!editor) return false;
		if (editor.__typename === "Bot") return editor.login === RELEASE_APP_SLUG;
		if (!roles.has(editor.login)) {
			const { data } = await github.rest.repos
				.getCollaboratorPermissionLevel({ owner, repo, username: editor.login })
				.catch(() => ({ data: {} }));
			roles.set(editor.login, ["admin", "maintain"].includes(data.role_name));
		}
		return roles.get(editor.login);
	};
	// Write users can edit the PR body; only ticks saved by maintainers or the bot count.
	const trustedBody = async (pull) => {
		const { repository } = await app.graphql(
			`query($owner: String!, $repo: String!, $number: Int!) {
				repository(owner: $owner, name: $repo) {
					pullRequest(number: $number) {
						author { login __typename }
						userContentEdits(first: 50) { nodes { diff editor { login __typename } } }
					}
				}
			}`,
			{ owner, repo, number: pull.number },
		);
		const { author, userContentEdits } = repository.pullRequest;
		const edits = userContentEdits.nodes;
		if (!edits.length) return (await isTrusted(author)) ? pull.body : null;
		for (const [index, edit] of edits.entries()) {
			if (!(await isTrusted(edit.editor))) continue;
			if (edit.diff != null) return edit.diff;
			if (index === 0) return pull.body;
		}
		core.notice("The release PR body was last saved by someone who cannot release, so its ticks are ignored.");
		return null;
	};
	const remoteSha = async (branch) => {
		if (!(await succeeds("fetch", "origin", branch))) return null;
		return git("rev-parse", `origin/${branch}`);
	};
	const publishBranch = (branch) => git("push", "--force", "origin", `HEAD:refs/heads/${branch}`);

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

	// A cherry-picked changeset is added and used up on stable only, so merging stable leaves master's copy behind.
	const dropReleasedChangesets = async () => {
		const used = await git("log", "--diff-filter=D", "--name-only", "--format=", `${masterRef}..${stableRef}`);
		const paths = [...new Set(used.split("\n").filter(isChangesetFile))].filter((path) => existsSync(path));
		if (paths.length) await git("rm", "--quiet", "--", ...paths);
		return paths.length > 0;
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
		const merged = await succeeds(
			"-c",
			`user.name=${BOT_NAME}`,
			"-c",
			`user.email=${BOT_EMAIL}`,
			"merge",
			"--no-ff",
			"--no-edit",
			"-m",
			title,
			stableRef,
		);
		if (merged && (await dropReleasedChangesets())) {
			await git("-c", `user.name=${BOT_NAME}`, "-c", `user.email=${BOT_EMAIL}`, "commit", "--amend", "--no-edit");
		}
		let resolved = false;
		if (!merged) {
			await run(["merge", "--abort"]);
			const provenance = await exec.getExecOutput("bash", [PROVENANCE_SCRIPT, masterRef, stableRef], {
				silent: true,
				ignoreReturnCode: true,
			});
			if (provenance.exitCode === 0) {
				await git(
					"-c",
					`user.name=${BOT_NAME}`,
					"-c",
					`user.email=${BOT_EMAIL}`,
					"merge",
					"-s",
					"ours",
					"--no-commit",
					stableRef,
				);
				await exec.exec("npm", ["version", await versionAt(stableRef), "--no-git-tag-version", "--allow-same-version"]);
				await git("checkout", stableRef, "--", "CHANGELOG.md");
				await dropReleasedChangesets();
				await git("add", "package.json");
				await git("-c", `user.name=${BOT_NAME}`, "-c", `user.email=${BOT_EMAIL}`, "commit", "--no-edit", "-m", title);
				resolved = true;
			} else {
				core.notice(`Sync needs a manual conflict resolution: ${provenance.stderr.trim()}`);
			}
		}
		const automatic = merged || resolved;
		const upToDate = automatic ? (await contains(masterRef)) && (await contains(stableRef)) : await contains(stableRef);
		if (!upToDate) {
			if (!automatic) await git("switch", "--detach", stableRef);
			await publishBranch(SYNC_BRANCH);
		}
		const number = await upsertPr({
			head: SYNC_BRANCH,
			base: master,
			title,
			body: renderSyncBody(changes, !automatic),
		});
		if (automatic) {
			await github.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: "release-sync.yml", ref: master });
		}
		core.notice(
			automatic ? `Sync PR #${number} is merged automatically.` : `Sync PR #${number} has conflicts to resolve.`,
		);
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
		const remote = await remoteSha(HOTFIX_BRANCH);
		const upToDate = remote !== null && (await git("rev-parse", `${remote}^`)) === stableSha;
		if (!upToDate) {
			await git("switch", "--detach", stableRef);
			await versionRelease(current);
			await publishBranch(HOTFIX_BRANCH);
		}
		const built = upToDate ? remote : await git("rev-parse", "HEAD");
		const next = await versionAt(built);
		const title = `release(stable): v${next}`;
		const body = renderHotfixBody(current, next, changes, await changelogAt(built, next));
		await upsertPr({ head: HOTFIX_BRANCH, base: STABLE, title, body });
		core.notice(`Hotfix PR targets v${next}.`);
	};

	const releaseCandidates = async () => {
		const pickedLog = await git("log", stableRef, "--format=%B", "--grep", "cherry picked from commit");
		const picked = new Set([...pickedLog.matchAll(PICKED_PATTERN)].map((match) => match[1]));
		const log = await git("log", "--no-merges", "--reverse", "--format=%H%x09%s", `${stableRef}..${masterRef}`);
		return log
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [sha, ...subject] = line.split("\t");
				return { sha, subject: subject.join("\t") };
			})
			.filter(({ sha }) => !picked.has(sha));
	};

	const buildRelease = async ({ mode, baseSha, stableSha, chosen, current, syncNumber }) => {
		if (mode === "merge") {
			await git("switch", "--detach", baseSha);
			if (!(await succeeds("merge-base", "--is-ancestor", stableSha, "HEAD"))) {
				const merged = await succeeds(
					"-c",
					`user.name=${BOT_NAME}`,
					"-c",
					`user.email=${BOT_EMAIL}`,
					"merge",
					"--no-ff",
					"-m",
					`chore(release): merge ${STABLE} into ${RELEASE_BRANCH}`,
					stableRef,
				);
				if (!merged) {
					await run(["merge", "--abort"]);
					return `${STABLE} conflicts with the selected changes. Merge the sync PR${syncNumber ? ` #${syncNumber}` : ""} first.`;
				}
				await dropReleasedChangesets();
			}
		} else {
			await git("switch", "--detach", stableSha);
			for (const { sha, subject } of chosen) {
				const picked = await succeeds(
					"-c",
					`user.name=${BOT_NAME}`,
					"-c",
					`user.email=${BOT_EMAIL}`,
					"cherry-pick",
					"-x",
					"--empty=drop",
					sha,
				);
				if (!picked) {
					await run(["cherry-pick", "--abort"]);
					return `\`${sha.slice(0, 7)}\` ${subject} does not apply without the changes left out. Tick the changes it depends on.`;
				}
			}
		}
		await versionRelease(current);
		await publishBranch(RELEASE_BRANCH);
		return null;
	};

	const updateStable = async (syncNumber) => {
		const candidates = await releaseCandidates();
		if (!candidates.length) {
			await closePr(RELEASE_BRANCH, undefined, true);
			core.notice("No unreleased changes on master.");
			return;
		}
		const existing = await findPr(RELEASE_BRANCH);
		const editedRelease = isEdit && context.payload.pull_request.head.ref === RELEASE_BRANCH;
		const body = editedRelease ? context.payload.pull_request.body : existing && (await trustedBody(existing));
		const unchecked = uncheckedCommits(body);
		const selected = new Set(candidates.filter(({ sha }) => !unchecked.has(sha)).map(({ sha }) => sha));
		const chosen = candidates.filter(({ sha }) => selected.has(sha));
		const levels = new Map();
		for (const { sha } of candidates) levels.set(sha, await changesetLevel(sha));
		const current = await versionAt(stableRef);
		const stableSha = await git("rev-parse", stableRef);
		const remote = await remoteSha(RELEASE_BRANCH);

		let mode = "none";
		let baseSha = null;
		let warning = null;
		if (chosen.length) {
			const last = chosen[chosen.length - 1].sha;
			mode = "merge";
			for (const { sha } of candidates) {
				if ((await succeeds("merge-base", "--is-ancestor", sha, last)) !== selected.has(sha)) {
					mode = "cherry-pick";
					break;
				}
			}
			baseSha = mode === "merge" ? last : stableSha;
		} else {
			warning = "Nothing is selected. Tick at least one change.";
		}

		const plan = require("node:crypto")
			.createHash("sha1")
			.update(["changesets", mode, baseSha, stableSha, ...chosen.map(({ sha }) => sha)].join(","))
			.digest("hex");
		let storedPlan = body?.match(PLAN_PATTERN)?.[1];
		if (mode !== "none" && (plan !== storedPlan || remote === null)) {
			warning = await buildRelease({ mode, baseSha, stableSha, chosen, current, syncNumber });
			storedPlan = warning ? `failed-${plan}` : plan;
		} else if (mode !== "none" && storedPlan === plan) {
			warning = null;
		}
		const built = await remoteSha(RELEASE_BRANCH);
		if (built === null) {
			core.warning(`No ${RELEASE_BRANCH} branch could be built: ${warning}`);
			return;
		}
		const next = await versionAt(built);
		const title = `release(stable): v${next}`;
		const newBody = renderStableBody({
			current,
			next,
			section: await changelogAt(built, next),
			candidates,
			selected,
			levels,
			mode,
			warning,
			plan: storedPlan ?? plan,
		});
		const number = await upsertPr({ head: RELEASE_BRANCH, base: STABLE, title, body: newBody });
		await setDraft(number, Boolean(warning));
		core.notice(`Stable release PR targets v${next} (${mode}, ${chosen.length}/${candidates.length}).`);
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
