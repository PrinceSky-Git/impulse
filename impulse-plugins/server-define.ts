import {Dex} from '../sim/dex';
import {Net} from '../lib/net';

const DICTIONARY_API = `https://api.dictionaryapi.dev/api/v2/entries/en/`;

export const commands: ChatCommands = {
	async define(target, room, user) {
		if (!target) return this.errorReply("Usage: /define [word | Pokémon | move | ability | item]");
		this.checkCan('talk');

		const term = target.trim();
		const id = toID(term);

		// --- Pokémon-related → redirect to /dt ---
		if (
			Dex.species.get(id).exists ||
			Dex.moves.get(id).exists ||
			Dex.items.get(id).exists ||
			Dex.abilities.get(id).exists
		) {
			return this.parse(`/dt ${term}`);
		}

		if (toID(term) === 'toggle') {
			if (!room) return this.errorReply(`/define toggle can only be used in chatrooms.`);
			if (!this.can('declare', null, room)) return;

			room.settings.allowDictionaryDefinitions = !room.settings.allowDictionaryDefinitions;
			room.saveSettings();
			this.addModAction(
				`${user.name} toggled dictionary definitions to ` +
				(room.settings.allowDictionaryDefinitions ? 'ON' : 'OFF')
			);
			return;
		}

		if (room && !room.settings.allowDictionaryDefinitions) {
			return this.errorReply(`Dictionary definitions are not enabled in this room.`);
		}

		try {
			const response = await Net(`GET ${DICTIONARY_API}${encodeURIComponent(term)}`).getJson();
			if (!response || !Array.isArray(response) || !response[0]?.meanings) {
				return this.errorReply(`No definition found for "${term}".`);
			}

			const meaning = response[0].meanings[0];
			const definition = meaning.definitions[0].definition;

			return this.sendReplyBox(
				`<div style="padding:5px;">` +
				`<table style="border:1px solid #888;border-radius:8px;padding:5px;width:100%;background:#fff;">` +
				`<tr><td>` +
				`<strong>${term}</strong> <small>(${meaning.partOfSpeech})</small><br />` +
				`${definition}` +
				`</td></tr></table></div>`
			);
		} catch (err: any) {
			return this.errorReply(`No definition found for "${term}".`);
		}
	},

	def: 'define',
	definition: 'define',

	definehelp: [
		`/define [term] - Shows information about a Pokémon, move, ability, or item (redirects to /dt).`,
		`/define [word] - Shows dictionary definition of an English word.`,
		`   • Always works in PMs.`,
		`   • In chatrooms, requires dictionary definitions to be enabled (default: on).`,
		`/define toggle - (Roomstaff) Toggle dictionary definitions in this room.`,
	],
};

export const roomSettings: ChatRoomSettingsTable = {
	allowDictionaryDefinitions: {
		label: "Allow /define to fetch non-Pokémon dictionary definitions",
		type: 'boolean',
		default: true,
	},
};
