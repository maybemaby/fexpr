import { describe, it } from "std/testing/bdd.ts";
import { ExprGroup, parse } from "./parser.ts";
import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "std/testing/asserts.ts";

function renderExprGroup(group: ExprGroup[]): string {
  return group
    .map((g) => {
      if (Array.isArray(g.item)) {
        return `${g.join} (${renderExprGroup(g.item)})`;
      }
      return `${g.join} <${g.item.left.type} ${g.item.left.literal}> ${g.item.op} <${g.item.right.type} ${g.item.right.literal}>`;
    })
    .join(", ");
}

describe("parse", () => {
  describe("simple expressions", () => {
    const passCases: [string, string][] = [
      ["1=12", "&& <number 1> = <number 12>"],
      ["   1    =    12    ", "&& <number 1> = <number 12>"],
      [`"demo" != test`, "&& <text demo> != <identifier test>"],
      [`a~1`, "&& <identifier a> ~ <number 1>"],
    ];

    for (const [input, expected] of passCases) {
      it(`Should parse ${input}`, async () => {
        const res = await parse(input);
        assertEquals(renderExprGroup(res), expected);
      });
    }
  });

  describe("group expressions", () => {
    const passCases: [string, string][] = [
      ["(a=1)", "&& (&& <identifier a> = <number 1>)"],
      [`(a="test(")`, "&& (&& <identifier a> = <text test(>)"],
      [`(a="test)")`, "&& (&& <identifier a> = <text test)>)"],
      [`((a=1))`, "&& (&& (&& <identifier a> = <number 1>))"],
      [
        `a=1 || 2!=3`,
        "&& <identifier a> = <number 1>, || <number 2> != <number 3>",
      ],
      [
        `a=1 && 2!=3`,
        "&& <identifier a> = <number 1>, && <number 2> != <number 3>",
      ],
      [
        `(a=1 && 2!=3) || "b"=a`,
        "&& (&& <identifier a> = <number 1>, && <number 2> != <number 3>), || <text b> = <identifier a>",
      ],
      [
        `((a=1 || a=2) && (c=1))`,
        "&& (&& (&& <identifier a> = <number 1>, || <identifier a> = <number 2>), && (&& <identifier c> = <number 1>))",
      ],
    ];

    const failCases: string[] = [
      "()",
      "(a=1",
      "a=1)",
      "a=1))",
      "{a=1}",
      "[a=1]",
      "(a=1 || a=2) && c=1))",
    ];

    for (const [input, expected] of passCases) {
      it(`Should parse ${input}`, async () => {
        const res = await parse(input);
        assertEquals(renderExprGroup(res), expected);
      });
    }

    for (const input of failCases) {
      it(`Should fail to parse ${input}`, async () => {
        await assertRejects(() => parse(input));
      });
    }
  });
});
