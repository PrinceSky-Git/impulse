/***************************************
 * Pokemon Showdown Music Playlist Commands
 * @author ClarkJ338
 * @license MIT
 ***************************************/

import { Utils } from '../lib';

interface PlaylistEntry {
	url: string;
	title: string;
	type: 'youtube' | 'youtube-music' | 'spotify' | 'apple-music' | 'soundcloud';
}

interface PlaylistData {
	[userid: string]: PlaylistEntry[];
}

interface RateLimitData {
	[userid: string]: {
		requests: number;
		resetTime: number;
	};
}

export class MusicPlaylist {
	private static playlists: PlaylistData = {};
	private static rateLimits: RateLimitData = {};
	private static readonly MAX_PLAYLIST_SIZE = 20;
	private static readonly RATE_LIMIT_REQUESTS = 10;
	private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute

	private static loadPlaylists(): void {
		try {
			const data = db.playlistData.getSync() as PlaylistData;
			if (data && typeof data === 'object') {
				this.playlists = data;
			}
		} catch (error) {
			console.error(`Error reading playlist data: ${error}`);
		}
	}

	private static savePlaylists(): void {
		try {
			// Save the entire playlists object, replacing existing data
			db.playlistData.insertSync(this.playlists);
		} catch (error) {
			console.error(`Error saving playlist data: ${error}`);
		}
	}

	static addSong(userid: string, url: string, title: string, type: PlaylistEntry['type']): {success: boolean, error?: string} {
		const id = toID(userid);
		if (!this.playlists[id]) {
			this.playlists[id] = [];
		}

		// Check playlist size limit
		if (this.playlists[id].length >= this.MAX_PLAYLIST_SIZE) {
			return {success: false, error: `Playlist limit reached (${this.MAX_PLAYLIST_SIZE} songs maximum)`};
		}

		// Check for duplicate URL
		const isDuplicate = this.playlists[id].some(entry => entry.url === url);
		if (isDuplicate) {
			return {success: false, error: "This URL is already in your playlist"};
		}

		this.playlists[id].push({ url, title, type });
		this.savePlaylists();
		return {success: true};
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

	static checkRateLimit(userid: string): boolean {
		const id = toID(userid);
		const now = Date.now();

		if (!this.rateLimits[id]) {
			this.rateLimits[id] = {requests: 0, resetTime: now + this.RATE_LIMIT_WINDOW};
		}

		// Reset if window has passed
		if (now > this.rateLimits[id].resetTime) {
			this.rateLimits[id] = {requests: 0, resetTime: now + this.RATE_LIMIT_WINDOW};
		}

		// Check if over limit
		if (this.rateLimits[id].requests >= this.RATE_LIMIT_REQUESTS) {
			return false;
		}

		this.rateLimits[id].requests++;
		return true;
	}

	static clearPlaylist(userid: string): void {
		const id = toID(userid);
		if (this.playlists[id]) {
			delete this.playlists[id]; // Remove from memory
			try {
				db.playlistData.removeSync(id); // Remove from database
			} catch (error) {
				console.error(`Error clearing playlist for user ${id}: ${error}`);
			}
		}
	}
}

function detectPlatform(url: string): {type: PlaylistEntry['type'], id: string} | null {
	// YouTube
	const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
	if (youtubeMatch) {
		return {type: 'youtube', id: youtubeMatch[1]};
	}

	// YouTube Music
	const ytMusicMatch = url.match(/music\.youtube\.com\/watch\?v=([^"&?\/\s]{11})/);
	if (ytMusicMatch) {
		return {type: 'youtube-music', id: ytMusicMatch[1]};
	}

	// Spotify
	const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
	if (spotifyMatch) {
		return {type: 'spotify', id: spotifyMatch[2]};
	}

	// Apple Music
	const appleMusicMatch = url.match(/music\.apple\.com\/[a-z]{2}\/(album|song|playlist)\/[^\/]+\/(\d+)/);
	if (appleMusicMatch) {
		return {type: 'apple-music', id: appleMusicMatch[2]};
	}

	// SoundCloud
	const soundcloudMatch = url.match(/soundcloud\.com\/[^\/]+\/[^\/]+/);
	if (soundcloudMatch) {
		return {type: 'soundcloud', id: url.split('/').pop() || ''};
	}

	return null;
}

function getYouTubeTitle(videoId: string): Promise<string> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => resolve('Unknown Title'), 5000);
		
		const options = {
			hostname: 'noembed.com',
			path: `/embed?url=https://www.youtube.com/watch?v=${videoId}`,
			headers: {'User-Agent': 'PSMusicPlaylist/1.0'},
			timeout: 5000,
		};
		
		require('https').get(options, (res: any) => {
			let data = '';
			res.on('data', (chunk: string) => {
				data += chunk;
			});
			res.on('end', () => {
				clearTimeout(timeout);
				try {
					const json = JSON.parse(data);
					resolve(json.title || 'Unknown Title');
				} catch (e) {
					resolve('Unknown Title');
				}
			});
		}).on('error', () => {
			clearTimeout(timeout);
			resolve('Unknown Title');
		});
	});
}

MusicPlaylist.loadPlaylists();

export const commands: ChatCommands = {
	playlist: {
		async add(target, room, user) {
			if (!target) {
				return this.errorReply("Usage: /playlist add <URL> or /playlist add <URL>, <title> for non-YouTube platforms");
			}
			
			// Rate limiting
			if (!MusicPlaylist.checkRateLimit(user.id)) {
				return this.errorReply("Rate limit exceeded. Please wait before adding more songs.");
			}

			const parts = target.split(',').map(part => part.trim());
			const urlStr = parts[0];
			const providedTitle = parts[1];

			let url: URL;
			try {
				url = new URL(urlStr);
			} catch {
				return this.errorReply("Invalid URL format.");
			}

			const platform = detectPlatform(urlStr);
			if (!platform) {
				return this.errorReply("Unsupported platform. Only YouTube, YouTube Music, Spotify, Apple Music, and SoundCloud URLs are allowed.");
			}

			let title: string;
			if (platform.type === 'youtube' || platform.type === 'youtube-music') {
				title = await getYouTubeTitle(platform.id);
			} else {
				if (!providedTitle) {
					return this.errorReply("For Spotify, Apple Music, and SoundCloud, please provide a title: /playlist add <URL>, <title>");
				}
				title = providedTitle;
			}

			const result = MusicPlaylist.addSong(user.id, urlStr, title, platform.type);
			if (!result.success) {
				return this.errorReply(result.error!);
			}

			this.sendReply(`Added "${title}" to your personal playlist.`);
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
				html += `${idx + 1}. <a href="${Utils.escapeHTML(entry.url)}" target="_blank">${Utils.escapeHTML(entry.title)}</a><br />`;
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
			let html = `<b>${Utils.escapeHTML(targetUser.name)}'s Playlist:</b><br />`;
			playlist.forEach((entry, idx) => {
				html += `${idx + 1}. <a href="${Utils.escapeHTML(entry.url)}" target="_blank">${Utils.escapeHTML(entry.title)}</a><br />`;
			});
			this.sendReplyBox(html);
		},
		
		help(target, room, user) {
			if (!this.runBroadcast()) return;
			this.sendReplyBox(
				`<div><b><center>Music Playlist Commands</center></b><br>` +
				`<ul>` +
				`<li><code>/playlist add URL</code> - Add a YouTube or YouTube Music URL to your playlist (title auto-fetched).</li><br>` +
				`<li><code>/playlist add URL, Title</code> - Add a Spotify, Apple Music, or SoundCloud URL with a custom title.</li><br>` +
				`<li><code>/playlist remove Index</code> - Remove a song from your playlist by its position number.</li><br>` +
				`<li><code>/playlist share</code> - Display your personal playlist to the room.</li><br>` +
				`<li><code>/playlist view username</code> - View another user's playlist.</li><br>` +
				`<li><code>/playlist clear</code> - Remove all songs from your playlist.</li><br>` +
				`</ul>` +
				`<b>Supported Platforms:</b> YouTube, YouTube Music, Spotify, Apple Music, SoundCloud<br>` +
				`<b>Limit:</b> 20 songs per user</div>`
			);
		},
	},

	playlisthelp(target, room, user) {
		if (!this.runBroadcast()) return;
		this.parse(`/playlist help`);
	},
};
