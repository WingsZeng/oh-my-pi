import {
	type Component,
	type Container,
	matchesKey,
	type OverlayFocusOwner,
	parseSgrMouse,
	ScrollView,
} from "@oh-my-pi/pi-tui";

export interface FullscreenChatViewOptions {
	/** Shared transcript roots rendered inside the independently scrollable viewport. */
	transcript: readonly Component[];
	/** Shared roots pinned below the transcript, in render order. */
	dock: readonly Component[];
	/** Container whose live child owns keyboard focus in the fixed dock. */
	editorContainer: Container;
	/** Live terminal height. */
	terminalRows: () => number;
}

/** Renders shared components without taking ownership of their lifecycle. */
class NonOwningTranscript implements Component {
	constructor(private readonly components: readonly Component[]) {}

	render(width: number): readonly string[] {
		const lines: string[] = [];
		for (const component of this.components) lines.push(...component.render(width));
		return lines;
	}
}

/** Persistent alternate-screen chat surface with a fixed composer dock. */
export class FullscreenChatView implements Component, OverlayFocusOwner {
	readonly #transcript: NonOwningTranscript;
	readonly #scrollView: ScrollView;

	constructor(private readonly options: FullscreenChatViewOptions) {
		this.#transcript = new NonOwningTranscript(options.transcript);
		this.#scrollView = new ScrollView(this.#transcript, {
			height: 1,
			scrollbar: "always",
			followTail: true,
		});
	}

	ownsOverlayFocusTarget(component: Component): boolean {
		return this.options.editorContainer.children.includes(component);
	}

	/** Consume only transcript navigation and valid mouse reports. */
	handleViewportInput(data: string): boolean {
		const mouse = data.startsWith("\x1b[<") ? parseSgrMouse(data) : null;
		if (mouse) {
			if (mouse.wheel !== null) this.#scrollView.scroll(mouse.wheel * 3);
			return true;
		}
		if (matchesKey(data, "pageUp")) {
			this.#scrollView.page(-1);
			return true;
		}
		if (matchesKey(data, "pageDown")) {
			this.#scrollView.page(1);
			return true;
		}
		if (matchesKey(data, "ctrl+home")) {
			this.#scrollView.scrollToTop();
			return true;
		}
		if (matchesKey(data, "ctrl+end")) {
			this.#scrollView.scrollToBottom();
			return true;
		}
		return false;
	}

	invalidate(): void {
		this.#scrollView.invalidate();
	}

	render(width: number): readonly string[] {
		const rows = Math.max(1, this.options.terminalRows());
		const dock: string[] = [];
		for (const component of this.options.dock) dock.push(...component.render(width));
		const cappedDock = dock.length < rows ? dock : dock.slice(dock.length - rows + 1);
		this.#scrollView.setHeight(Math.max(1, rows - cappedDock.length));
		return [...this.#scrollView.render(width), ...cappedDock];
	}
}
