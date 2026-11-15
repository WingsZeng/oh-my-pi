import { describe, expect, it } from "bun:test";
import { FullscreenChatView } from "@oh-my-pi/pi-coding-agent/modes/components/fullscreen-chat-view";
import { type Component, Container } from "@oh-my-pi/pi-tui";

class LinesComponent implements Component {
	renders = 0;
	widths: number[] = [];

	constructor(public lines: string[]) {}

	render(width: number): readonly string[] {
		this.renders++;
		this.widths.push(width);
		return this.lines;
	}
}

function plain(lines: readonly string[]): string[] {
	return lines.map(line => Bun.stripANSI(line).trimEnd());
}

describe("FullscreenChatView", () => {
	it("renders the transcript once at one stable scrollbar width and keeps the dock fixed", () => {
		const transcript = new LinesComponent(Array.from({ length: 8 }, (_, index) => `message-${index + 1}`));
		const pending = new LinesComponent(["pending"]);
		const editor = new LinesComponent(["editor"]);
		const status = new LinesComponent(["status"]);
		const editorContainer = new Container();
		editorContainer.addChild(editor);
		const view = new FullscreenChatView({
			transcript: [transcript],
			dock: [pending, editor, status],
			editorContainer,
			terminalRows: () => 6,
		});

		const rendered = plain(view.render(12));

		expect(transcript.renders).toBe(1);
		expect(transcript.widths).toEqual([11]);
		expect(rendered[0]).toContain("message-6");
		expect(rendered.slice(-3)).toEqual(["pending", "editor", "status"]);
		expect(pending.renders).toBe(1);
		expect(editor.renders).toBe(1);
		expect(status.renders).toBe(1);
	});

	it("follows appends at the tail but keeps an absolute viewport while scrolled up", () => {
		const transcript = new LinesComponent(Array.from({ length: 10 }, (_, index) => `row-${index + 1}`));
		const editor = new LinesComponent(["editor"]);
		const editorContainer = new Container();
		editorContainer.addChild(editor);
		const view = new FullscreenChatView({
			transcript: [transcript],
			dock: [editor],
			editorContainer,
			terminalRows: () => 5,
		});

		expect(plain(view.render(10))[0]).toContain("row-7");
		transcript.lines.push("row-11");
		expect(plain(view.render(10))[0]).toContain("row-8");

		expect(view.handleViewportInput("\x1b[5~")).toBe(true);
		const scrolledTop = plain(view.render(10))[0];
		transcript.lines.push("row-12", "row-13");
		expect(plain(view.render(10))[0]).toBe(scrolledTop);
	});

	it("caps a tall dock to leave one transcript row and handles only viewport input", () => {
		const transcript = new LinesComponent(["transcript"]);
		const oldEditor = new LinesComponent(["old-editor"]);
		const editor = new LinesComponent(["dialog", "editor"]);
		const status = new LinesComponent(["status"]);
		const editorContainer = new Container();
		editorContainer.addChild(oldEditor);
		const view = new FullscreenChatView({
			transcript: [transcript],
			dock: [new LinesComponent(["pending"]), editor, status],
			editorContainer,
			terminalRows: () => 4,
		});

		const rendered = plain(view.render(12));
		expect(rendered[0]).toContain("transcript");
		expect(rendered.slice(1)).toEqual(["dialog", "editor", "status"]);
		expect(view.ownsOverlayFocusTarget(oldEditor)).toBe(true);
		editorContainer.clear();
		editorContainer.addChild(editor);
		expect(view.ownsOverlayFocusTarget(oldEditor)).toBe(false);
		expect(view.ownsOverlayFocusTarget(editor)).toBe(true);
		expect(view.handleViewportInput("typed text")).toBe(false);
		expect(view.handleViewportInput("\x1b[A")).toBe(false);
		expect(view.handleViewportInput("\x1b[<broken")).toBe(false);
		expect(view.handleViewportInput("\x1b[<0;1;1M")).toBe(true);
		expect(view.handleViewportInput("\x1b[<64;1;1M")).toBe(true);
		expect(view.handleViewportInput("\x1b[1;5H")).toBe(true);
		expect(view.handleViewportInput("\x1b[1;5F")).toBe(true);
	});
});
