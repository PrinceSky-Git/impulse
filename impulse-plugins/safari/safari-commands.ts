/**************************************
 * Pokemon Safari Zone Game Commands  *
 * Updated to use uhtml / uhtmlchange *
 **************************************/

import { SafariGame } from './safari-game-core';
import { SAFARI_CONSTANTS, MovementDirection } from './safari-types';
import { SafariRenderer } from './safari-renderer';

const renderer = new SafariRenderer();

export const commands: Chat.ChatCommands = {
    safari(target, room, user) {
        if (!room) return this.errorReply("This command can only be used in a room.");
        const [rawCmd, ...args] = target.split(' ');
        const cmd = (rawCmd || '').toLowerCase();

        // shorthand helper to update player's uhtml block
        const updatePlayerUI = (game: SafariGame, userid: string) => {
            const rid = room.id || 'room';
            const uid = userid;
            const uidBlock = renderer.getUhtmlId(rid, uid);
            const html = (game.getStatus && game.getStatus() === 'waiting')
                ? renderer.renderLobbyUI(game, rid, uid)
                : renderer.renderPlayerTurnUI(game, rid, uid);
            // if no existing block, create it, otherwise change it
            // we cannot easily detect if block exists server-side, but it's safe to always call uhtmlchange after uhtml
            // create initial uhtml if not present:
            room.add('|uhtml|'+uidBlock+'|'+html);
            room.update();
        };

        switch (cmd) {
            case 'new':
            case 'create': {
                // create a new game for the room
                if (room.safari) return this.errorReply("There is already a Safari game in this room.");
                // create and attach a new SafariGame instance to the room
                // SafariGame constructor in your core likely expects (room, host?) — adapt if needed
                // Here we assume new SafariGame(room, hostId) or simply new SafariGame(room)
                // If your core uses different constructor args, change the line below accordingly.
                (room as any).safari = new SafariGame(room);
                this.addModAction(user.name + " created a Safari Zone game.");
                return;
            }

            case 'join': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                const error = (room.safari as any).addPlayer?.(user.id, user.name);
                if (error) return this.errorReply(error);
                // initial render of player's UI block
                const uidBlock = renderer.getUhtmlId(room.id, user.id);
                room.add('|uhtml|'+uidBlock+'|'+renderer.renderLobbyUI(room.safari, room.id, user.id));
                room.update();
                return;
            }

            case 'leave': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                (room.safari as any).removePlayer?.(user.id);
                // blank out player's block
                const uidBlock = renderer.getUhtmlId(room.id, user.id);
                room.add('|uhtmlchange|'+uidBlock+'|<div style="padding:6px;">You left the Safari game.</div>');
                room.update();
                return;
            }

            case 'start': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                const err = (room.safari as any).start?.(user.id);
                if (err) return this.errorReply(err);
                // render UI for all players
                const players = Object.keys((room.safari as any).players || {});
                for (const pid of players) {
                    const uidBlock = renderer.getUhtmlId(room.id, pid);
                    room.add('|uhtml|'+uidBlock+'|'+renderer.renderPlayerTurnUI(room.safari, room.id, pid));
                }
                room.update();
                return;
            }

            case 'move': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                const dir = (args[0] || '').toLowerCase() as MovementDirection;
                if (!dir || !['up','down','left','right'].includes(dir)) return this.errorReply("Invalid direction. Use up/down/left/right.");
                const res = (room.safari as any).handleMovement?.(user.id, dir);
                // render player's UI change
                const uidBlock = renderer.getUhtmlId(room.id, user.id);
                // If handleMovement returned a message, show it; otherwise re-render the player UI
                if (typeof res === 'string') {
                    room.add('|uhtmlchange|'+uidBlock+'|'+renderer.renderMessageUI(room.safari, room.id, user.id, res));
                } else {
                    room.add('|uhtmlchange|'+uidBlock+'|'+renderer.renderPlayerTurnUI(room.safari, room.id, user.id));
                }
                room.update();
                return;
            }

            case 'throwball': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                const result = (room.safari as any).throwBall?.(user.id);
                const uidBlock = renderer.getUhtmlId(room.id, user.id);
                // result expected to be a string message like 'You caught ...' or 'It broke free'
                room.add('|uhtmlchange|'+uidBlock+'|'+renderer.renderMessageUI(room.safari, room.id, user.id, String(result)));
                room.update();
                return;
            }

            case 'run': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                const runMsg = (room.safari as any).run?.(user.id) || 'You ran away!';
                const uidBlock = renderer.getUhtmlId(room.id, user.id);
                room.add('|uhtmlchange|'+uidBlock+'|'+renderer.renderMessageUI(room.safari, room.id, user.id, String(runMsg)));
                room.update();
                return;
            }

            case 'spectate': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                (room.safari as any).addSpectator?.(user.id);
                const spectatorId = renderer.getSpectatorUhtmlId(user.id);
                room.add('|uhtml|'+spectatorId+'|'+renderer.renderSpectatorUI(room.safari, user.id));
                room.update();
                return;
            }

            case 'unspectate': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                (room.safari as any).removeSpectator?.(user.id);
                const spectatorId = renderer.getSpectatorUhtmlId(user.id);
                room.add('|uhtmlchange|'+spectatorId+'|');
                room.update();
                return;
            }

            case 'end': {
                if (!room.safari) return this.errorReply("There is no Safari game running in this room.");
                (room.safari as any).end?.();
                for (const pid in (room.safari as any).players || {}) {
                    const uidBlock = renderer.getUhtmlId(room.id, pid);
                    room.add('|uhtmlchange|'+uidBlock+'|<div style="padding:6px;">Safari game ended.</div>');
                }
                room.safari = undefined;
                room.update();
                return;
            }

            case 'help': {
                this.sendReplyBox('' +
                    '<b>Safari Zone Commands</b><br />' +
                    '/safari create - create a Safari game for this room<br />' +
                    '/safari join - join the game<br />' +
                    '/safari leave - leave the game<br />' +
                    '/safari start - start the game (host only)<br />' +
                    '/safari move &lt;up|down|left|right&gt; - move on your turn<br />' +
                    '/safari throwball - throw a Safari Ball when a Pokemon appears<br />' +
                    '/safari run - flee the encounter<br />' +
                    '/safari spectate - spectate the running game in this room'
                );
                return;
            }

            default: {
                return this.errorReply("Unknown subcommand for /safari. Use /safari help for available commands.");
            }
        }
    },
};
																										 
