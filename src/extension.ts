import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
const API_KEY = config.apiKey;

export function activate (context: vscode.ExtensionContext) {
	const disposable = vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = event.document;
		const changes = event.contentChanges;

		for (const change of changes) {
			if (change.text === '#' && isDoubleNumberSign(document, change.range.end)) {
				handleEmojiInsertion(editor, change.range.end);
			}
		}
	});

	context.subscriptions.push(disposable);
}

function isDoubleNumberSign (document: vscode.TextDocument, position: vscode.Position): boolean {
	const line = document.lineAt(position.line);
	const text = line.text.substring(Math.max(0, (position.character + 1) - 2), position.character + 1);
	return text === '##';
}

async function handleEmojiInsertion (editor: vscode.TextEditor, position: vscode.Position) {
	let emojiName = await vscode.window.showInputBox({ prompt: 'Enter the emoji icon name' });
	if (!emojiName) return;

	const quickPick = vscode.window.createQuickPick();
	quickPick.placeholder = 'Searching emoji...';
	quickPick.busy = true;
	quickPick.show();
	try {
		const emojis = await fetchEmojis(emojiName);

		if (emojis.length === 0) {
			quickPick.placeholder = 'No matching emoji found';
			quickPick.busy = false;
			setTimeout(() => quickPick.hide(), 2000);
			return;
		}

		quickPick.items = emojis.map(emoji => ({ label: emoji, description: emojiName }));
		quickPick.placeholder = 'Select an emoji';
		quickPick.busy = false;

		const selected = await new Promise<vscode.QuickPickItem | undefined>(resolve => {
			quickPick.onDidAccept(() => {
				resolve(quickPick.selectedItems[0]);
				quickPick.hide();
			});
			quickPick.onDidHide(() => resolve(undefined));
		});

		if (selected) {
			editor.edit(editBuilder => {
				const startPos = new vscode.Position(position.line, Math.max(0, position.character - 1));
				const endPos = new vscode.Position(position.line, position.character + 1);
				editBuilder.replace(new vscode.Range(startPos, endPos), selected.label);
			});
		}
	} catch (error) {
		console.error('Error fetching emojis:', error);
		quickPick.placeholder = 'Search emoji failed';
		quickPick.busy = false;
		setTimeout(() => quickPick.hide(), 2000);
	}
}

async function fetchEmojis (query: string): Promise<string[]> {
	// const API_KEY = vscode.workspace.getConfiguration('emojiInserter').get('apiKey');
	try {
		const response = await axios.get(`https://emoji-api.com/emojis`, {
			params: {
				search: query,
				access_key: API_KEY
			}
		});

		const emojis = response.data.map((emoji: any) => emoji.character);
		return emojis.slice(0, 20); // return up to 20 emojis
	} catch (error) {
		console.error('Error fetching emojis:', error);
		throw error;
	}
}

export function deactivate () { }
