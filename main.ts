import { Scanner } from "./scanner.ts";

const scanner = new Scanner("A = 'b'");
for await (const token of scanner.source) {
  scanner.scan();
}
