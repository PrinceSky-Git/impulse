/* Room Founder Command */

export const commands: ChatCommands = {
  rf: "roomfounder",
  roomfounder(target, room, user) {
    if (!room.persist) {
      return this.errorReply("/roomfounder - This room isn't designed for per-room moderation to be added");
    }
    if (!target) return this.parse("/help roomfounder");
    target = this.splitTarget(target, true);
    let targetUser = this.targetUser;
    let name = this.targetUsername;
    let userid = toID(name);
    if (!Users.isUsernameKnown(userid)) {
      return this.errorReply(`User "${this.targetUsername}" is offline and unrecognized, and so can't be promoted.`);
    }
    room = this.requireRoom();
    this.checkCan('makeroom', null, room);
    if (!room.settings.auth) room.settings.auth = room.settings.auth = {};
    room.settings.auth[userid] = "#";
    room.settings.founder = userid;
		room.founder = userid;
		this.addModAction(`${name} was appointed Room Founder by ${user.name}.`);
		if (targetUser) {
			targetUser.popup(`|html|You were appointed Room Founder by ${Server.nameColor(user.name, true)} in ${room.title}.`);
			room.onUpdateIdentity(targetUser);
		}
		room.saveSettings();
	},
	roomfounderhelp: ["/roomfounder [username] - Appoints [username] as a room founder. Requires: & ~"],
};
