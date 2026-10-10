import { expect, test } from "bun:test";
import ReactUtils from "$shared/utils/react.utils.ts";

type TestFiber = {
	child?: TestFiber | null;
	sibling?: TestFiber | null;
	return?: TestFiber | null;
	stateNode?: { props?: Record<string, unknown> } | null;
};

function createTree(): TestFiber {
	const target: TestFiber = { stateNode: { props: { mediaPlayerInstance: {} } } };
	const bare: TestFiber = { stateNode: {} };
	const leaf: TestFiber = { stateNode: null };
	const root: TestFiber = { child: bare };
	bare.return = root;
	bare.child = leaf;
	leaf.return = bare;
	leaf.sibling = target;
	target.return = bare;
	return root;
}

function createChain(length: number): TestFiber[] {
	const nodes: TestFiber[] = Array.from({ length }, () => ({ stateNode: { props: {} } }));
	for (let index = 1; index < length; index++) {
		nodes[index - 1].child = nodes[index];
		nodes[index].return = nodes[index - 1];
	}
	return nodes;
}

const reactUtils = new ReactUtils();

test("never calls the predicate with a nullish node", () => {
	const seen: unknown[] = [];

	reactUtils.findReactChildren(
		createTree(),
		(node) => {
			seen.push(node);
			return false;
		},
		50,
	);

	expect(seen.length).toBeGreaterThan(0);
	expect(seen.every((node) => node !== null && node !== undefined)).toBe(true);
});

test("findReactParents never calls the predicate with a nullish node", () => {
	const root = createTree();
	const leaf = root.child?.child as TestFiber;
	const seen: unknown[] = [];

	reactUtils.findReactParents(
		leaf,
		(node) => {
			seen.push(node);
			return false;
		},
		50,
	);

	expect(seen.length).toBeGreaterThan(0);
	expect(seen.every((node) => node !== null && node !== undefined)).toBe(true);
});

test("still finds a node reachable through siblings", () => {
	const root = createTree();
	const target = root.child?.child?.sibling;
	const found = reactUtils.findReactChildren<unknown>(
		root,
		(node) => !!node?.stateNode?.props?.mediaPlayerInstance,
		50,
	);

	expect(target).toBeDefined();
	expect(found as unknown).toBe(target);
});

test("returns null for a nullish starting node", () => {
	expect(reactUtils.findReactChildren(null, () => true)).toBeNull();
	expect(reactUtils.findReactParents(undefined, () => true)).toBeNull();
});

test("keeps testing the node sitting exactly at the depth limit", () => {
	const deep: TestFiber = { stateNode: { props: { marker: true } } };
	const middle: TestFiber = { child: deep };
	const root: TestFiber = { child: middle };

	const found = reactUtils.findReactChildren<unknown>(root, (node) => !!node?.stateNode?.props?.marker, 2);

	expect(found as unknown).toBe(deep);
});

test("stops searching well past the depth limit", () => {
	const chain = createChain(6);
	const isLast = (node: TestFiber) => node === chain.at(-1);
	const isFirst = (node: TestFiber) => node === chain[0];

	expect(reactUtils.findReactChildren(chain[0], isLast, 2)).toBeNull();
	expect(reactUtils.findReactParents(chain.at(-1), isFirst, 2)).toBeNull();
	expect(reactUtils.findReactChildren(chain[0], isLast, 10) as unknown).toBe(chain.at(-1));
	expect(reactUtils.findReactParents(chain.at(-1), isFirst, 10) as unknown).toBe(chain[0]);
});
