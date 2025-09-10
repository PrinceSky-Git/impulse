/***************************************
 * Pokemon Showdown Music Playlist Commands
 * @author ClarkJ338
 * @license MIT
 ***************************************/

import {FS} from '../lib';
import { Utils } from '../lib';

interface PlaylistEntry {
	url: string;
	title: string;
	type: 'youtube' | 'generic';
}

interface PlaylistData {
	[userid: string]: PlaylistEntry[];
}

export class MusicPlaylist {
	private static playlists: PlaylistData = {};
	private static dataFile = 'impulse-db/playlist-data.json';

	private static loadPlaylists(): void {
		try {
			const data = JSON.parse(FS(this.dataFile).readIfExistsSync() || '{}') as PlaylistData;
			if (data && typeof data === 'object') {
				this.playlists = data;
			}
		} catch (error) {
			console.error(`Error reading playlist data: ${error}`);
		}
	}

	private static savePlaylists(): void {
		try {
			FS(this.dataFile).writeSync(JSON.stringify(this.playlists));
		} catch (error) {
			console.error(`Error saving playlist data: ${error}`);
		}
	}

	static addSong(userid: string, url: string, title: string, type: 'youtube' | 'generic' = 'generic'): void {
		const id = toID(userid);
		if (!this.playlists[id]) {
			this.playlists[id] = [];
		}
		this.playlists[id].push({ url, title, type });
		this.savePlaylists();
	}

	static removeSong(userid: string, index: number): boolean {
		const id = toID(userid);
		if (!this.playlists[id] || index < 1 || index > this.playlists[id].length) {
			return false;
		}
		this.playlists[id].splice(index - 1, 1);
		this.savePlaylists();
		return true;
	}

	static getPlaylist(userid: string): PlaylistEntry[] {
		const id = toID(userid);
		return this.playlists[id] || [];
	}

	static clearPlaylist(userid: string): void {
		const id = toID(userid);
		if (this.playlists[id]) {
			this.playlists[id] = [];
			this.savePlaylists();
		}
	}
}

function extractYouTubeID(url: string): string | null {
	const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function getYouTubeTitle(videoId: string): Promise<string> {
	return new Promise((resolve) => {
		const options = {
			hostname: 'noembed.com',
			path: `/embed?url=https://www.youtube.com/watch?v=${videoId}`,
			headers: {'User-Agent': 'PSMusicPlaylist/1.0'},
		};
		require('https').get(options, (res: any) => {
			let data = '';
			res.on('data', (chunk: string) => {
				data += chunk;
			});
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve(json.title || 'Unknown Title');
				} catch (e) {
					resolve('Unknown Title');
				}
			});
		}).on('error', () => resolve('Unknown Title'));
	});
}

function checkSongExists(name: string): Promise<boolean> {
	return new Promise((resolve) => {
		const escapedName = name.replace(/"/g, '\\"');
		const query = encodeURIComponent(`recording:"${escapedName}"`);
		const options = {
			hostname: 'musicbrainz.org',
			path: `/ws/2/recording/?query=${query}&fmt=json`,
			headers: {'User-Agent': 'PSMusicPlaylist/1.0 (https://play.pokemonshowdown.com)'},
		};
		require('https').get(options, (res: any) => {
			let data = '';
			res.on('data', (chunk: string) => {
				data += chunk;
			});
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve(json.count > 0);
				} catch (e) {
					resolve(false);
				}
			});
		}).on('error', () => resolve(false));
	});
}

function checkUrlExists(urlStr: string): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const url = new URL(urlStr);
			const client = url.protocol === 'https:' ? require('https') : require('http');
			const options = {
				hostname: url.hostname,
				path: url.pathname + url.search,
				method: 'HEAD',
				headers: {'User-Agent': 'PSMusicPlaylist/1.0 (https://play.pokemonshowdown.com)'},
			};
			const req = client.request(options, (res: any) => {
				resolve(res.statusCode >= 200 && res.statusCode < 400);
			});
			req.on('error', () => resolve(false));
			req.end();
		} catch (e) {
			resolve(false);
		}
	});
}

MusicPlaylist.loadPlaylists();

export const commands: ChatCommands = {
	playlist: {
		async add(target, room, user) {
			if (!target) return this.errorReply("Usage: /playlist add <song name or URL>");
			
			const youtubeId = extractYouTubeID(target);
			if (youtubeId) {
				const exists = await checkUrlExists(target);
				if (!exists) return this.errorReply("The YouTube URL does not exist or is not accessible.");
				
				const title = await getYouTubeTitle(youtubeId);
				MusicPlaylist.addSong(user.id, target, title, 'youtube');
				this.sendReply(`Added "${title}" to your personal playlist.`);
			} else {
				let isUrl = false;
				try {
					new URL(target);
					isUrl = true;
				} catch {}
				
				if (isUrl) {
					const exists = await checkUrlExists(target);
					if (!exists) return this.errorReply("The URL does not exist or is not accessible.");
					MusicPlaylist.addSong(user.id, target, target, 'generic');
					this.sendReply(`Added "${target}" to your personal playlist.`);
				} else {
					const exists = await checkSongExists(target);
					if (!exists) return this.errorReply("The song does not exist.");
					MusicPlaylist.addSong(user.id, target, target, 'generic');
					this.sendReply(`Added "${target}" to your personal playlist.`);
				}
			}
		},

		remove(target, room, user) {
			if (!target || isNaN(parseInt(target))) return this.errorReply("Usage: /playlist remove <index>");
			const index = parseInt(target);
			const success = MusicPlaylist.removeSong(user.id, index);
			if (success) {
				this.sendReply(`Removed song at index ${index} from your personal playlist.`);
			} else {
				this.errorReply(`Invalid index or no playlist.`);
			}
		},

		share(target, room, user) {
      if (!this.runBroadcast()) return;
			const playlist = MusicPlaylist.getPlaylist(user.id);
			if (playlist.length === 0) {
				return this.sendReply(`Your personal playlist is empty.`);
			}
			let html = `<b>Your personal playlist:</b><br />`;
			playlist.forEach((entry, idx) => {
				if (entry.type === 'youtube') {
					html += `${idx + 1}. <a href="${Utils.escapeHTML(entry.url)}" target="_blank">${Utils.escapeHTML(entry.title)}</a><br />`;
				} else {
					html += `${idx + 1}. ${Utils.escapeHTML(entry.title)}<br />`;
				}
			});
			this.sendReplyBox(html);
		},

		clear(target, room, user) {
			MusicPlaylist.clearPlaylist(user.id);
			this.sendReply(`Cleared your personal playlist.`);
		},

		view(target, room, user) {
      if (!this.runBroadcast()) return;
			if (!target) return this.errorReply("Usage: /playlist view <username>");
			const targetUser = Users.get(target);
			if (!targetUser) return this.errorReply("User not found.");
			const targetId = toID(targetUser.id);
			const playlist = MusicPlaylist.getPlaylist(targetId);
			if (playlist.length === 0) {
				return this.sendReply(`${targetUser.name}'s playlist is empty.`);
			}
			let html = `<b>${Utils.escapeHTML(targetUser.name)}'s playlist:</b><br />`;
			playlist.forEach((entry, idx) => {
				if (entry.type === 'youtube') {
					html += `${idx + 1}. <a href="${Utils.escapeHTML(entry.url)}" target="_blank">${Utils.escapeHTML(entry.title)}</a><br />`;
				} else {
					html += `${idx + 1}. ${Utils.escapeHTML(entry.title)}<br />`;
				}
			});
			this.sendReplyBox(html);
		},

		help() {
			return this.sendReply("Usage: /playlist [add/remove/share/clear/view]");
		},
	},
};
