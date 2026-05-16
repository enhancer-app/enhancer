import { createNanoEvents } from "nanoevents";
import type { CommonEvents } from "$types/platforms/common.events.ts";

export class EventEmitterFactory<T extends CommonEvents> {
	create() {
		return createNanoEvents<T>();
	}
}
