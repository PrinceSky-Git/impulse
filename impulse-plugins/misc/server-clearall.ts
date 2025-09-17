/* clearall & globalclearall commands */

function clearRooms(rooms: Room[], user: User): string[] {
  const clearedRooms: string[] = [];
  for (const room of rooms) {
    if (!room) continue;
    if (room.log.log) {
      room.log.log.length = 0;
    }
    const userIds = Object.keys(room.users) as ID[];
    for (const userId of userIds) {
      const userObj = Users.get(userId);
      if (userObj?.connections?.length) {
        for (const connection of userObj.connections) {
          userObj.leaveRoom(room, connection);
        }
      }
    }
    clearedRooms.push(room.id);
    setTimeout(() => {
      for (const userId of userIds) {
        const userObj = Users.get(userId);
        if (userObj?.connections?.length) {
          for (const connection of userObj.connections) {
            userObj.joinRoom(room, connection);
          }
        }
      }
    }, 1000);
  }
  return clearedRooms;
}

export const commands: Chat.ChatCommands = {
  clearall(target: string, room: ChatRoom | null, user: User): void {
	  if (room?.battle) {
		  return this.sendReply("You cannot clearall in battle rooms.");
	  }
    if (!room) {
      return this.errorReply("This command requires a room.");
	 }
	  this.checkCan('roommod', null, room);
    clearRooms([room], user);
  },

  globalclearall(target: string, room: ChatRoom | null, user: User): void {
	  this.checkCan('globalban', null, room);

    const roomsToClear = Rooms.global.chatRooms.filter((chatRoom): chatRoom is Room => !!chatRoom && !chatRoom.battle);
    const clearedRooms = clearRooms(roomsToClear, user);
  },

	clearallhelp(target, room, user) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			`<div><b><center>Clearall Commands</center></b><br>` +
			`<ul>` +
			`<li><code>/clearall </code> - Clear all messages from a chatroom (Requires: # and higher)</li><br>` +
			`<li><code>/globalclearall </code> - clear all messages from all chatrooms (Requires: ~)</li>` +
			`</ul></div>`
		);
	},
};
