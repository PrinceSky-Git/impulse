/******************************************
* Pokemon Showdown Custom Avatar Commands *
* Original Code By: CreatePhil And Others *
* Updated To Typescript By: Prince Sky    *
*******************************************/

import { FS } from '../lib/fs';

const AVATAR_PATH = 'config/avatars/';
const STAFF_ROOM_ID = 'staff';
const VALID_EXTENSIONS = ['.jpg', '.png', '.gif'];

interface AvatarRequestData {
  [userid: string]: boolean;
}

async function downloadImage(imageUrl: string, name: string, extension: string): Promise<void> {
	try {
		const response = await fetch(imageUrl);
		if (!response.ok) return;

	  const contentType = response.headers.get('content-type');
	  if (!contentType?.startsWith('image/')) return;
	  
	  const buffer = await response.arrayBuffer();
	  await FS(AVATAR_PATH + name + extension).write(Buffer.from(buffer));
	} catch (err) {
	  console.error('Error downloading avatar:', err);
  }
}

function getExtension(filename: string): string {
	const ext = filename.slice(filename.lastIndexOf('.'));
	return ext || '';
}

async function initializeAvatars(): Promise<void> {
	try {
		const files = await FS(AVATAR_PATH).readdir();
		if (!files) return;
		files
			.filter(file => VALID_EXTENSIONS.includes(getExtension(file)))
			.forEach(file => {
				const ext = getExtension(file);
				const name = file.slice(0, -ext.length);
				Config.customavatars = Config.customavatars || {};
				Config.customavatars[name] = file;
			});
	} catch (err) {
		console.log('Error loading avatars:', err);
	}
}

class AvatarRequestSystem {
	static async hasUsedRequest(userid: string): Promise<boolean> {
		const data = await db.avatarRequests.get();
		return data && typeof data === 'object' ? (data as AvatarRequestData)[toID(userid)] || false : false;
	}

	static async markRequestUsed(userid: string): Promise<void> {
		await db.avatarRequests.insert(toID(userid), true);
	}
}

initializeAvatars();

// Export AvatarRequestSystem to be used by the EXP system
export { AvatarRequestSystem };

export const commands: Chat.ChatCommands = {
	customavatar: {
		async set(this: CommandContext, target: string, room: ChatRoom | null, user: User) {
			this.checkCan('bypassall');
			const [name, avatarUrl] = target.split(',').map(s => s.trim());
			if (!name || !avatarUrl) return this.parse('/help customavatar');
			
			const userId = toID(name);
			const processedUrl = /^https?:\/\//i.test(avatarUrl) ? avatarUrl : `http://${avatarUrl}`;
			const ext = getExtension(processedUrl);
			if (!VALID_EXTENSIONS.includes(ext)) {
				return this.errorReply('Image must have .jpg, .png, or .gif extension.');
			}
			Config.customavatars = Config.customavatars || {};
			Config.customavatars[userId] = userId + ext;
			await downloadImage(processedUrl, userId, ext);
			this.sendReply(`|raw|${name}'s avatar was successfully set. Avatar:<br /><img src='${processedUrl}' width='80' height='80'>`);
			
			const targetUser = Users.get(userId);
			if (targetUser) {
				targetUser.popup(`|html|${Impulse.nameColor(user.name, true, true)} set your custom avatar.<br /><center><img src='${processedUrl}' width='80' height='80'></center>`);
			}
			this.parse(`/personalavatar ${userId},${Config.customavatars[userId]}`);
			
			const staffRoom = Rooms.get(STAFF_ROOM_ID);
			if (staffRoom) {
				staffRoom.add(`|html|<div class="infobox">${Impulse.nameColor(user.name, true, true)} set custom avatar for ${Impulse.nameColor(name, true, false)}: <img src='${processedUrl}' width='80' height='80'></div>`).update();
			}
		},
		
		async delete(this: CommandContext, target: string) {
			this.checkCan('bypassall');
			const userId = toID(target);
			const image = Config.customavatars?.[userId];
			if (!image) {
				return this.errorReply(`${target} does not have a custom avatar.`);
			}
			if (Config.customavatars) delete Config.customavatars[userId];
			try {
				await FS(AVATAR_PATH + image).unlinkIfExists();
				
				const targetUser = Users.get(userId);
				if (targetUser) {
					targetUser.popup(`|html|${Impulse.nameColor(this.user.name, true, true)} has deleted your custom avatar.`);
				}
				this.sendReply(`${target}'s avatar has been removed.`);
				
				const staffRoom = Rooms.get(STAFF_ROOM_ID);
				if (staffRoom) {
					staffRoom.add(`|html|<div class="infobox">${Impulse.nameColor(this.user.name, true, true)} deleted custom avatar for ${Impulse.nameColor(target, true, false)}.</div>`).update(); 
				}
				this.parse(`/removeavatar ${userId}`);
			} catch (err) {
				console.error('Error deleting avatar:', err);
			}
		},

		async request(this: CommandContext, target: string) {
			if (!target) return this.errorReply('Usage: /customavatar request [image url]');
			
			const hasLevel = await Impulse.ExpSystem.hasLevel(this.user.id, 10);
			if (!hasLevel) {
				return this.errorReply('You must be at least level 10 to request a custom avatar.');
			}

			const hasUsedRequest = await AvatarRequestSystem.hasUsedRequest(this.user.id);
			if (hasUsedRequest) {
				return this.errorReply('You have already used your one-time avatar request.');
			}

			const avatarUrl = target.trim();
			const processedUrl = /^https?:\/\//i.test(avatarUrl) ? avatarUrl : `http://${avatarUrl}`;
			const ext = getExtension(processedUrl);
			if (!VALID_EXTENSIONS.includes(ext)) {
				return this.errorReply('Image must have .jpg, .png, or .gif extension.');
			}

			await AvatarRequestSystem.markRequestUsed(this.user.id);

			const staffRoom = Rooms.get(STAFF_ROOM_ID);
			if (staffRoom) {
				staffRoom.add(`|html|<div class="infobox"><strong>Avatar Request from ${Impulse.nameColor(this.user.name, true, true)}</strong><br>` +
					`Level 10+ user requesting custom avatar:<br>` +
					`<img src='${processedUrl}' width='80' height='80'><br>` +
					`Use: <code>/customavatar set ${this.user.name}, ${processedUrl}</code></div>`).update();
			}

			this.sendReply('Your avatar request has been submitted to staff for review. You cannot request another avatar.');
		},

		''(target, room, user) {
			this.parse('/customavatarhelp');
		},
	},
	
	customavatarhelp(target, room, user) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			`<div><b><center>Custom Avatar Commands</center></b><br>` +
			`<ul><li><code>/customavatar set [username], [image url]</code> - Sets a user's avatar (Requires: ~)</li><br>` +
			`<li><code>/customavatar delete [username]</code> - Removes a user's avatar (Requires: ~)</li><br>` +
			`<li><code>/customavatar request [image url]</code> - Request a custom avatar (Requires: Level 10+, one-time use only)</li><br>` +
			`<li><code>/customavatar viewrequests</code> - View all pending avatar requests (Requires: ~)</li><br>` +
			`<li><code>/customavatar deleterequest [username]</code> - Delete a specific avatar request (Requires: ~)</li>` +
			`</ul></div>`);
	},
};