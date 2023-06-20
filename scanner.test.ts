import { describe, it } from "std/testing/bdd.ts";
import {
  assert,
  assertEquals,
  assertFalse,
  assertRejects,
} from "std/testing/asserts.ts";
import { Scanner, TokenTypes, Tokens, isWhitespace } from "./scanner.ts";

describe("Scanner", () => {
  it("Should read a string", () => {
    const scanner = new Scanner("A = 'b'");
    assert(scanner);
    assertEquals(scanner.source, "A = 'b'");
  });

  it("Should read a byte", async () => {
    const scanner = new Scanner("A = 'b'");

    const byte = await scanner.read();
    assert(byte);
    assertEquals(byte, "A".charCodeAt(0), "Byte corresponds to character code");
    assertEquals("A", String.fromCharCode(byte));
  });

  describe("scan whitespace", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      ["   ", null, Tokens.TokenWS],
      ["\t", null, Tokens.TokenWS],
      ["\n", null, Tokens.TokenWS],
    ];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertEquals(token.literal, input);
        }
      });
    }
  });

  describe("scan identifier", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      [`test`, null, Tokens.TokenIdentifier],
      [`@test.123`, null, Tokens.TokenIdentifier],
      [`_test.123`, null, Tokens.TokenIdentifier],
      [`#test.123`, null, Tokens.TokenIdentifier],
      [`#test.123:456`, null, Tokens.TokenIdentifier],
      [`test'`, "test", Tokens.TokenIdentifier],
      [`test"d`, "test", Tokens.TokenIdentifier],
    ];

    const failCases: [string, string | null, TokenTypes][] = [
      [`.test.123`, ".", Tokens.TokenUnexpected],
      [`:test.123`, ":", Tokens.TokenUnexpected],
      [`test#@`, null, Tokens.TokenIdentifier],
    ];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertEquals(token.literal, input);
        }
      });
    }

    for (const [input, expected, tokenExpected] of failCases) {
      it(`Should fail to tokenize ${input}`, async () => {
        const scanner = new Scanner(input);

        if (expected) {
          const token = await scanner.scan();
          assertEquals(token.type, tokenExpected);
          assertEquals(token.literal, expected);
        } else {
          await assertRejects(() => scanner.scan());
        }
      });
    }
  });

  describe("scan number", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      [`123`, null, Tokens.TokenNumber],
      [`-123`, null, Tokens.TokenNumber],
      [`-123.456`, null, Tokens.TokenNumber],
      [`123.456`, null, Tokens.TokenNumber],
      [`12-3`, "12", Tokens.TokenNumber],
    ];

    const failCases: [string, string | null, TokenTypes][] = [
      [`.123`, ".", Tokens.TokenUnexpected],
      [`- 123`, null, Tokens.TokenNumber],
      [`123.abc`, null, Tokens.TokenNumber],
    ];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertEquals(token.literal, input);
        }
      });
    }

    for (const [input, expected, tokenExpected] of failCases) {
      it(`Should fail to tokenize ${input}`, async () => {
        const scanner = new Scanner(input);

        if (expected) {
          const token = await scanner.scan();
          assertEquals(token.type, tokenExpected);
          assertEquals(token.literal, expected);
        } else {
          await assertRejects(() => scanner.scan());
        }
      });
    }
  });

  describe("scan text", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      [String.raw`""`, null, Tokens.TokenText],
      [String.raw`''`, null, Tokens.TokenText],
      [String.raw`'test'`, "test", Tokens.TokenText],
      [String.raw`'te\'st'`, "te'st", Tokens.TokenText],
      [String.raw`"te\"st"`, 'te"st', Tokens.TokenText],
      [String.raw`'te\'st'`, "te'st", Tokens.TokenText],
      [String.raw`"tes@#,;!@#%^'\"t"`, `tes@#,;!@#%^'"t`, Tokens.TokenText],
      [String.raw`'tes@#,;!@#%^\'"t'`, `tes@#,;!@#%^'"t`, Tokens.TokenText],
    ];

    const failCases: [string, string | null, TokenTypes][] = [];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertFalse(expected);
        }
      });
    }
  });

  describe("scan sign", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      [`=`, null, Tokens.TokenSign],
      [`>`, null, Tokens.TokenSign],
      [`<`, null, Tokens.TokenSign],
      [`>=`, null, Tokens.TokenSign],
      [`<=`, null, Tokens.TokenSign],
      [`!=`, null, Tokens.TokenSign],
      [`~`, null, Tokens.TokenSign],
      [`!~`, null, Tokens.TokenSign],
      [`?=`, null, Tokens.TokenSign],
      [`?!=`, null, Tokens.TokenSign],
      [`?~`, null, Tokens.TokenSign],
      [`?!~`, null, Tokens.TokenSign],
      [`?>`, null, Tokens.TokenSign],
      [`?>=`, null, Tokens.TokenSign],
      [`?<`, null, Tokens.TokenSign],
      [`?<=`, null, Tokens.TokenSign],
    ];

    const failCases: [string, string | null, TokenTypes][] = [];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertEquals(token.literal, input);
        }
      });
    }
  });

  describe("scan join", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      ["&& ||", "&&", Tokens.TokenJoin],
      ["'||test&&'&&123", "||test&&", Tokens.TokenText],
    ];

    const failCases: [string, string | null, TokenTypes][] = [];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertEquals(token.literal, input);
        }
      });
    }
  });

  describe("scan group", () => {
    const passCases: [string, string | null, TokenTypes][] = [
      [`a)`, "a", Tokens.TokenIdentifier],
      [`(a b c)`, "a b c", Tokens.TokenGroup],
      [`((a b c))`, "(a b c)", Tokens.TokenGroup],
      [`((a )b c)`, "(a )b c", Tokens.TokenGroup],
      [`("ab)("c)`, '"ab)("c', Tokens.TokenGroup],
    ];

    const failCases: [string, string | null, TokenTypes][] = [
      [`(a b c`, null, Tokens.TokenGroup],
      [`("ab)(c)`, null, Tokens.TokenGroup],
    ];

    for (const [input, expected, tokenExpected] of passCases) {
      it(`Should tokenize ${input}`, async () => {
        const scanner = new Scanner(input);
        const token = await scanner.scan();
        assertEquals(token.type, tokenExpected);

        if (expected) {
          assertEquals(token.literal, expected);
        } else {
          assertEquals(token.literal, input);
        }
      });
    }

    for (const [input, expected, tokenExpected] of failCases) {
      it(`Should fail to tokenize ${input}`, async () => {
        const scanner = new Scanner(input);

        if (expected) {
          const token = await scanner.scan();
          assertEquals(token.type, tokenExpected);
          assertEquals(token.literal, expected);
        } else {
          await assertRejects(() => scanner.scan());
        }
      });
    }
  });
});

describe("isWhitespace", () => {
  const tests = ["   ", "\t", "\n"];

  for (const test of tests) {
    it(`Should return true for ${test}`, () => {
      assert(isWhitespace(test));
    });
  }
});
