import {SafariGame} from './safari-game-core';

export class SafariRenderer {
	renderSearchUI(game: SafariGame) {
		return '' +
		'<div style="border:1px solid #aaa;border-radius:6px;padding:8px;background:#f9f9f9;">' +
			'<div style="font-weight:bold;margin-bottom:4px;">Safari Zone</div>' +
			'<div style="margin:6px 0;">' +
				'Balls: ' + game.balls + ' | Bait: ' + game.bait + ' | Rocks: ' + game.rocks +
			'</div>' +
			'<div style="text-align:center;margin-top:6px;">' +
				'<button class="button" name="send" value="/safari search">🌿 Search Grass</button>' +
				'<button class="button" name="send" value="/safari pc">📦 View PC</button>' +
			'</div>' +
		'</div>';
	}

	renderEncounterUI(game: SafariGame) {
		if (!game.currentPokemon) return this.renderSearchUI(game);
		const mon = game.currentPokemon;
		return '' +
		'<div style="border:1px solid #aaa;border-radius:6px;padding:8px;background:#f9f9f9;">' +
			'<div style="text-align:center;">' +
				'<img src="' + mon.sprite + '" height="80"><br>' +
				'<strong>' + mon.name + '</strong> appeared!' +
			'</div>' +
			'<div style="margin:6px 0;">' +
				'Balls: ' + game.balls + ' | Bait: ' + game.bait + ' | Rocks: ' + game.rocks +
			'</div>' +
			'<div style="text-align:center;margin-top:6px;">' +
				'<button class="button" name="send" value="/safari throwball">🎯 Throw Ball</button>' +
				'<button class="button" name="send" value="/safari throwbait">🍎 Throw Bait</button>' +
				'<button class="button" name="send" value="/safari throwrock">🪨 Throw Rock</button>' +
				'<button class="button" name="send" value="/safari run">🏃 Run</button>' +
				'<button class="button" name="send" value="/safari pc">📦 View PC</button>' +
			'</div>' +
		'</div>';
	}

	renderMessageUI(message: string, game: SafariGame) {
		return '' +
		'<div style="border:1px solid #aaa;border-radius:6px;padding:8px;background:#fdfdfd;">' +
			'<div style="margin-bottom:6px;">' + message + '</div>' +
			'<div style="margin:6px 0;">' +
				'Balls: ' + game.balls + ' | Bait: ' + game.bait + ' | Rocks: ' + game.rocks +
			'</div>' +
			'<div style="text-align:center;margin-top:6px;">' +
				'<button class="button" name="send" value="/safari search">🌿 Search Grass</button>' +
				'<button class="button" name="send" value="/safari pc">📦 View PC</button>' +
			'</div>' +
		'</div>';
	}
}
