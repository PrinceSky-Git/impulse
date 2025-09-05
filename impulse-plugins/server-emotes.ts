/*
* Emoticon plugin for Pokemon Showdown
* Allows emoticons in chat rooms and private messages
*/

// Import Autolinker if not already available globally
// @ts-ignore
const Autolinker = require('autolinker');

interface EmoticonData {
	[emoteName: string]: string;
}

interface IgnoreEmotesData {
	[userId: string]: boolean;
}

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // eslint-disable-line no-useless-escape
}

export class EmoticonManager {
	private emoteRegex: RegExp;
	private emoticons: any;
	private ignoreEmotes: any;
	private emoticonCache: EmoticonData | null = null; // Add cache
	private cacheLoaded: boolean = false; // Track if cache is ready

	constructor() {
		this.emoticons = db.emoticons;
		this.ignoreEmotes = db.ignoreEmotes;
		this.emoteRegex = /(?:)/g; // Default empty regex
		this.loadEmoticons();
	}

	private async loadEmoticons(): Promise<void> {
		try {
			const data = await this.emoticons.get() as EmoticonData;
			if (!data || Object.keys(data).length === 0) {
				// Initialize with default emoticon
				await this.emoticons.insert("feelsbd", "http://i.imgur.com/TZvJ1lI.png");
				this.emoticonCache = { "feelsbd": "http://i.imgur.com/TZvJ1lI.png" };
			} else {
				this.emoticonCache = data;
			}
			this.cacheLoaded = true;
			await this.updateRegex();
		} catch (e) {
			// Initialize with default if loading fails
			await this.emoticons.clear(true);
			await this.emoticons.insert("feelsbd", "http://i.imgur.com/TZvJ1lI.png");
			this.emoticonCache = { "feelsbd": "http://i.imgur.com/TZvJ1lI.png" };
			this.cacheLoaded = true;
			await this.updateRegex();
		}
	}

	private async updateRegex(): Promise<void> {
		const data = this.emoticonCache || {};
		if (Object.keys(data).length === 0) {
			this.emoteRegex = /(?:)/g;
			return;
		}

		const emoteNames = Object.keys(data).map(emote => escapeRegExp(emote));
		this.emoteRegex = new RegExp(`(${emoteNames.join('|')})`, 'g');
	}

	async addEmoticon(name: string, url: string): Promise<boolean> {
		if (name.length > 10) return false;
		if (await this.emoticons.has(name)) return false;

		await this.emoticons.insert(name, url);
		
		// Update cache
		if (this.emoticonCache) {
			this.emoticonCache[name] = url;
		}
		
		await this.updateRegex();
		return true;
	}

	async removeEmoticon(name: string): Promise<boolean> {
		if (!(await this.emoticons.has(name))) return false;

		await this.emoticons.remove(name);
		
		// Update cache
		if (this.emoticonCache && this.emoticonCache[name]) {
			delete this.emoticonCache[name];
		}
		
		await this.updateRegex();
		return true;
	}

	async getEmoticons(): Promise<EmoticonData> {
		// Return cached data if available, otherwise fetch from DB
		if (this.cacheLoaded && this.emoticonCache) {
			return this.emoticonCache;
		}
		
		// Fallback to DB if cache not ready
		return (await this.emoticons.get()) as EmoticonData || {};
	}

	async parseEmoticons(message: string, room?: Room): Promise<string | false> {
		// Quick check before regex test
		if (!this.cacheLoaded || !this.emoticonCache || Object.keys(this.emoticonCache).length === 0) {
			return false;
		}
		
		if (!this.emoteRegex.test(message)) return false;

		const emoticons = this.emoticonCache; // Use cached data
		let size = 50;
		const lobby = Rooms.get('lobby');
		if (lobby?.emoteSize) size = lobby.emoteSize;
		if (room?.emoteSize) size = room.emoteSize;

		// Reset regex lastIndex to avoid issues with global flag
		this.emoteRegex.lastIndex = 0;
		
		// Parse message first using parseMessage, then replace emoticons
		const parsedMessage = parseMessage(message);
		return parsedMessage.replace(this.emoteRegex, (match) => {
			return `<img src="${emoticons[match]}" title="${match}" height="${size}" width="${size}">`;
		});
	}

	async setIgnoreEmotes(userId: string, ignore: boolean): Promise<void> {
		if (ignore) {
			await this.ignoreEmotes.insert(userId, true);
		} else {
			await this.ignoreEmotes.remove(userId);
		}
	}

	async isIgnoringEmotes(userId: string): Promise<boolean> {
		return await this.ignoreEmotes.has(userId);
	}
}

const emoticonManager = new EmoticonManager();

// Add parseMessage function
const parseMessage = function(message: string): string {
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
};

Impulse.parseEmoticons = async (message: string, room?: Room) => {
	return await emoticonManager.parseEmoticons(message, room);
};

export const commands: Chat.ChatCommands = {
	blockemote: 'ignoreemotes',
	blockemotes: 'ignoreemotes',
	blockemoticon: 'ignoreemotes',
	blockemoticons: 'ignoreemotes',
	ignoreemotes() {
		this.parse('/emoticons ignore');
	},

	unblockemote: 'unignoreemotes',
	unblockemotes: 'unignoreemotes',
	unblockemoticon: 'unignoreemotes',
	unblockemoticons: 'unignoreemotes',
	unignoreemotes() {
		this.parse('/emoticons unignore');
	},

	emoticons: 'emoticon',
	emote: 'emoticon',
	emotes: 'emoticon',
	emoticon: {
		async add(target, room, user) {
			room = this.requireRoom();
			this.checkCan('ban', null, room);
			if (!target) return this.parse('/emoticonshelp');

			const targetSplit = target.split(',').map(s => s.trim());
			if (!targetSplit[1]) return this.parse('/emoticonshelp');

			const success = await emoticonManager.addEmoticon(targetSplit[0], targetSplit[1]);
			if (!success) {
				if (targetSplit[0].length > 10) {
					return this.errorReply('Emoticons may not be longer than 10 characters.');
				}
				return this.errorReply(`${targetSplit[0]} is already an emoticon.`);
			}

			let size = 50;
			const lobby = Rooms.get('lobby');
			if (lobby?.emoteSize) size = lobby.emoteSize;
			if (room.emoteSize) size = room.emoteSize;

			this.sendReply(`|raw|The emoticon ${Chat.escapeHTML(targetSplit[0])} has been added: <img src="${targetSplit[1]}" width="${size}" height="${size}">`);
			
			//const upperstaff = Rooms.get('upperstaff');
			//if (upperstaff) {
			//	upperstaff.add(`|raw|${Server.nameColor(user.name, true)} has added the emoticon ${Chat.escapeHTML(targetSplit[0])}: <img src="${targetSplit[1]}" width="${size}" height="${size}">`);
	   //	}
			
			//Server.messageSeniorStaff(`/html ${Server.nameColor(user.name, true)} has added the emoticon ${Chat.escapeHTML(targetSplit[0])}: <img src="${targetSplit[1]}" width="${size}" height="${size}">`);
		},

		delete: 'del',
		remove: 'del',
		rem: 'del',
		async del(target, room, user) {
			room = this.requireRoom();
			this.checkCan('ban', null, room);
			if (!target) return this.parse('/emoticonshelp');

			const success = await emoticonManager.removeEmoticon(target);
			if (!success) return this.errorReply('That emoticon does not exist.');

			this.sendReply('That emoticon has been removed.');
			
			//const upperstaff = Rooms.get('upperstaff');
			//if (upperstaff) {
			//	upperstaff.add(`|raw|${Server.nameColor(user.name, true)} has removed the emoticon ${Chat.escapeHTML(target)}.`);
		  //}
			
			//Server.messageSeniorStaff(`/html ${Server.nameColor(user.name, true)} has removed the emoticon ${Chat.escapeHTML(target)}.`);
		},

		toggle(target, room, user) {
			room = this.requireRoom();
			this.checkCan('ban', null, room);
			
			if (!room.settings.disableEmoticons) {
				room.settings.disableEmoticons = true;
				this.modlog('EMOTES', null, 'disabled emoticons');
				this.privateModAction(`(${user.name} disabled emoticons in this room.)`);
			} else {
				room.settings.disableEmoticons = false;
				this.modlog('EMOTES', null, 'enabled emoticons');
				this.privateModAction(`(${user.name} enabled emoticons in this room.)`);
			}
			
			room.saveSettings();
		},

		view: 'list',
		async list(target, room, user) {
			if (!this.runBroadcast()) return;

			const emoticons = await emoticonManager.getEmoticons();
			let size = 50;
			const lobby = Rooms.get('lobby');
			if (lobby?.emoteSize) size = lobby.emoteSize;
			if (room?.emoteSize) size = room.emoteSize;

			let reply = `<strong><u>Emoticons (${Object.keys(emoticons).length})</u></strong><br />`;
			for (const emote in emoticons) {
				reply += `(${emote} <img src="${emoticons[emote]}" height="${size}" width="${size}">)`;
			}
			this.sendReply(`|raw|<div class="infobox infobox-limited">${reply}</div>`);
		},

		async ignore(target, room, user) {
			if (await emoticonManager.isIgnoringEmotes(user.id)) {
				return this.errorReply('You are already ignoring emoticons.');
			}
			
			await emoticonManager.setIgnoreEmotes(user.id, true);
			this.sendReply('You are now ignoring emoticons.');
		},

		async unignore(target, room, user) {
			if (!(await emoticonManager.isIgnoringEmotes(user.id))) {
				return this.errorReply("You aren't ignoring emoticons.");
			}
			
			await emoticonManager.setIgnoreEmotes(user.id, false);
			this.sendReply('You are no longer ignoring emoticons.');
		},

		size(target, room, user) {
			room = this.requireRoom();
			
			const canModifySize = room.roomid === 'lobby' ? 
				this.can('emotes') : 
				this.checkCan('emotes', null, room);
			if (!canModifySize) return false;
			
			if (!target) return this.sendReply('Usage: /emoticons size [number]');

			const size = Math.round(Number(target));
			if (isNaN(size)) return this.errorReply(`"${target}" is not a valid number.`);
			if (size < 1) return this.errorReply('Size may not be less than 1.');
			if (size > 200) return this.errorReply('Size may not be more than 200.');

			room.emoteSize = size;
			if (room.settings) {
				room.settings.emoteSize = size;
				room.saveSettings();
			}
			
			this.privateModAction(`${user.name} has changed emoticon size in this room to ${size}.`);
		},

		'': 'help',
		help() {
			this.parse('/emoticonshelp');
		},
	},

	async randemote() {
		if (!this.canTalk()) return;
		
		const emoticons = await emoticonManager.getEmoticons();
		const emoteNames = Object.keys(emoticons);
		if (emoteNames.length === 0) return;
		
		const randomEmote = emoteNames[Math.floor(Math.random() * emoteNames.length)];
		this.parse(randomEmote);
	},

	emoticonshelp: [
		'Emoticon Commands:',
		'/emoticon may be substituted with /emoticons, /emotes, or /emote',
		'/emoticon add [name], [url] - Adds an emoticon. Requires @, &, #, ~',
		'/emoticon del/delete/remove/rem [name] - Removes an emoticon. Requires @, &, #, ~',
		'/emoticon toggle - Enables or disables emoticons in the current room. Requires @, &, #, ~',
		'/emoticon view/list - Displays the list of emoticons.',
		'/emoticon ignore - Ignores emoticons in chat messages.',
		'/emoticon unignore - Unignores emoticons in chat messages.',
		'/emoticon size [size] - Changes the size of emoticons in the current room. Requires @, &, #, ~',
		'/randemote - Randomly sends an emote from the emoticon list.',
		'/emoticon help - Displays this help command.',
	],
};
