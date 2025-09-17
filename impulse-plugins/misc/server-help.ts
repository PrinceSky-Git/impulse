/* Impulse Server Help Command */

export const commands: ChatCommands = {
	impulsehelp(target, room, user) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			`<div><b><center>Impulse Commands Help</center></b><br>` +
			`<ul><li><code>/clearallhelp</code> - Shows help for clear all commands</li><br>` +
			`<li><code>/customavatarhelp</code> - Shows help for custom avatar commands</li><br>` +
			`<li><code>/customcolorhelp</code> - Shows help for custom color commands</li><br>` +
			`<li><code>/exp help</code> - Shows help for experience/leveling commands</li><br>` +
			`<li><code>/emoticonshelp</code> - Shows help for emoticons commands</li><br>` +
			`<li><code>/fmhelp</code> - Shows help for file management commands</li><br>` +
			`<li><code>/help seen</code> - Shows help for seen commands</li><br>` +
			`<li><code>/iconhelp</code> - Shows help for icon commands</li><br>` +
			`<li><code>/impulsehelp</code> - Shows this help menu</li><br>` +
			`<li><code>/playlist help</code> - Shows help for playlist commands</li><br>` +
			`<li><code>/servernewshelp</code> - Shows help for server news commands</li>` +
			`</ul></div>`);
	},
};
