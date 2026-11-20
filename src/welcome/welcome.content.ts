import type { WelcomeCopy, WelcomeFeature } from "$types/welcome/welcome.types.ts";
import { locale } from "./scenes/locale.ts";

export const supporterBadge =
	"https://cdn.enhancer.at/badge/ecd54bf64b881f34bb57afd8c303b930085dd950ab48198c1d9cfe671a221008/36.webp";

export const links = {
	twitch: "https://www.twitch.tv/",
	kick: "https://kick.com/",
	github: "https://sh.enhancer.at/github",
	discord: "https://sh.enhancer.at/discord",
	twitter: "https://sh.enhancer.at/twitter",
	docs: "https://docs.enhancer.at/",
	account: "https://dashboard.enhancer.at/",
	support: "https://dashboard.enhancer.at/account/subscription",
};

export const features: WelcomeFeature[] = [
	{ id: "follows", platforms: ["Twitch", "Kick"] },
	{ id: "home", platforms: ["Twitch", "Kick"] },
	{ id: "chatters", platforms: ["Twitch"] },
	{ id: "attachments", platforms: ["Twitch", "Kick"] },
	{ id: "latency", platforms: ["Twitch", "Kick"] },
	{ id: "emotebar", platforms: ["Twitch"] },
];

const en: WelcomeCopy = {
	title: "Welcome to Enhancer",
	nav: { docs: "Docs", settings: "Settings" },
	hero: {
		badge: "is installed",
		title: ["You're all ", "set."],
		lede: "Enhancer now works on Twitch and Kick. There is nothing to set up. Here is a quick look at what it adds.",
		openTwitch: "Open Twitch",
		openKick: "Open Kick",
	},
	features: {
		kicker: "What you get",
		title: ["Everything you have been ", "missing."],
		lede: "Small things that make every stream better. They are already turned on.",
		available: "Available on",
		items: {
			follows: {
				title: "One list for all your follows",
				description: "Twitch and Kick channels side by side. Pin favourites, filter by platform.",
			},
			home: {
				title: "Your streams on the home page",
				description: "Live channels you follow from both sites, pinned first.",
			},
			chatters: {
				title: "See who's really in chat",
				description: "The number in brackets shows how many people are actually in chat.",
			},
			attachments: {
				title: "Images right in chat",
				description: "Paste a link and everyone with Enhancer sees the picture.",
			},
			latency: {
				title: "Catch up with the stream",
				description: "See your delay and let Enhancer cut it down for you.",
			},
			emotebar: {
				title: "Your emotes, one click away",
				description: "The emotes you use most on a channel, right above the chat box.",
			},
		},
	},
	more: ["…and ", "plenty more."],
	settings: {
		kicker: "Settings",
		title: ["Set it up ", "your way."],
		lede: "Every feature can be turned off or changed. Your settings stay in this browser.",
		steps: [
			{ title: "Open Twitch or Kick", text: ["Any page works, a stream or the home page."] },
			{ title: "Click the Enhancer logo", text: ["Look for ", " in the top bar, next to your profile."] },
			{ title: "Pick what you want", text: ["Turn features on or off. Changes apply in every open tab."] },
		],
	},
	account: {
		kicker: "Your Enhancer account",
		title: ["Make chat ", "yours."],
		lede: "One account for Twitch, Kick and Discord. Give your viewers badges and nicknames, and show off your own in every chat. You don't need an account to use the extension.",
		points: [
			{ title: "Connect accounts", text: "Twitch, Kick and Discord in one place." },
			{ title: "Badges for your channel", text: "Create them and give them to viewers." },
			{ title: "Nicknames and team", text: "Set nicknames for viewers and invite mods to help." },
		],
		cta: "Get started",
		support: {
			title: "Want to support us?",
			text: "Every extension feature is free and always will be, with no ads. If you want to help Enhancer grow, pick a support plan. In return you get cosmetic extras in chat that everyone with Enhancer can see.",
			cta: "Support Enhancer",
			perks: ["Supporter badge", "Glowing name", "Custom font", "Custom nickname"],
			nick: "YourName",
		},
	},
	principles: {
		label: "Our principles",
		free: {
			title: ["Free, ", "for good."],
			text: "Every extension feature is free, with no ads, and it will stay that way. If you want, you can support us with cosmetic extras in chat, but you never need them.",
		},
		open: {
			title: ["Open ", "source."],
			text: "Every line of the extension is public on GitHub. Read it, report an issue or send a pull request.",
			link: "View the source",
		},
		privacy: {
			title: ["Privacy ", "first."],
			text: "Your settings and watchtime are stored only in your browser, never on our servers. Export them to a file whenever you want.",
		},
	},
	footer: {
		tagline: "A free, open-source browser extension that adds what is missing on Twitch and Kick.",
		disclaimer: "Not affiliated with Twitch Interactive or Kick.",
	},
};

const pl: WelcomeCopy = {
	title: "Witaj w Enhancerze",
	nav: { docs: "Dokumentacja", settings: "Ustawienia" },
	hero: {
		badge: "jest zainstalowany",
		title: ["Wszystko ", "gotowe."],
		lede: "Enhancer działa już na Twitchu i Kicku. Nie musisz niczego ustawiać. Zobacz, co dodaje.",
		openTwitch: "Otwórz Twitcha",
		openKick: "Otwórz Kicka",
	},
	features: {
		kicker: "Co dostajesz",
		title: ["Wszystko, czego ", "brakowało."],
		lede: "Drobiazgi, które poprawiają każdy stream. Są już włączone.",
		available: "Dostępne na",
		items: {
			follows: {
				title: "Wszyscy obserwowani na jednej liście",
				description: "Kanały z Twitcha i Kicka obok siebie. Przypinaj ulubionych i filtruj platformy.",
			},
			home: {
				title: "Twoje streamy na stronie głównej",
				description: "Kanały na żywo z obu stron, przypięte na początku.",
			},
			chatters: {
				title: "Zobacz, kto naprawdę jest na czacie",
				description: "Liczba w nawiasie pokazuje, ile osób naprawdę siedzi na czacie.",
			},
			attachments: {
				title: "Obrazki prosto w czacie",
				description: "Wklej link, a każdy z Enhancerem zobaczy obrazek.",
			},
			latency: {
				title: "Dogoń transmisję",
				description: "Zobacz swoje opóźnienie i pozwól Enhancerowi je skrócić.",
			},
			emotebar: {
				title: "Ulubione emotki pod ręką",
				description: "Emotki, których najczęściej używasz na kanale, nad polem czatu.",
			},
		},
	},
	more: ["…i ", "dużo więcej."],
	settings: {
		kicker: "Ustawienia",
		title: ["Ustaw ", "po swojemu."],
		lede: "Każdą funkcję możesz wyłączyć albo zmienić. Ustawienia zostają w tej przeglądarce.",
		steps: [
			{ title: "Otwórz Twitcha albo Kicka", text: ["Dowolna strona, stream albo strona główna."] },
			{ title: "Kliknij logo Enhancera", text: ["Szukaj ", " na górnym pasku, obok swojego profilu."] },
			{
				title: "Wybierz, co chcesz",
				text: ["Włączaj i wyłączaj funkcje. Zmiany działają we wszystkich otwartych kartach."],
			},
		],
	},
	account: {
		kicker: "Twoje konto Enhancera",
		title: ["Twój czat, ", "Twoje zasady."],
		lede: "Jedno konto dla Twitcha, Kicka i Discorda. Dawaj widzom odznaki i nicki, a swoje pokazuj w każdym czacie. Do korzystania z rozszerzenia konto nie jest potrzebne.",
		points: [
			{ title: "Połącz konta", text: "Twitch, Kick i Discord w jednym miejscu." },
			{ title: "Odznaki kanału", text: "Twórz je i dawaj widzom." },
			{ title: "Nicki i zespół", text: "Ustawiaj nicki widzom i zaproś moderatorów do pomocy." },
		],
		cta: "Zacznij",
		support: {
			title: "Chcesz nas wesprzeć?",
			text: "Wszystkie funkcje rozszerzenia są i zawsze będą darmowe, bez reklam. Jeśli chcesz pomóc w rozwoju Enhancera, wybierz plan wsparcia. W zamian dostaniesz dodatki wyglądu w czacie, które widzi każdy z Enhancerem.",
			cta: "Wesprzyj Enhancera",
			perks: ["Odznaka wspierającego", "Świecący nick", "Własny font", "Własny nick"],
			nick: "TwójNick",
		},
	},
	principles: {
		label: "Nasze zasady",
		free: {
			title: ["Za darmo, ", "na zawsze."],
			text: "Każda funkcja rozszerzenia jest darmowa, bez reklam, i zawsze taka zostanie. Jeśli chcesz, możesz nas wesprzeć, kupując dodatki wyglądu w czacie, ale nie są potrzebne do niczego.",
		},
		open: {
			title: ["Otwarty ", "kod."],
			text: "Cały kod rozszerzenia jest publiczny na GitHubie. Przeczytaj go, zgłoś problem albo wyślij pull request.",
			link: "Zobacz kod",
		},
		privacy: {
			title: ["Prywatność ", "przede wszystkim."],
			text: "Ustawienia i czas oglądania są zapisane tylko w Twojej przeglądarce, nigdy na naszych serwerach. Możesz je w każdej chwili wyeksportować do pliku.",
		},
	},
	footer: {
		tagline: "Darmowe rozszerzenie z otwartym kodem, które dodaje to, czego brakuje na Twitchu i Kicku.",
		disclaimer: "Nie jesteśmy powiązani z Twitch Interactive ani z Kick.",
	},
};

export const copy = locale === "pl" ? pl : en;
