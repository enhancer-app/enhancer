import type {
	EnhancerAccount,
	EnhancerBadge,
	EnhancerSnapshotAppearance,
	EnhancerSnapshotHeader,
} from "$types/apis/enhancer.apis.ts";
import type { AggregateAccountEntry, AggregateBadgeEntry } from "$types/shared/worker/enhancer-api-worker.types.ts";

export const SNAPSHOT_FORMAT_VERSION = 1;
const SNAPSHOT_MAGIC = [0x45, 0x4e, 0x48, 0x53];

class SnapshotReader {
	offset: number;

	constructor(
		private readonly bytes: Uint8Array,
		offset = 0,
	) {
		this.offset = offset;
	}

	varint(): number {
		let value = 0;
		let multiplier = 1;
		for (;;) {
			const byte = this.bytes[this.offset++];
			if (byte === undefined) throw new Error("Truncated Enhancer snapshot");
			value += (byte % 128) * multiplier;
			if (byte < 128) return value;
			multiplier *= 128;
		}
	}

	slice(length: number): Uint8Array {
		const end = this.offset + length;
		if (end > this.bytes.length) throw new Error("Truncated Enhancer snapshot");
		const slice = this.bytes.subarray(this.offset, end);
		this.offset = end;
		return slice;
	}
}

export function readSnapshotHeader(bytes: Uint8Array): { header: EnhancerSnapshotHeader; bodyOffset: number } {
	const reader = new SnapshotReader(bytes);
	const magic = reader.slice(4);
	if (SNAPSHOT_MAGIC.some((byte, index) => magic[index] !== byte)) throw new Error("Not an Enhancer snapshot");
	const version = reader.slice(1)[0];
	if (version !== SNAPSHOT_FORMAT_VERSION) throw new Error(`Unsupported Enhancer snapshot version ${version}`);
	const header = JSON.parse(new TextDecoder().decode(reader.slice(reader.varint()))) as EnhancerSnapshotHeader;
	if (!Array.isArray(header.badges) || !Array.isArray(header.appearances) || !Array.isArray(header.textAccounts)) {
		throw new Error("Invalid Enhancer snapshot header");
	}
	return { header, bodyOffset: reader.offset };
}

export function encodeBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

export class EnhancerAggregateView {
	readonly hash: string;
	seq: number;
	private readonly ids: Float64Array;
	private readonly offsets: Uint32Array;
	private readonly indexes: Uint16Array | Uint32Array;
	private readonly textAccounts: Map<string, number[]>;
	private readonly appearances: Map<string, EnhancerSnapshotAppearance>;
	private readonly catalog: EnhancerBadge[];
	private readonly catalogById: Map<string, EnhancerBadge>;
	private readonly accountOverlay = new Map<string, EnhancerAccount | null>();
	private readonly badgeOverlay = new Map<string, EnhancerBadge | null>();
	private fontCache: string[] | null = null;

	constructor(hash: string, seq: number, bytes: Uint8Array) {
		this.hash = hash;
		this.seq = seq;
		const { header, bodyOffset } = readSnapshotHeader(bytes);
		this.catalog = header.badges;
		this.catalogById = new Map(header.badges.map((badge) => [badge.badgeId, badge]));
		this.textAccounts = new Map(header.textAccounts);
		this.appearances = new Map(
			header.appearances.map(([externalId, customNickname, customFont, hasGlow]) => [
				externalId,
				[customNickname, customFont, hasGlow === 1],
			]),
		);

		const count = new SnapshotReader(bytes, bodyOffset).varint();
		const counting = new SnapshotReader(bytes, bodyOffset);
		counting.varint();
		let total = 0;
		for (let index = 0; index < count; index++) {
			counting.varint();
			const badgeCount = counting.varint();
			total += badgeCount;
			for (let badge = 0; badge < badgeCount; badge++) counting.varint();
		}

		this.ids = new Float64Array(count);
		this.offsets = new Uint32Array(count + 1);
		this.indexes = this.catalog.length > 0xffff ? new Uint32Array(total) : new Uint16Array(total);
		const reader = new SnapshotReader(bytes, bodyOffset);
		reader.varint();
		let id = 0;
		let position = 0;
		for (let index = 0; index < count; index++) {
			id += reader.varint();
			this.ids[index] = id;
			this.offsets[index] = position;
			const badgeCount = reader.varint();
			for (let badge = 0; badge < badgeCount; badge++) this.indexes[position++] = reader.varint();
		}
		this.offsets[count] = position;
	}

	get overlaySize(): number {
		return this.accountOverlay.size + this.badgeOverlay.size;
	}

	resetOverlay(): void {
		this.accountOverlay.clear();
		this.badgeOverlay.clear();
		this.fontCache = null;
	}

	applyEntries(accounts: AggregateAccountEntry[], badges: AggregateBadgeEntry[]): void {
		if (accounts.length > 0) this.fontCache = null;
		for (const [externalId, account] of accounts) this.accountOverlay.set(externalId, account);
		for (const [badgeId, badge] of badges) this.badgeOverlay.set(badgeId, badge);
	}

	findAccount(externalId: string): EnhancerAccount | null {
		const overlay = this.accountOverlay.get(externalId);
		if (overlay !== undefined) return overlay;
		const indexes = this.findBadgeIndexes(externalId);
		const appearance = this.appearances.get(externalId);
		if (!indexes && !appearance) return null;
		return {
			externalId,
			badgesIds: (indexes ?? []).flatMap((index) => {
				const badge = this.catalog[index];
				return badge ? [badge.badgeId] : [];
			}),
			customNickname: appearance?.[0] ?? null,
			customFont: appearance?.[1] ?? null,
			hasGlow: appearance?.[2] ?? false,
		};
	}

	findBadge(badgeId: string): EnhancerBadge | null {
		const overlay = this.badgeOverlay.get(badgeId);
		if (overlay !== undefined) return overlay;
		return this.catalogById.get(badgeId) ?? null;
	}

	customFonts(): string[] {
		if (this.fontCache) return this.fontCache;
		const fonts = new Set<string>();
		for (const [externalId, appearance] of this.appearances) {
			if (appearance[1] && !this.accountOverlay.has(externalId)) fonts.add(appearance[1]);
		}
		for (const account of this.accountOverlay.values()) {
			if (account?.customFont) fonts.add(account.customFont);
		}
		this.fontCache = [...fonts];
		return this.fontCache;
	}

	private findBadgeIndexes(externalId: string): number[] | null {
		const text = this.textAccounts.get(externalId);
		if (text) return text;
		if (!/^[1-9]\d{0,15}$/.test(externalId)) return null;
		const id = Number(externalId);
		let low = 0;
		let high = this.ids.length - 1;
		while (low <= high) {
			const middle = (low + high) >>> 1;
			const value = this.ids[middle] as number;
			if (value === id) {
				return Array.from(this.indexes.subarray(this.offsets[middle], this.offsets[middle + 1]));
			}
			if (value < id) low = middle + 1;
			else high = middle - 1;
		}
		return null;
	}
}
