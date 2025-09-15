/*************************************
 * Pokemon Safari Zone Renderer      *
 * Author: adapted by ChatGPT (2025) *
 * All HTML concatenated with '' +   *
 ************************************/

import { MovementDirection } from './safari-types';

export class SafariRenderer {
    constructor() {}

    // Unique uhtml id for a given room and player
    getUhtmlId(roomid: string, userid: string) {
        // keep only safe chars
        return 'safari-' + roomid.replace(/[^a-zA-Z0-9-_]/g, '') + '-' + userid;
    }

    // Spectator uhtml id
    getSpectatorUhtmlId(userid: string) {
        return 'safari-spectator-' + userid;
    }

    // Lobby / Waiting room UI (before game start or when player not in a run)
    renderLobbyUI(game: any, roomid: string, userid: string) {
        const host = game.getHost ? game.getHost() : null;
        const status = game.getStatus ? game.getStatus() : 'waiting';
        const playersCount = Object.keys((game as any).players || {}).length;
        return '' +
            '<div class="safari-ui" style="border:1px solid #888;padding:8px;border-radius:6px;background:#f8f8f8;max-width:420px">' +
                '<div style="text-align:center;font-weight:bold;margin-bottom:6px;">Safari Zone</div>' +
                '<div style="font-size:90%;margin-bottom:6px;">' +
                    'Status: ' + status + ' | Players: ' + playersCount +
                '</div>' +
                '<div style="text-align:center;margin:6px 0;">' +
                    '<button class="button" name="send" value="/safari join">Join</button> ' +
                    '<button class="button" name="send" value="/safari leave">Leave</button> ' +
                    (status === 'waiting' ? '<button class="button" name="send" value="/safari start">Start Game</button> ' : '') +
                    '<button class="button" name="send" value="/safari help">Help</button>' +
                '</div>' +
            '</div>';
    }

    // Render UI when it's a player's turn (show movement controls and action area)
    renderPlayerTurnUI(game: any, roomid: string, userid: string) {
        const state = game.getMovementState ? game.getMovementState(userid) : undefined;
        const player = (game as any).players?.[userid] || { name: userid, ballsLeft: 0 };
        const isYourTurn = !!state && state.isCurrentTurn;
        const pokemon = state?.currentPokemon ?? null;
        const ballsLeft = player.ballsLeft ?? 0;

        // Top header
        let html = '' +
        '<div class="safari-ui" style="border:1px solid #888;padding:8px;border-radius:6px;background:#fbfbfb;max-width:460px">' +
            '<div style="text-align:center;font-weight:bold;margin-bottom:6px;">Safari Zone — ' + player.name + '</div>' +
            '<div style="font-size:90%;margin-bottom:6px;text-align:center;">Balls: ' + ballsLeft + ' | Turn: ' + (isYourTurn ? 'Your turn' : 'Waiting') + '</div>';

        // If pokemon is present show encounter UI
        if (pokemon) {
            const sprite = pokemon.sprite || ('https://play.pokemonshowdown.com/sprites/ani/' + pokemon.name.toLowerCase() + '.gif');
            html += '' +
                '<div style="text-align:center;">' +
                    '<img src="' + sprite + '" width="96" height="96" alt="' + pokemon.name + '"><br>' +
                    '<strong>A wild ' + pokemon.name + ' appeared!</strong>' +
                '</div>' +
                '<div style="text-align:center;margin-top:8px;">' +
                    '<button class="button" name="send" value="/safari throwball">🎯 Throw Ball (' + ballsLeft + ')</button> ' +
                    '<button class="button" name="send" value="/safari run">🏃 Run</button>' +
                '</div>';
        } else {
            // Movement controls
            html += '' +
                '<div style="text-align:center;margin-top:6px;">' +
                    '<div>' +
                        '<button class="button" name="send" value="/safari move up">▲</button>' +
                    '</div>' +
                    '<div style="margin-top:6px;">' +
                        '<button class="button" name="send" value="/safari move left">◀</button> ' +
                        '<button class="button" name="send" value="/safari move down">▼</button> ' +
                        '<button class="button" name="send" value="/safari move right">▶</button>' +
                    '</div>' +
                '</div>' +
                '<div style="text-align:center;margin-top:8px;font-size:90%;">Move to search the area for Pokémon.</div>';
        }

        html += '</div>';
        return html;
    }

    // Generic message UI when something happened (caught, fled, out of balls, etc.)
    renderMessageUI(game: any, roomid: string, userid: string, message: string) {
        const player = (game as any).players?.[userid] || { name: userid, ballsLeft: 0 };
        const ballsLeft = player.ballsLeft ?? 0;
        return '' +
            '<div class="safari-ui" style="border:1px solid #aaa;padding:8px;border-radius:6px;background:#fff;max-width:420px">' +
                '<div style="text-align:center;font-weight:bold;margin-bottom:6px;">' + message + '</div>' +
                '<div style="text-align:center;font-size:90%;">Balls: ' + ballsLeft + '</div>' +
                '<div style="text-align:center;margin-top:6px;">' +
                    '<button class="button" name="send" value="/safari search">Search Again</button> ' +
                    '<button class="button" name="send" value="/safari leave">Leave</button>' +
                '</div>' +
            '</div>';
    }

    // Render spectator UI (simple view)
    renderSpectatorUI(game: any, spectatorId: string) {
        const roomPlayers = (game as any).players || {};
        let html = '' +
            '<div class="safari-ui" style="border:1px solid #ccc;padding:8px;border-radius:6px;background:#f7f7f7;max-width:420px">' +
                '<div style="text-align:center;font-weight:bold;margin-bottom:6px;">Safari Spectator View</div>' +
                '<div style="font-size:90%;margin-bottom:6px;">Players:</div>' +
                '<div style="margin-bottom:6px;">';

        for (const pid in roomPlayers) {
            const p = roomPlayers[pid];
            html += '' + '<div style="margin:3px 0;">' + p.name + ' — Balls: ' + (p.ballsLeft ?? 0) + '</div>';
        }
        html += '' +
                '</div>' +
                '<div style="text-align:center;">' +
                    '<button class="button" name="send" value="/safari unspectate">Stop Spectating</button>' +
                '</div>' +
            '</div>';
        return html;
    }
}
