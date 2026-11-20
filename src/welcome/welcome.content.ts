import type { WelcomeCopy, WelcomeFeature } from "$types/welcome/welcome.types.ts";
import { locale } from "./scenes/locale.ts";

export const links = {
	twitch: "https://www.twitch.tv/",
	kick: "https://kick.com/",
};

export const features: WelcomeFeature[] = [
	{
		id: "follows",
		platforms: ["Twitch", "Kick"],
		setting: { scope: "global", key: "crossPlatformFollowsSyncEnabled" },
	},
	{
		id: "home",
		platforms: ["Twitch", "Kick"],
		setting: { scope: "global", key: "followsHomeEnabled" },
		requires: "follows",
	},
	{
		id: "attachments",
		platforms: ["Twitch", "Kick"],
		setting: { scope: "platform", key: "chatImagesEnabled", platforms: ["twitch", "kick"] },
	},
	{
		id: "latency",
		platforms: ["Twitch", "Kick"],
		setting: { scope: "platform", key: "streamLatencyReducerEnabled", platforms: ["twitch", "kick"] },
	},
	{
		id: "emotebar",
		platforms: ["Twitch"],
		setting: { scope: "platform", key: "emoteBarEnabled", platforms: ["twitch"] },
	},
	{
		id: "grouping",
		platforms: ["Twitch", "Kick"],
		setting: { scope: "platform", key: "chatMessageGroupingEnabled", platforms: ["twitch", "kick"] },
	},
];

const en: WelcomeCopy = {
	title: "Welcome to Enhancer",
	skip: "Skip",
	step: (current, total) => `${current} / ${total}`,
	previous: "Previous",
	next: "Next",
	goTo: (title) => `Go to ${title}`,
	intro: {
		kicker: "Enhancer is installed",
		title: ["You're all ", "set."],
		lede: "Enhancer already works on Twitch and Kick. Some of our best features are off until you turn them on. Take a minute and pick yours.",
		start: "Show me",
	},
	feature: {
		turnOn: "Turn it on",
		on: "On",
		turnOff: "Turn off",
		requires: (title) => `Needs “${title}”. Turn that on first.`,
		showRequired: "Go back to it",
		error: "Couldn't save this. Try again, or change it later in the settings.",
		available: "Available on",
	},
	features: {
		follows: {
			title: "One list for all your follows",
			description:
				"See the channels you follow on Twitch and Kick together in the sidebar. Pin your favourites to keep them on top.",
			note: "Enhancer uses your Kick login only to load your follows and check who is live. It stays encrypted on this computer and is never sent to Enhancer. After turning this on, open twitch.tv and kick.com once while logged in.",
		},
		home: {
			title: "Your streams on the home page",
			description:
				"Replace the Twitch and Kick home pages with the live streams you follow on both sites. Hover a stream to watch a muted preview.",
		},
		attachments: {
			title: "Images right in chat",
			description: "Paste an image link and everyone with Enhancer sees the picture right in chat.",
			note: "Enhancer doesn't moderate images that people send, so some of them may be unpleasant. You can show them only on hover in the settings.",
			warning: true,
		},
		latency: {
			title: "Catch up with the stream",
			description:
				"Enhancer already shows your stream delay above chat. Turn this on and it speeds playback up a little until you're close to live again.",
			note: "On Twitch it works only with Low Latency Mode turned on.",
		},
		emotebar: {
			title: "Your emotes, one click away",
			description:
				"The emotes you use most on a channel, right above the chat box. Click to insert one, Ctrl+Click to send it.",
		},
		grouping: {
			title: "A tidier chat",
			description: "When someone sends a few messages in a row, their name shows only on the first one.",
		},
	},
	done: {
		kicker: "Done",
		title: ["Enjoy ", "the stream."],
		lede: "You can change all of this later. Click the Enhancer logo in the top bar on Twitch or Kick.",
		on: "On",
		off: "Off",
		change: "Change",
		already: "Already on: the real chatters count and your stream delay.",
		openTwitch: "Open Twitch",
		openKick: "Open Kick",
	},
};

const pl: WelcomeCopy = {
	title: "Witaj w Enhancerze",
	skip: "Pomiń",
	step: (current, total) => `${current} / ${total}`,
	previous: "Wstecz",
	next: "Dalej",
	goTo: (title) => `Przejdź do: ${title}`,
	intro: {
		kicker: "Enhancer jest zainstalowany",
		title: ["Wszystko ", "gotowe."],
		lede: "Enhancer działa już na Twitchu i Kicku. Część najlepszych funkcji jest wyłączona, dopóki ich nie włączysz. Poświęć minutę i wybierz swoje.",
		start: "Pokaż",
	},
	feature: {
		turnOn: "Włącz",
		on: "Włączone",
		turnOff: "Wyłącz",
		requires: (title) => `Wymaga funkcji „${title}”. Najpierw ją włącz.`,
		showRequired: "Wróć do niej",
		error: "Nie udało się zapisać. Spróbuj ponownie albo zmień to później w ustawieniach.",
		available: "Dostępne na",
	},
	features: {
		follows: {
			title: "Wszyscy obserwowani na jednej liście",
			description:
				"Kanały, które obserwujesz na Twitchu i Kicku, razem na pasku bocznym. Przypnij ulubionych, żeby byli na górze.",
			note: "Enhancer używa Twojego logowania do Kicka tylko po to, żeby wczytać obserwowanych i sprawdzić, kto nadaje. Jest zaszyfrowane na tym komputerze i nigdy nie trafia do Enhancera. Po włączeniu otwórz raz twitch.tv i kick.com, będąc zalogowanym.",
		},
		home: {
			title: "Twoje streamy na stronie głównej",
			description:
				"Strona główna Twitcha i Kicka pokazuje streamy na żywo, które obserwujesz na obu stronach. Najedź na stream, żeby zobaczyć podgląd bez dźwięku.",
		},
		attachments: {
			title: "Obrazki prosto w czacie",
			description: "Wklej link do obrazka, a każdy z Enhancerem zobaczy go w czacie.",
			note: "Enhancer nie moderuje obrazków wysyłanych przez innych, więc niektóre mogą być nieprzyjemne. W ustawieniach możesz je pokazywać tylko po najechaniu.",
			warning: true,
		},
		latency: {
			title: "Dogoń transmisję",
			description:
				"Enhancer już pokazuje opóźnienie nad czatem. Po włączeniu lekko przyspieszy stream, aż znów będziesz blisko na żywo.",
			note: "Na Twitchu działa tylko z włączonym trybem niskiego opóźnienia.",
		},
		emotebar: {
			title: "Ulubione emotki pod ręką",
			description:
				"Emotki, których najczęściej używasz na kanale, nad polem czatu. Kliknij, żeby wstawić, Ctrl+klik, żeby od razu wysłać.",
		},
		grouping: {
			title: "Czytelniejszy czat",
			description: "Gdy ktoś wyśle kilka wiadomości pod rząd, jego nick pokaże się tylko przy pierwszej.",
		},
	},
	done: {
		kicker: "Gotowe",
		title: ["Miłego ", "oglądania."],
		lede: "Wszystko możesz później zmienić. Kliknij logo Enhancera na górnym pasku Twitcha albo Kicka.",
		on: "Włączone",
		off: "Wyłączone",
		change: "Zmień",
		already: "Już działa: prawdziwa liczba osób na czacie i opóźnienie streamu.",
		openTwitch: "Otwórz Twitcha",
		openKick: "Otwórz Kicka",
	},
};

export const copy = locale === "pl" ? pl : en;
