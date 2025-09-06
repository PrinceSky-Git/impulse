/**
 * Chat Plugin: Hybrid Definition Lookup
 * Command: /define [term]
 * - Pokémon terms → redirect to /dt (uses PS native info panels)
 * - Other words → dictionary definition (always enabled)
 *
 * Author: ChatGPT (2025)
 */

import {Dex} from '../sim/dex';
import {Net} from '../lib/net';

const DICTIONARY_API = `https://api.dictionaryapi.dev/api/v2/entries/en/`;

export const commands: ChatCommands = {
	async define(target, room, user) {
		if (!target) return this.errorReply("Usage: /define [word | Pokémon | move | ability | item]");

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

		// --- Dictionary API lookup ---
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
		`/define [word] - Shows dictionary definition of an English word (always enabled).`,
	],
};
