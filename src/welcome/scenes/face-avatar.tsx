const colours = [
	"#f2a65a",
	"#7ec4cf",
	"#b388eb",
	"#f28482",
	"#84c37a",
	"#f6d365",
	"#6c9be0",
	"#e58fc3",
	"#5fc9a5",
	"#d98c5f",
];

const INK = "#1b1b20";

// Faces drawn on a 40x40 grid: eyes and a mouth per expression.
const faces = [
	// :D
	<>
		<circle cx="14" cy="16" r="2.4" />
		<circle cx="26" cy="16" r="2.4" />
		<path d="M12 23h16a8 8 0 0 1-16 0z" />
	</>,
	// :P
	<>
		<circle cx="14" cy="16" r="2.4" />
		<circle cx="26" cy="16" r="2.4" />
		<path d="M13 24h14" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
		<path d="M20 24h6v3a3 3 0 0 1-6 0z" fill="#e5546b" />
	</>,
	// :c
	<>
		<circle cx="14" cy="16" r="2.4" />
		<circle cx="26" cy="16" r="2.4" />
		<path d="M13 29a7 6 0 0 1 14 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
	</>,
	// :x
	<>
		<circle cx="14" cy="16" r="2.4" />
		<circle cx="26" cy="16" r="2.4" />
		<path d="M16.5 23.5l7 6M23.5 23.5l-7 6" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
	</>,
	// :O
	<>
		<circle cx="14" cy="15" r="2.4" />
		<circle cx="26" cy="15" r="2.4" />
		<ellipse cx="20" cy="26" rx="3.6" ry="4.4" />
	</>,
	// ;)
	<>
		<path d="M11.5 16h5" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
		<circle cx="26" cy="16" r="2.4" />
		<path d="M13 23a7 6 0 0 0 14 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
	</>,
	// ^^
	<>
		<path
			d="M11 18l3-3.5 3 3.5M23 18l3-3.5 3 3.5"
			stroke={INK}
			strokeWidth="2.4"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
		<path d="M14 24a6 5 0 0 0 12 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
	</>,
	// -_-
	<>
		<path d="M11 16h6M23 16h6M15 27h10" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
	</>,
	// :3
	<>
		<circle cx="14" cy="16" r="2.4" />
		<circle cx="26" cy="16" r="2.4" />
		<path
			d="M14 24c0 3 3 3 6 1 3 2 6 2 6-1"
			stroke={INK}
			strokeWidth="2.4"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
	</>,
	// B)
	<>
		<path d="M9 13h22v2l-2 4h-6l-2-3h-2l-2 3h-6l-2-4z" />
		<path d="M14 25a6 5 0 0 0 12 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
	</>,
];

function hash(seed: string) {
	let value = 0;
	for (const char of seed) value = (value * 31 + char.charCodeAt(0)) >>> 0;
	return value;
}

/** Round avatar with a simple face; colour and expression are picked from the seed. */
export function FaceAvatar({ seed, className }: { seed: string; className?: string }) {
	const value = hash(seed);
	const colour = colours[value % colours.length];
	const face = faces[Math.floor(value / colours.length) % faces.length];
	return (
		<svg className={className} viewBox="0 0 40 40" aria-hidden="true">
			<circle cx="20" cy="20" r="20" fill={colour} />
			<g fill={INK}>{face}</g>
		</svg>
	);
}
