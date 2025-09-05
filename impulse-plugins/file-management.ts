/* Server Files Management Commands
 *
 * Instructions:
 * - Obtain a GitHub "personal access token" with the "gist" permission.
 * - Set this token as Config.githubToken in your configuration.
 * - These commands are restricted to console/owner accounts for security.
 *
 * Credits: HoeenHero ( Original HasteBin Code )
 * Updates & Typescript Conversion: Prince Sky
 */

import * as https from "https";
import { FS } from "../lib";

const GITHUB_API_URL = "https://api.github.com/gists";
const GITHUB_TOKEN: string | undefined = Config.githubToken;

interface GistResponse {
  id: string;
  html_url: string;
}

function notifyStaff(action: string, file: string, user: User, info = "") {
  const staffRoom = Rooms.get("staff");
  if (!staffRoom) return;

  const safeFile = Chat.escapeHTML(file);
  const safeUser = Chat.escapeHTML(user.id);

  const message =
    '<div class="infobox">' +
    '<strong>[FILE MANAGEMENT]</strong> ' + action + '<br>' +
    '<strong>File:</strong> ' + safeFile + '<br>' +
    '<strong>User:</strong> <username>' + safeUser + '</username><br>' +
    (info ? Chat.escapeHTML(info) : '') +
    '</div>';

  staffRoom.addRaw(message).update();
}

function notifyUserBox(
  context: Chat.CommandContext,
  action: string,
  file: string,
  user: User,
  link = "",
  info = ""
) {
  const safeFile = Chat.escapeHTML(file);
  const safeUser = Chat.escapeHTML(user.id);

  const message =
    '<div class="infobox">' +
    '<strong>[FILE MANAGEMENT]</strong> ' + action + '<br>' +
    '<strong>File:</strong> ' + safeFile + '<br>' +
    '<strong>User:</strong> <username>' + safeUser + '</username>' +
    (link ? '<br><strong>Source:</strong> ' + Chat.escapeHTML(link) : '') +
    (info ? '<br>' + Chat.escapeHTML(info) : '') +
    '</div>';

  context.sendReplyBox(message);
}

async function githubRequest<T>(
  method: "POST" | "PATCH",
  path: string,
  data: Record<string, any>
): Promise<T> {
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token not configured in Config.githubToken");
  }

  const postData = JSON.stringify(data);

  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path,
    method,
    headers: {
      "User-Agent": Config.serverid || "PS-FileManager",
      Authorization: "Bearer " + GITHUB_TOKEN,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  return new Promise<T>((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(
            new Error("GitHub API error " + res.statusCode + ": " + body)
          );
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Failed to parse GitHub API response"));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function fetchFromGistRaw(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        return reject(new Error("Failed to fetch gist (HTTP " + res.statusCode + ")"));
      }
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function validateGistRawURL(url: string): void {
  const allowedPrefix = "https://gist.githubusercontent.com/";
  if (!url.startsWith(allowedPrefix)) {
    throw new Error("Invalid URL. Only raw gist URLs from gist.githubusercontent.com are allowed.");
  }
}

class FileManager {
  static async uploadToGist(
    content: string,
    filePath: string,
    description = "Uploaded via bot"
  ): Promise<string> {
    const baseFilename = filePath.split("/").pop()!;
    const response = await githubRequest<GistResponse>("POST", "/gists", {
      description,
      public: false,
      files: {
        [baseFilename]: { content },
      },
    });
    return response.html_url;
  }

  static async readFile(filePath: string): Promise<string> {
    return FS(filePath).readIfExists();
  }

  static async writeFile(filePath: string, data: string): Promise<void> {
    await FS(filePath).write(data);
  }

  static async deleteFile(filePath: string): Promise<void> {
    await FS(filePath).unlinkIfExists();
  }
}

export const commands: ChatCommands = {
  async fileupload(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();
    const filePath = target.trim();
    const fileContent = await FileManager.readFile(filePath);

    if (!fileContent) return this.errorReply("File not found: " + filePath);

    try {
      const url = await FileManager.uploadToGist(
        fileContent,
        filePath,
        "Uploaded by " + user.name
      );
      notifyUserBox(this, "Uploaded file", filePath, user, url);
      notifyStaff("Uploaded file", filePath, user);
    } catch (err: any) {
      this.errorReply("Upload failed: " + err.message);
      notifyUserBox(this, "Upload failed", filePath, user, "", err.message);
      notifyStaff("Upload failed", filePath, user, err.message);
    }
  },
  fu: 'fileupload',

  async fileread(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();
    const filePath = target.trim();

    try {
      const content = await FileManager.readFile(filePath);
      if (!content) return this.errorReply("File not found: " + filePath);

      this.sendReplyBox(
        "<b>Contents of " + Chat.escapeHTML(filePath) + ":</b><br>" +
        "<details><summary>Show/Hide File</summary>" +
        "<div style=\"max-height:320px; overflow:auto;\"><pre>" +
          Chat.escapeHTML(content) +
        "</pre></div></details>"
      );
    } catch (err: any) {
      this.errorReply("Error reading file: " + err.message);
    }
  },
  fr: 'fileread',

  async filesave(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();

    const [path, url] = target.split(",").map(p => p.trim());
    if (!path || !url) {
      return this.errorReply("Usage: /filesave path, raw-gist-url");
    }

    try {
      validateGistRawURL(url);
      const content = await fetchFromGistRaw(url);
      await FileManager.writeFile(path, content);

      notifyUserBox(this, "Saved file from Gist", path, user, url);
      notifyStaff("Saved file from Gist", path, user);
    } catch (err: any) {
      this.errorReply("File save failed: " + err.message);
      notifyUserBox(this, "File save failed", path, user, url, err.message);
      notifyStaff("File save failed", path, user, err.message);
    }
  },
  fs: 'filesave',

  async filedelete(target, room, user) {
    this.runBroadcast();
    this.canUseConsole();

    const [flag, ...pathParts] = target.split(",");
    const confirm = flag.trim().toLowerCase() === "confirm";
    const filePath = pathParts.join(",").trim();

    if (!confirm || !filePath) {
      return this.errorReply(
        "Usage: /filedelete confirm, path\nExample: /filedelete confirm, data/test.txt"
      );
    }

    try {
      await FileManager.deleteFile(filePath);
      notifyUserBox(this, "Deleted file", filePath, user);
      notifyStaff("Deleted file", filePath, user);
    } catch (err: any) {
      this.errorReply("File deletion failed: " + err.message);
      notifyUserBox(this, "File deletion failed", filePath, user, "", err.message);
      notifyStaff("File deletion failed", filePath, user, err.message);
    }
  },
  fd: 'filedelete',

	fmhelp(target, room, user) {
    if (!this.runBroadcast()) return;
    this.sendReplyBox(
		 `<div><b><center>File Management Commands</center></b><br>` +
		 `<ul><li><code>/fileupload [path]</code> OR <code>/fu [path]</code> - Upload file to GitHub Gist (Requires: Console/Owner)</li><br>` +
		 `<li><code>/fileread [path]</code> OR <code>/fr [path]</code> - Read file contents (Requires: Console/Owner)</li><br>` +
		 `<li><code>/filesave [path],[raw gist url]</code> OR <code>/fs [path],[raw gist url]</code> - Save/overwrite file (Requires: Console/Owner)</li><br>` +
		 `<li><code>/filedelete confirm,[path]</code> OR <code>/fd confirm,[path]</code> - Delete file (Requires: Console/Owner)</li>` +
		 `</ul></div>`);
	},
	filemanager: 'fm',
};
		 
