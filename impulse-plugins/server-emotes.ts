/*
Emoticon plugin
This plugin allows you to use emoticons in both chat rooms (as long as they are enabled in the room) and private messages.
*/

import { FS } from '../lib';
const Autolinker = require('autolinker');

const EMOTICONS_CONFIG_PATH = 'config/emoticons.json';
const IGNORE_EMOTES_CONFIG_PATH = 'config/ignoreemotes.json';

function parseMessage(message) {
	if (message.substr(0, 5) === "/html") {
		message = message.substr(5);
		message = message.replace(/\_\_([^< ](?:[^<]*?[^< ])?)\_\_(?![^<]*?<\/a)/g, '<i>$1</i>'); // italics
		message = message.replace(/\*\*([^< ](?:[^<]*?[^< ])?)\*\*/g, '<b>$1</b>'); // bold
		message = message.replace(/\~\~([^< ](?:[^<]*?[^< ])?)\~\~/g, '<strike>$1</strike>'); // strikethrough
		message = message.replace(/&lt;&lt;([a-z0-9-]+)&gt;&gt;/g, '&laquo;<a href="/$1" target="_blank">$1</a>&raquo;'); // <<roomid>>
		message = Autolinker.link(message.replace(/&#x2f;/g, '/'), {stripPrefix: false, phone: false, twitter: false});
		return message;
	}
	message = Chat.escapeHTML(message).replace(/&#x2f;/g, '/');
	message = message.replace(/\_\_([^< ](?:[^<]*?[^< ])?)\_\_(?![^<]*?<\/a)/g, '<i>$1</i>'); // italics
	message = message.replace(/\*\*([^< ](?:[^<]*?[^< ])?)\*\*/g, '<b>$1</b>'); // bold
	message = message.replace(/\~\~([^< ](?:[^<]*?[^< ])?)\~\~/g, '<strike>$1</strike>'); // strikethrough
	message = message.replace(/&lt;&lt;([a-z0-9-]+)&gt;&gt;/g, '&laquo;<a href="/$1" target="_blank">$1</a>&raquo;'); // <<roomid>>
	message = Autolinker.link(message, {stripPrefix: false, phone: false, twitter: false});
	return message;
}
Impulse.parseMessage = parseMessage;

function escapeRegExp(str: string): string {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // eslint-disable-line no-useless-escape
}

let emoticons: {[key: string]: string} = {"lmao": "https://cdn3.emoji.gg/emojis/32868-pepe-lmfaoooo.gif"};
let emoteRegex: RegExp = new RegExp("lmao", "g");
Impulse.ignoreEmotes = {};
try {
	const ignoreEmotesData = FS(IGNORE_EMOTES_CONFIG_PATH).readIfExistsSync();
	if (ignoreEmotesData) {
		Impulse.ignoreEmotes = JSON.parse(ignoreEmotesData);
	}
} catch (e) {}

function loadEmoticons(): void {
	try {
		const emoticonsData = FS(EMOTICONS_CONFIG_PATH).readIfExistsSync();
		if (emoticonsData) {
			emoticons = JSON.parse(emoticonsData);
		}
		emoteRegex = [];
		for (let emote in emoticons) {
			emoteRegex.push(escapeRegExp(emote));
		}
		emoteRegex = new RegExp(`(${emoteRegex.join(`|`)})`, `g`);
	} catch (e) {}
}
loadEmoticons();

function saveEmoticons(): void {
	FS(EMOTICONS_CONFIG_PATH).writeSync(JSON.stringify(emoticons));
	emoteRegex = [];
	for (let emote in emoticons) {
		emoteRegex.push(emote);
	}
	emoteRegex = new RegExp(`(${emoteRegex.join(`|`)})`, `g`);
}

function parseEmoticons(message: string, room?: Room): string | false {
	if (emoteRegex.test(message)) {
		let size = 50;
		let lobby = Rooms.get(`lobby`);
		if (lobby && lobby.emoteSize) size = lobby.emoteSize;
		message = Impulse.parseMessage(message).replace(emoteRegex, function (match) {
			return `<img src="${emoticons[match]}" title="${match}" height="${((room && room.emoteSize) ? room.emoteSize : size)}" width="${((room && room.emoteSize) ? room.emoteSize : size)}">`;
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
		this.parse(`/emoticons ignore`);
	},

	unblockemote: "unignoreemotes",
	unblockemotes: "unignoreemotes",
	unblockemoticon: "unignoreemotes",
	unblockemoticons: "unignoreemotes",
	unignoreemotes() {
		this.parse(`/emoticons unignore`);
	},

	emoticons: "emoticon",
	emote: "emoticon",
	emotes: "emoticon",
	emoticon: {
		add(target: string, room: Room, user: User) {
			room = this.requireRoom();
			this.checkCan('emotes', null, room);
			if (!target) return this.parse("/emoticonshelp");

			let targetSplit = target.split(",");
			for (let u in targetSplit) targetSplit[u] = targetSplit[u].trim();

			if (!targetSplit[1]) return this.parse("/emoticonshelp");
			if (targetSplit[0].length > 10) return this.errorReply("Emoticons may not be longer than 10 characters.");
			if (emoticons[targetSplit[0]]) return this.errorReply(`${targetSplit[0]} is already an emoticon.`);

			emoticons[targetSplit[0]] = targetSplit[1];
			saveEmoticons();

			let size = 50;
			let lobby = Rooms.get(`lobby`);
			if (lobby && lobby.emoteSize) size = lobby.emoteSize;
			if (room.emoteSize) size = room.emoteSize;

			this.sendReply(`|raw|The emoticon ${Chat.escapeHTML(targetSplit[0])} has been added: <img src="${targetSplit[1]}" width="${size}" height="${size}">`);
		},

		delete: "del",
		remove: "del",
		rem: "del",
		del(target: string, room: Room, user: User) {
			room = this.requireRoom();
			this.checkCan('emotes', null, room);
			if (!target) return this.parse("/emoticonshelp");
			if (!emoticons[target]) return this.errorReply("That emoticon does not exist.");

			delete emoticons[target];
			saveEmoticons();

			this.sendReply("That emoticon has been removed.");
		},

		toggle(target: string, room: Room, user: User) {
			room = this.requireRoom();
			this.checkCan('emotes', null, room);
			if (!room.disableEmoticons) {
				room.disableEmoticons = true;
				Rooms.global.writeChatRoomData();
				this.modlog(`EMOTES`, null, `disabled emoticons`);
				this.privateModAction(`(${user.name} disabled emoticons in this room.)`);
			} else {
				room.disableEmoticons = false;
				Rooms.global.writeChatRoomData();
				this.modlog(`EMOTES`, null, `enabled emoticons`);
				this.privateModAction(`(${user.name} enabled emoticons in this room.)`);
			}
		},

		view: "list",
		list(target: string, room: Room, user: User) {
			if (!this.runBroadcast()) return;

			let size = 50;
			let lobby = Rooms.get("lobby");
			if (lobby && lobby.emoteSize) size = lobby.emoteSize;
			if (room.emoteSize) size = room.emoteSize;

			let reply = `<strong><u>Emoticons (${Object.keys(emoticons).length})</u></strong><br />`;
			for (let emote in emoticons) reply += `(${emote} <img src="${emoticons[emote]}" height="${size}" width="${size}">)`;
			this.sendReply(`|raw|<div class="infobox infobox-limited">${reply}</div>`);
		},

		ignore(target: string, room: Room, user: User) {
			if (Impulse.ignoreEmotes[user.id]) return this.errorReply(`You are already ignoring emoticons.`);
			Impulse.ignoreEmotes[user.id] = true;
			FS(IGNORE_EMOTES_CONFIG_PATH).writeSync(JSON.stringify(Impulse.ignoreEmotes));
			this.sendReply(`You are now ignoring emoticons.`);
		},

		unignore(target: string, room: Room, user: User) {
			if (!Impulse.ignoreEmotes[user.id]) return this.errorReply(`You aren't ignoring emoticons.`);
			delete Impulse.ignoreEmotes[user.id];
			FS(IGNORE_EMOTES_CONFIG_PATH).writeSync(JSON.stringify(Impulse.ignoreEmotes));
			this.sendReply(`You are no longer ignoring emoticons.`);
		},

		size(target: string, room: Room, user: User) {
			room = this.requireRoom();
			if (room.id === `lobby` && !this.can(`ban`) || room.id !== `lobby` && !this.checkCan(`ban`, null, room)) return false;
			if (!target) return this.sendReply(`Usage: /emoticons size [number]`);

			let size = Math.round(Number(target));
			if (isNaN(size)) return this.errorReply(`"${target}" is not a valid number.`);
			if (size < 1) return this.errorReply(`Size may not be less than 1.`);
			if (size > 200) return this.errorReply(`Size may not be more than 200.`);

			room.emoteSize = size;
			room.chatRoomData.emoteSize = size;
			Rooms.global.writeChatRoomData();
			this.privateModAction(`${user.name} has changed emoticon size in this room to ${size}.`);
		},

		"": "help",
		help: function () {
			this.parse(`/emoticonshelp`);
		},
	},

	randemote() {
		if (!this.canTalk()) return;
		let e = Object.keys(emoticons)[Math.floor(Math.random() * Object.keys(emoticons).length)];
		this.parse(e);
	},

	emoticonshelp(target, room, user) {
	if (!this.runBroadcast()) return;
	this.sendReplyBox(
		`<div><b><center>Emoticon Commands</center></b><br>` +
		`<ul>` +
		`<li><code>/emoticon</code> may be substituted with <code>/emoticons</code>, <code>/emotes</code>, or <code>/emote</code></li><br>` +
		`<li><code>/emoticon add [name], [url]</code> - Adds an emoticon. (Requires: @, &, #, ~)</li><br>` +
		`<li><code>/emoticon del/delete/remove/rem [name]</code> - Removes an emoticon. (Requires: @, &, #, ~)</li><br>` +
		`<li><code>/emoticon toggle</code> - Enables or disables emoticons in the current room depending on if they are already active. (Requires: @, &, #, ~)</li><br>` +
		`<li><code>/emoticon view/list</code> - Displays the list of emoticons.</li><br>` +
		`<li><code>/emoticon ignore</code> - Ignores emoticons in chat messages.</li><br>` +
		`<li><code>/emoticon unignore</code> - Unignores emoticons in chat messages.</li><br>` +
		`<li><code>/emoticon size [size]</code> - Changes the size of emoticons in the current room. (Requires: @, &, #, ~)</li><br>` +
		`<li><code>/randemote</code> - Randomly sends an emote from the emoticon list.</li><br>` +
		`<li><code>/emoticon help</code> - Displays this help command.</li>` +
		`</ul></div>`
	);
	},
};
