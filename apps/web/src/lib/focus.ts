/** Move focus to the first of these elements that exists and is enabled, so the user lands on
 * the field that needs fixing. Text in a single-line input is selected to make retyping quick.
 * Falsy entries are skipped, which lets callers write `errors.x && "x-id"`. */
export function focusFirst(ids: (string | false | null | undefined)[]): void {
  for (const id of ids) {
    if (!id) continue;
    const element = document.getElementById(id);
    if (!element || (element as HTMLInputElement).disabled) continue;
    element.focus();
    if (element instanceof HTMLInputElement && ["text", "password"].includes(element.type)) {
      element.select();
    }
    return;
  }
}
