import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export type EnhancerAboutComponentProps = {
	platform: PlatformType;
	workerService: WorkerService;
	logoUrl: string;
};
