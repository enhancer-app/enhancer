import type { CommonEvents } from "$types/platforms/common.events.ts";
import { createNanoEvents } from "nanoevents";

export class EventEmitterFactory<T extends CommonEvents> {
	create() {
		return createNanoEvents<T>();
	}
}
