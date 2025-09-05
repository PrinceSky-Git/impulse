/*************************************************
* Pokemon Showdown News Commands                 *
* Original Code By: Lord Haji, HoeenHero         *
* Updated To Typescript By: PrinceSky & Turbo Rx *
**************************************************/
/**********************""*************"*****
* Add this code inside server/users.ts     *
* handleRename function                    *
* Impulse.NewsManager.onUserConnect(user); *
********************************************/

interface NewsEntry {
	id?: number;
	title: string;
	postedBy: string;
	desc: string;
	postTime: string;
	timestamp: number;
}

class NewsManager {
	static async generateNewsDisplay(): Promise<string[]> {
		const newsData = await db.news.get() as NewsEntry[] | null;
		const news = Array.isArray(newsData) ? newsData : [];
		
		return news
			.sort((a, b) => b.timestamp - a.timestamp)
			.slice(0, 3)
			.map(entry =>
				`<center><strong>${entry.title}</strong></center><br>` +
				`${entry.desc}<br><br>` +
				`<small>-<em> ${Impulse.nameColor(entry.postedBy, true, false)}</em> on ${entry.postTime}</small>`
			);
	}
	
	static async onUserConnect(user: User): Promise<void> {
		const newsData = await db.news.get() as NewsEntry[] | null;
		if (!newsData || !Array.isArray(newsData) || newsData.length === 0) {
			return; // Don't send anything if no news exists
		}
		
		const news = await this.generateNewsDisplay();
		if (news.length) {
			user.send(`|pm| ${Impulse.serverName} News|${user.getIdentity()}|/raw ${news.slice(0, 3).join('<hr>')}`);
		}
	}
	
	static async addNews(title: string, desc: string, user: User): Promise<string> {
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const now = new Date();
		
		const newsEntry: NewsEntry = {
			title,
			postedBy: user.name,
			desc,
			postTime: `${months[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()}`,
			timestamp: now.getTime()
		};
		
		await db.news.insert(newsEntry);
		return `Added Server News: ${title}`;
	}
	
	static async deleteNews(title: string): Promise<string | null> {
		const newsData = await db.news.get() as NewsEntry[] | null;
		const news = Array.isArray(newsData) ? newsData : [];
		const newsItem = news.find(item => item.title === title);
		
		if (!newsItem) return `News with this title doesn't exist.`;
		
		await db.news.remove(newsItem.id!);
		return `Deleted Server News titled: ${title}.`;
	}
}

Impulse.NewsManager = NewsManager;

export const commands: Chat.Commands = {
	servernews: {
		'': 'view',
		display: 'view',
		async view(target, room, user) {
			if (!this.runBroadcast()) return;
			const newsDisplay = await NewsManager.generateNewsDisplay();
			const output = newsDisplay.length 
				? `<center><strong>Server News:</strong></center>${newsDisplay.join('<hr>')}`
				: `<center><strong>Server News:</strong></center><center><em>No news available.</em></center>`;
			
			if (this.broadcasting) {
				return this.sendReplyBox(`<div class="infobox-limited">${output}</div>`);
			}
			user.send(`|popup||wide||html|<div class="infobox">${output}</div>`);
		},
		
		async add(target, room, user) {
			this.checkCan('ban');
			if (!target) return this.parse('/help servernewshelp');
			const [title, ...descParts] = target.split(',');
			if (!descParts.length) return this.errorReply("Usage: /news add [title], [desc]");
			const result = await NewsManager.addNews(title.trim(), descParts.join(',').trim(), user);
			this.sendReply(`You have added news with title ${title}`);
		},
		
		remove: 'delete',
		async delete(target, room, user) {
			this.checkCan('ban');
			if (!target) return this.parse('/help servernewshelp');
			const result = await NewsManager.deleteNews(target);
			if (result) {
				this.sendReply(`You've removed news with title ${target}`);
			} else {
				this.errorReply("News with this title doesn't exist.");
			}
		},
	},

	servernewshelp(target, room, user) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox(
			`<div><b><center>Server News Commands</center></b><br>` +
			`<ul>` +
			`<li><code>/servernews view</code> - Views current server news</li><br>` +
			`<li><code>/servernews delete [title]</code> - Deletes news with [title] (Requires @, &, ~)</li><br>` +
			`<li><code>/servernews add [title], [desc]</code> - Adds news (Requires @, &, ~)</li>` +
			`</ul></div>`
		);
	},
};
