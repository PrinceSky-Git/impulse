/******************************************
* Pokemon Showdown Custom Avatar Commands *
* Original Code By: CreatePhil And Others *
* Updated To Typescript By: Prince Sky    *
*******************************************/

import { FS } from '../../lib';

const AVATAR_PATH = 'config/avatars/';
const STAFF_ROOM_ID = 'staff';
const VALID_EXTENSIONS = ['.jpg', '.png', '.gif'];

interface AvatarRequestData {
  [userid: string]: boolean;
}

interface PendingRequestData {
  [userid: string]: string;
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

	static async addPendingRequest(userid: string, url: string): Promise<void> {
		await db.pendingAvatarRequests.insert(toID(userid), url);
	}

	static async removePendingRequest(userid: string): Promise<void> {
		await db.pendingAvatarRequests.remove(toID(userid));
	}

	static async getPendingRequests(): Promise<[string, string][]> {
		const data = await db.pendingAvatarRequests.get() as PendingRequestData;
		if (!data || typeof data !== 'object') return [];
		return Object.entries(data);
	}

	static async notifyAvatarUnlock(userid: string): Promise<void> {
		const user = Users.get(userid);
		if (!user || !user.connected) return;
		
		const hasUsedRequest = await this.hasUsedRequest(userid);
		if (hasUsedRequest) return; // Don't notify if they already used their request
		
		user.send(
			`|pm|~Avatar System|${user.getIdentity()}|/raw ` +
			`<div style="border: 2px solid #3498db; padding: 15px; border-radius: 10px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);">` +
			`<div style="text-align: center;">` +
			`<h3 style="color: #1976d2; margin-top: 0;">ðŸŽ‰ Avatar Request Unlocked! ðŸŽ‰</h3>` +
			`<div style="font-size: 1.1em; margin: 10px 0;">` +
			`Congratulations on reaching <b style="color: #e74c3c;">Level 10</b>!` +
			`</div>` +
			`<div style="margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 5px;">` +
			`You can now request a <b>custom avatar</b> using:<br>` +
			`<code style="background: #333; color: #fff; padding: 2px 4px; border-radius: 3px;">/customavatar request [image url]</code>` +
			`</div>` +
			`<div style="font-size: 0.9em; color: #666; font-style: italic;">` +
			`âš ï¸ This is a <b>one-time only</b> request. Make sure your image is exactly what you want!<br>` +
			`Accepted formats: .jpg, .png, .gif` +
			`</div>` +
			`</div>` +
			`</div>`
		);
	}
}

initializeAvatars();

Impulse.AvatarRequestSystem = AvatarRequestSystem;

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
			
			// Remove from pending requests if it exists
			await AvatarRequestSystem.removePendingRequest(userId);
			
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
			await AvatarRequestSystem.addPendingRequest(this.user.id, processedUrl);

			const staffRoom = Rooms.get(STAFF_ROOM_ID);
			if (staffRoom) {
				staffRoom.add(`|html|<div class="infobox"><strong>Avatar Request from ${Impulse.nameColor(this.user.name, true, true)}</strong><br>` +
					`Level 10+ user requesting custom avatar:<br>` +
					`<img src='${processedUrl}' width='80' height='80'><br>` +
					`Use: <code>/customavatar set ${this.user.name}, ${processedUrl}</code></div>`).update();
			}

			this.sendReply('Your avatar request has been submitted to staff for review. You cannot request another avatar.');
		},

		async viewrequests(this: CommandContext) {
			this.checkCan('bypassall');
			const pendingRequests = await AvatarRequestSystem.getPendingRequests();
			
			if (!pendingRequests.length) {
				return this.sendReplyBox('<center><b>No pending avatar requests.</b></center>');
			}

			const tableData = pendingRequests.map(([userid, url]) => [
				Impulse.nameColor(userid, true, true),
				`<img src='${url}' width='50' height='50'>`,
				`<button name="send" value="/customavatar set ${userid}, ${url}">Set Avatar</button>`
			]);

			const table = Impulse.generateThemedTable(
				'Pending Avatar Requests<br>',
				['User', 'Avatar', 'Action'],
				tableData
			);

			this.sendReplyBox(`<center><div class="pad ladder">${table}</div></center>`);
		},

		async deleterequest(this: CommandContext, target: string) {
			this.checkCan('bypassall');
			if (!target) return this.errorReply('Usage: /customavatar deleterequest [username]');
			
			const userid = toID(target);
			await AvatarRequestSystem.removePendingRequest(userid);
			
			this.sendReply(`Deleted avatar request for ${target}.`);
			
			const staffRoom = Rooms.get(STAFF_ROOM_ID);
			if (staffRoom) {
				staffRoom.add(`|html|<div class="infobox">${Impulse.nameColor(this.user.name, true, true)} deleted avatar request for ${Impulse.nameColor(target, true, false)}.</div>`).update();
			}
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
