export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

export function isBigInt(value: unknown): value is bigint {
	return typeof value === "bigint";
}

export function isObject(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}
