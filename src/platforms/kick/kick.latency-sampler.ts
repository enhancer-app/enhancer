const DEFAULT_SAMPLE_COUNT = 10;

const DEFAULT_RESET_THRESHOLD_SECONDS = 2;

export default class LatencySampler {
	private readonly samples: number[] = [];

	constructor(
		private readonly sampleCount: number = DEFAULT_SAMPLE_COUNT,
		private readonly resetThresholdSeconds: number = DEFAULT_RESET_THRESHOLD_SECONDS,
	) {}

	add(sample: number | undefined): number | undefined {
		if (sample === undefined || !Number.isFinite(sample) || sample < 0) {
			this.clear();

			return undefined;
		}

		const previous = this.samples[this.samples.length - 1];

		if (previous !== undefined && Math.abs(sample - previous) > this.resetThresholdSeconds) {
			this.clear();
		}

		this.samples.push(sample);

		if (this.samples.length > this.sampleCount) {
			this.samples.shift();
		}

		return this.samples.reduce((accumulator, current) => accumulator + current, 0) / this.samples.length;
	}

	clear(): void {
		this.samples.length = 0;
	}
}
