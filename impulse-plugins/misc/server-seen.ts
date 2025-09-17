/*
* Add this code in server/users.ts
* In onDisconnect Function
* if (this.named) {
* db.seen.insert(this.id, Date.now()).catch(err => {
* console.error('Error saving seen data:', err);
* });
* }
*/

export const commands: ChatCommands = {
	async seen(target: string | null, room: Room | User, user: User) {
		if (!this.runBroadcast()) return;
		if (!target) return this.parse('/help seen');
		const targetUser = Users.get(target);
		if (targetUser?.connected) {
			return this.sendReplyBox(`${Impulse.nameColor(targetUser.name, true, true)} is <b><font color='limegreen'>Currently Online</b></font>.`);
		}
		
		const targetId = toID(target);
		const hasSeenData = await db.seen.has(targetId);
		if (!hasSeenData) {
			return this.sendReplyBox(`${Impulse.nameColor(target, true, true)} has <b><font color='red'>never been online</font></b> on this server.`);
		}

		const seen = await db.seen.getIn(targetId);
		this.sendReplyBox(`${Impulse.nameColor(target, true, true)} was last seen <b>${Chat.toDurationString(Date.now() - seen, { precision: true })}</b> ago.`);
	},
	
	seenhelp: [`/seen [user] - Shows when the user last connected on the server.`],
};
