import type { EnhancerSubscription } from "$types/apis/enhancer.apis.ts";

export type FakeSocketCommand = {
	type: "subscribe" | "unsubscribe" | "ping";
	subscription?: EnhancerSubscription;
	after?: string;
};

export type FakeSubscribeCommand = FakeSocketCommand & { type: "subscribe"; subscription: EnhancerSubscription };

export type QueueTestValue = { id: string; queueKey: string; createdAt: number };

export type TestElement = Pick<Element, "getAttribute" | "hasAttribute" | "setAttribute" | "parentElement">;

export type TestFiber = {
	child?: TestFiber | null;
	sibling?: TestFiber | null;
	return?: TestFiber | null;
	stateNode?: { props?: { mediaPlayerInstance?: object; marker?: boolean } } | null;
};
