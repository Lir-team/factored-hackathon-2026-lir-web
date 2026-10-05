/* Tiny DOM helpers. */

/**
 * Create an element. `props` keys: `class`, `text`, `dataset`, `attrs`,
 * anything else is assigned as a property (e.g. `type`, `name`, `checked`).
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "attrs") for (const [name, v] of Object.entries(value)) el.setAttribute(name, v);
    else el[key] = value;
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Set text and toggle the `is-empty` blank-line style used on the slip. */
export function setSlipValue(el, text) {
  el.textContent = text ?? "";
  el.classList.toggle("is-empty", !text);
}
