// Tiny dependency-free game ID generator. crypto.randomUUID would also work
// but isn't available in every TS runtime out of the box.

let counter = 0;
export function v4(): string {
  counter++;
  return `g${Date.now().toString(36)}${counter.toString(36)}`;
}
