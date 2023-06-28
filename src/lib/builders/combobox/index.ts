import {
	executeCallbacks,
	generateId,
	addEventListener,
	kbd,
} from '@melt-ui/svelte/internal/helpers';
import type { Action } from 'svelte/action';
import { writable, type Readable, type Writable, derived, get } from 'svelte/store';
import type { HTMLAttributes, HTMLInputAttributes, HTMLLabelAttributes } from 'svelte/elements';

interface ComboboxProps<T> {
	items: T[];
	/** @see https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView#block */
	scrollAlignment?: 'nearest' | 'center';
	disabled?: boolean;
	// itemToString: (item: T) => string;
	// filterFunction: (value: string) => void;
	// selectItem?: (item: T) => void;
}

interface Combobox<T> {
	open: Readable<boolean>;
	filterInput: Action<HTMLInputElement, void>;
	listItem: Action<HTMLLIElement, void>;
	// @TODO: support OL, DL, div, nav, etc
	list: Action<HTMLUListElement, void>;
	filterInputAttributes: Readable<HTMLInputAttributes>;
	labelAttributes: HTMLLabelAttributes;
	listAttributes: HTMLAttributes<HTMLUListElement | HTMLOListElement | HTMLDListElement>;
	selectedItem: Readable<T>;
	inputValue: Readable<string>;
}

const defaults = {
	disabled: false,
	scrollAlignment: 'nearest',
};

export function createCombobox<T>(args: ComboboxProps<T>) {
	const withDefaults = { ...defaults, ...args } as ComboboxProps<T>;
	const options = writable(withDefaults);

	const id = generateId();
	const open = writable(false);
	const selectedItem = writable<T>(undefined);
	const itemCount = writable(0);
	const trapFocus = false;
	const inputValue = writable('');

	const ids = {
		input: generateId(),
		menu: generateId(),
		label: generateId(),
	};

	const menu = {
		...derived(
			[open, options],
			([$open, $options]) =>
				({
					// 'aria-autocomplete': 'list',
					// 'aria-controls': ids.menu,
					// 'aria-expanded': $open,
					// 'aria-labelledby': ids.label,
					// autocomplete: 'off',
					// id: ids.input,
					// role: 'combobox',
					// 'data-disabled': $options.disabled ? true : undefined,
					// disabled: $options.disabled,
				} as const)
		),
		action: (node: HTMLUListElement) => {
			function setListValues() {
				const listItems = node.querySelectorAll('[data-list-item]');

				listItems.forEach((el, i) => {
					// setAttribute(el, 'data-index', i);
					// setAttribute(el, 'id', `${id}-descendent-${i}`);
				});

				itemCount.set(listItems.length);
			}

			setListValues();
			// const unbind = emitter.on('update', setListValues);

			return {
				// destroy: () => unbind(),
			};
		},
	};

	const option = {
		action: (node: HTMLLIElement) => {
			// setAttribute(node, 'data-list-item');

			function highlightItem() {
				document.querySelector(`[data-highlighted]`)?.removeAttribute('data-highlighted');
				const { index } = node.dataset;

				if (index) {
					// setAttribute(node, 'data-highlighted');
				}
			}

			function unHighlightItem() {
				node.removeAttribute('data-highlighted');
			}

			function onClick() {
				const { index } = node.dataset;
				if (index) {
					const parsedIndex = parseInt(index, 10);
					// setSelectedItem(parsedIndex, document.getElementById(`${id}-input`) as HTMLInputElement);
					document.getElementById(`${id}-input`)?.focus();
					close();
				}
			}

			function onMouseDown() {
				// trapFocus = true;
			}

			function onMouseUp() {
				// trapFocus = false;
			}

			const unsub = executeCallbacks(
				addEventListener(node, 'mouseenter', highlightItem),
				addEventListener(node, 'mouseleave', unHighlightItem),
				addEventListener(node, 'mousedown', onMouseDown),
				addEventListener(document, 'mouseup', onMouseUp),
				addEventListener(node, 'click', onClick)
			);

			return {
				destroy: unsub,
			};
		},
	};

	const input = {
		...derived(
			[open, options],
			([$open, $options]) =>
				({
					'aria-autocomplete': 'list',
					'aria-controls': ids.menu,
					'aria-expanded': $open,
					'aria-labelledby': ids.label,
					autocomplete: 'off',
					id: ids.input,
					role: 'combobox',
					'data-disabled': $options.disabled ? true : undefined,
					disabled: $options.disabled,
				} as const)
		),
		action: (node: HTMLInputElement) => {
			function removeHighlight() {
				const item = document.querySelector(`[data-highlighted]`) as HTMLElement;

				if (item) {
					item.removeAttribute('data-highlighted');
					const { index } = item.dataset;

					if (index) {
						return parseInt(index, 10);
					}
				}
				return -1;
			}

			// @TODO set activedescendant on the input.
			// "aria-activedescendant":
			// highlightedIndex > -1 ? `${id}-descendent-${highlightedIndex}` : "",
			function scrollToItem(index: number) {
				const $options = get(options);
				const el = document.querySelector(`[data-index="${index}"]`);
				if (el) {
					// setAttribute(el, 'data-highlighted');
					el.scrollIntoView({ block: $options.scrollAlignment });
				}
			}

			const unsub = executeCallbacks(
				// addEventListener(node, 'blur', close),
				// addEventListener(node, 'focus', open),
				addEventListener(node, 'keydown', (e: KeyboardEvent) => {
					const $open = get(open);
					// Handle key events when the menu is closed.
					if (!$open) {
						// The user presses `esc`. The input should be cleared and lose focus.
						if (e.key === kbd.ESCAPE) {
							node.blur();
							node.value = '';
							return;
						}
						/**
						 * If the user presses one of the interaction keys, return
						 * early so that the other key events aren't fired.
						 */
						// if (interactionKeys.has(e.key)) {
						// 	return;
						// }
						// Don't open the menu on backspace if the input is blank.
						if (e.key === kbd.BACKSPACE && node.value === '') {
							return;
						}
						// Otherwise, open the input.
						open();
					}

					// Handle key events when the menu is open.
					switch (e.key) {
						case kbd.ESCAPE: {
							close();
							break;
						}
						case kbd.ENTER: {
							const { index } = (document.querySelector(`[data-highlighted]`) as HTMLElement)
								.dataset;

							if (index) {
								setSelectedItem(parseInt(index, 10), e.target as HTMLInputElement);
							}

							close();
							break;
						}
						case kbd.HOME: {
							scrollToItem(0);
							break;
						}
						case kbd.END: {
							const nextIndex = store$.itemCount - 1;
							scrollToItem(nextIndex);
							break;
						}
						case kbd.PAGE_UP: {
							const previousHightlightedIndex = removeHighlight();
							const nextIndex = getNextIndex({
								currentIndex: previousHightlightedIndex,
								itemCount: store$.itemCount,
								moveAmount: -10,
							});
							scrollToItem(nextIndex);
							break;
						}
						case kbd.PAGE_DOWN: {
							const previousHightlightedIndex = removeHighlight();
							const nextIndex = getNextIndex({
								currentIndex: previousHightlightedIndex,
								itemCount: store$.itemCount,
								moveAmount: 10,
							});
							scrollToItem(nextIndex);
							break;
						}
						case kbd.ARROW_DOWN: {
							// figure out the currently highlighted item (if any)
							// we also need to remove that highlight
							// set the new hightlight based on the index

							const previousHightlightedIndex = removeHighlight();
							const nextIndex = getNextIndex({
								currentIndex: previousHightlightedIndex,
								itemCount: store$.itemCount,
								moveAmount: 1,
							});
							scrollToItem(nextIndex);
							break;
						}
						case kbd.ARROW_UP: {
							if (e.altKey) {
								close();
								return;
							}
							const previousHightlightedIndex = removeHighlight();
							const nextIndex = getNextIndex({
								currentIndex: previousHightlightedIndex,
								itemCount: store$.itemCount,
								moveAmount: -1,
							});
							scrollToItem(nextIndex);
							break;
						}
					}
				}),
				addEventListener(node, 'input', (e: Event) => {
					// @TODO: throttle this value
					const value = (e.target as HTMLInputElement).value;
					inputValue.set(value);
					// filterFunction(value);
					// emitter.emit('update');
				})
			);

			return {
				destroy: unsub,
			};
		},
	};

	return {
		input,
		open,
		menu,
		option,
	};
}
