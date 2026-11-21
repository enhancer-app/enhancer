export type SceneLocale = "en" | "pl";

export const locale: SceneLocale = /^pl\b/i.test(navigator.language) ? "pl" : "en";

export const ui = {
	en: {
		input: "Send a message",
		chat: "Chat",
		forYou: "For You",
		loading: "Loading...",
		latency: "Latency",
		chattersTip: "Chatters are logged-in users in a stream’s chatroom. Click here to refresh the counter.",
		imagePreview: "Image preview",
		imageNote: "This image will be shown in chat.",
	},
	pl: {
		input: "Wyślij wiadomość",
		chat: "Czat",
		forYou: "Dla Ciebie",
		loading: "Ładowanie...",
		latency: "Opóźnienie",
		chattersTip: "Czatujący to zalogowani użytkownicy na czacie streamu. Kliknij, aby odświeżyć licznik.",
		imagePreview: "Podgląd obrazka",
		imageNote: "Ten obrazek pojawi się na czacie.",
	},
}[locale];
