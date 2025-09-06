/*
Emoticon plugin
This plugin allows you to use emoticons in both chat rooms (as long as they are enabled in the room) and private messages.
*/

import Autolinker from 'autolinker';

interface EmoticonData {
	[key: string]: string;
}

interface IgnoreEmotesData {
	[userId: string]: boolean;
}

function parseMessage(message: string): string {
	if (message.substr(0, 5) === "/html") {
		message = message.substr(5);
		message = message.replace(/\_\_([^< ](?:[^<]*?[^< ])?)\_\_(?![^<]*?<\/a)/g, '<i>$1</i>'); // italics
		message = message.replace(/\*\*([^< ](?:[^<]*?[^< ])?)\*\*/g, '<b>$1</b>'); // bold
		message = message.replace(/\~\~([^< ](?:[^<]*?[^< ])?)\~\~/g, '<strike>$1</strike>'); // strikethrough
		message = message.replace(/&lt;&lt;([a-z0-9-]+)&gt;&gt;/g, '&laquo;<a href="/$1" target="_blank">$1</a>&raquo;'); // <<roomid>>
		message = Autolinker.link(message.replace(/&#x2f;/g, '/'), { stripPrefix: false, phone: false, twitter: false });
		return message;
	}
	message = Chat.escapeHTML(message).replace(/&#x2f;/g, '/');
	message = message.replace(/\_\_([^< ](?:[^<]*?[^< ])?)\_\_(?![^<]*?<\/a)/g, '<i>$1</i>'); // italics
	message = message.replace(/\*\*([^< ](?:[^<]*?[^< ])?)\*\*/g, '<b>$1</b>'); // bold
	message = message.replace(/\~\~([^< ](?:[^<]*?[^< ])?)\~\~/g, '<strike>$1</strike>'); // strikethrough
	message = message.replace(/&lt;&lt;([a-z0-9-]+)&gt;&gt;/g, '&laquo;<a href="/$1" target="_blank">$1</a>&raquo;'); // <<roomid>>
	message = Autolinker.link(message, { stripPrefix: false, phone: false, twitter: false });
	return message;
}
Impulse.parseMessage = parseMessage;

function escapeRegExp(str: string): string {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // eslint-disable-line no-useless-escape
}

let emoticons: EmoticonData = { "lmao": "https://cdn3.emoji.gg/emojis/32868-pepe-lmfaoooo.gif" };
let emoteRegex: RegExp = new RegExp("lmao", "g");
Impulse.ignoreEmotes = {} as IgnoreEmotesData;

// Load ignore emotes from database
try {
	const ignoreEmotesData = db.ignoreEmotes.valuesSync() as IgnoreEmotesData;
	if (ignoreEmotesData && Object.keys(ignoreEmotesData).length > 0) {
		Impulse.ignoreEmotes = ignoreEmotesData;
	}
} catch (e) {
	// Ignore errors during initial load
}

function loadEmoticons(): void {
	try {
		const emoticonsData = db.emoticons.valuesSync() as EmoticonData;
		if (emoticonsData && Object.keys(emoticonsData).length > 0) {
			emoticons = emoticonsData;
		}
		const emoteArray: string[] = [];
		for (const emote in emoticons) {
			emoteArray.push(escapeRegExp(emote));
		}
		emoteRegex = new RegExp(`(${emoteArray.join('|')})`, 'g');
	} catch (e) {
		// Ignore errors during loading
	}
}
loadEmoticons();

function saveEmoticons(): void {
	db.emoticons.clearSync(true);
	db.emoticons.insertSync(emoticons);
	const emoteArray: string[] = [];
	for (const emote in emoticons) {
		emoteArray.push(escapeRegExp(emote));
	}
	emoteRegex = new RegExp(`(${emoteArray.join('|')})`, 'g');
}

function parseEmoticons(message: string, room?: Room): string | false {
	if (emoteRegex.test(message)) {
		message = Impulse.parseMessage(message).replace(emoteRegex, (match: string): string => {
			return `<img src="${emoticons[match]}" title="${match}" height="32" width="32">`;
		});
		return message;
	}
	return false;
}
Impulse.parseEmoticons = parseEmoticons;

export const commands: ChatCommands = {
	blockemote: "ignoreemotes",
	blockemotes: "ignoreemotes",
	blockemoticon: "ignoreemotes",
	blockemoticons: "ignoreemotes",
	ignoreemotes() {
		this.parse('/emoticons ignore');
	},

	unblockemote: "unignoreemotes",
	unblockemotes: "unignoreemotes",
	unblockemoticon: "unignoreemotes",
	unblockemoticons: "unignoreemotes",
	unignoreemotes() {
		this.parse('/emoticons unignore');
	},

	emoticons: "emoticon",
	emote: "emoticon",
	emotes: "emoticon",
	emoticon: {
		add(target: string, room: Room, user: User) {
			room = this.requireRoom();
			this.checkCan('ban', null, room);
			if (!target) return this.parse("/emoticonshelp");

			const targetSplit: string[] = target.split(",");
			for (let u = 0; u < targetSplit.length; u++) {
				targetSplit[u] = targetSplit[u].trim();
			}

			if (!targetSplit[1]) return this.parse("/emoticonshelp");
			if (targetSplit[0].length > 10) return this.errorReply("Emoticons may not be longer than 10 characters.");
			if (emoticons[targetSplit[0]]) return this.errorReply(`${targetSplit[0]} is already an emoticon.`);

			emoticons[targetSplit[0]] = targetSplit[1];
			saveEmoticons();

			this.sendReply(`|raw|The emoticon ${Chat.escapeHTML(targetSplit[0])} has been added: <img src="${targetSplit[1]}" width="40" height="40">`);
		},

		delete: "del",
		remove: "del",
		rem: "del",
		del(target: string, room: Room, user: User) {
			room = this.requireRoom();
			this.checkCan('ban', null, room);
			if (!target) return this.parse("/emoticonshelp");
			if (!emoticons[target]) return this.errorReply("That emoticon does not exist.");

			delete emoticons[target];
			saveEmoticons();

			this.sendReply("That emoticon has been removed.");
		},

		toggle(target: string, room: Room, user: User) {
			room = this.requireRoom();
			this.checkCan('ban', null, room);
			if (!room.disableEmoticons) {
				room.disableEmoticons = true;
				Rooms.global.writeChatRoomData();
				this.modlog('EMOTES', null, 'disabled emoticons');
				this.privateModAction(`(${user.name} disabled emoticons in this room.)`);
			} else {
				room.disableEmoticons = false;
				Rooms.global.writeChatRoomData();
				this.modlog('EMOTES', null, 'enabled emoticons');
				this.privateModAction(`(${user.name} enabled emoticons in this room.)`);
			}
		},

		view: "list",
		list(target: string, room: Room, user: User) {
			if (!this.runBroadcast()) return;

			let reply = `<strong><u>Emoticons (${Object.keys(emoticons).length})</u></strong><br />`;
			for (const emote in emoticons) {
				reply += `(${emote} <img src="${emoticons[emote]}" height="40" width="40">)`;
			}
			this.sendReply(`|raw|<div class="infobox infobox-limited">${reply}</div>`);
		},

		ignore(target: string, room: Room, user: User) {
			if (Impulse.ignoreEmotes[user.id]) return this.errorReply('You are already ignoring emoticons.');
			Impulse.ignoreEmotes[user.id] = true;
			db.ignoreEmotes.insertSync(user.id, true);
			this.sendReply('You are now ignoring emoticons.');
		},

		unignore(target: string, room: Room, user: User) {
			if (!Impulse.ignoreEmotes[user.id]) return this.errorReply('You aren\'t ignoring emoticons.');
			delete Impulse.ignoreEmotes[user.id];
			db.ignoreEmotes.removeSync(user.id);
			this.sendReply('You are no longer ignoring emoticons.');
		},

		"": "help",
		help() {
			this.parse('/emoticonshelp');
		},
	},

	randemote() {
		if (!this.canTalk()) return;
		const emoteKeys = Object.keys(emoticons);
		const randomEmote = emoteKeys[Math.floor(Math.random() * emoteKeys.length)];
		this.parse(randomEmote);
	},

	emoticonshelp(target: string, room: Room, user: User) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			'<div><b><center>Emoticon Commands</center></b><br>' +
			'<ul>' +
			'<li><code>/emoticon</code> may be substituted with <code>/emoticons</code>, <code>/emotes</code>, or <code>/emote</code></li><br>' +
			'<li><code>/emoticon add [name], [url]</code> - Adds an emoticon. (Requires: @, &, #, ~)</li><br>' +
			'<li><code>/emoticon del/delete/remove/rem [name]</code> - Removes an emoticon. (Requires: @, &, #, ~)</li><br>' +
			'<li><code>/emoticon toggle</code> - Enables or disables emoticons in the current room depending on if they are already active. (Requires: @, &, #, ~)</li><br>' +
			'<li><code>/emoticon view/list</code> - Displays the list of emoticons.</li><br>' +
			'<li><code>/emoticon ignore</code> - Ignores emoticons in chat messages.</li><br>' +
			'<li><code>/emoticon unignore</code> - Unignores emoticons in chat messages.</li><br>' +
			'<li><code>/randemote</code> - Randomly sends an emote from the emoticon list.</li><br>' +
			'<li><code>/emoticon help</code> - Displays this help command.</li>' +
			'</ul></div>'
		);
	},
};
