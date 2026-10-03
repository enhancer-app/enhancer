const BRANCH = "release/next";
const LEVELS = ["patch", "minor", "major"];
const LEVEL_PATTERN = /^- \[([ xX])\] .*<!-- release-level:(patch|minor|major) -->\s*$/gm;
const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

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

const renderBody = (current, level, changes) =>
	[
		"Merging this PR releases a new version to GitHub, Chrome Web Store and Firefox Add-ons.",
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
		`<sub>Managed by the release workflow. Manual commits to \`${BRANCH}\` are overwritten.</sub>`,
	].join("\n");

module.exports = async ({ github, context, core, exec }) => {
	const { owner, repo } = context.repo;
	const base = context.payload.repository.default_branch;
	const isEdit = context.eventName === "pull_request_target";
	const git = async (...args) => (await exec.getExecOutput("git", args)).stdout.trim();

	if (isEdit) {
		const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
			owner,
			repo,
			username: context.actor,
		});
		if (!["admin", "maintain"].includes(data.role_name)) {
			core.notice(`Ignoring release PR edit by ${context.actor} (${data.role_name}).`);
			return;
		}
	}

	const {
		data: [existing],
	} = await github.rest.pulls.list({ owner, repo, state: "open", head: `${owner}:${BRANCH}`, base });

	const baseSha = await git("rev-parse", `origin/${base}`);
	const current = JSON.parse(await git("show", `${baseSha}:package.json`)).version;
	const releaseSha = await git("log", "-1", "--format=%H", "-G", '"version":', baseSha, "--", "package.json");
	const changes = await git("log", "--no-merges", "--format=- %s", `${releaseSha}..${baseSha}`);

	if (!changes) {
		if (existing) {
			await github.rest.pulls.update({ owner, repo, pull_number: existing.number, state: "closed" });
		}
		await github.rest.git.deleteRef({ owner, repo, ref: `heads/${BRANCH}` }).catch(() => {});
		core.notice(`No unreleased changes since v${current}.`);
		return;
	}

	const body = isEdit ? context.payload.pull_request.body : existing?.body;
	const previousBody = isEdit ? context.payload.changes?.body?.from : body;
	const level = resolveLevel(body, previousBody);
	const next = bump(current, level);

	const remote = await exec.getExecOutput("git", ["fetch", "origin", BRANCH], { ignoreReturnCode: true });
	let upToDate = false;
	if (remote.exitCode === 0) {
		const parent = await git("rev-parse", `origin/${BRANCH}^`);
		const remoteVersion = JSON.parse(await git("show", `origin/${BRANCH}:package.json`)).version;
		upToDate = parent === baseSha && remoteVersion === next;
	}

	if (!upToDate) {
		await git("switch", "-C", BRANCH, baseSha);
		await exec.exec("npm", ["version", next, "--no-git-tag-version"]);
		await git("-c", `user.name=${BOT_NAME}`, "-c", `user.email=${BOT_EMAIL}`, "commit", "-m", `release: v${next}`, "--", "package.json");
		await git("push", "--force", "origin", `HEAD:refs/heads/${BRANCH}`);
	}

	const title = `release: v${next}`;
	const newBody = renderBody(current, level, changes);
	if (existing) {
		await github.rest.pulls.update({ owner, repo, pull_number: existing.number, title, body: newBody });
	} else {
		await github.rest.pulls.create({ owner, repo, head: BRANCH, base, title, body: newBody });
	}

	if (!upToDate) {
		await github.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: "ci-pipeline.yml", ref: BRANCH });
	}

	core.notice(`Release PR targets v${next} (${level}).`);
};
