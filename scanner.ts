import { BufReader, Buffer, StringWriter } from "std/io/mod.ts";

export const Joins = {
  and: "&&",
  or: "||",
} as const;

export type JoinOps = (typeof Joins)[keyof typeof Joins];

export const SignOps = {
  SignEq: "=",
  SignNeq: "!=",
  SignLike: "~",
  SignNlike: "!~",
  SignLt: "<",
  SignLte: "<=",
  SignGt: ">",
  SignGte: ">=",

  // array/any operators
  SignAnyEq: "?=",
  SignAnyNeq: "?!=",
  SignAnyLike: "?~",
  SignAnyNlike: "?!~",
  SignAnyLt: "?<",
  SignAnyLte: "?<=",
  SignAnyGt: "?>",
  SignAnyGte: "?>=",
} as const;

type SignOps = (typeof SignOps)[keyof typeof SignOps];

export const Tokens = {
  TokenUnexpected: "unexpected",
  TokenEOF: "eof",
  TokenWS: "whitespace",
  TokenJoin: "join",
  TokenSign: "sign",
  TokenIdentifier: "identifier", // variable, column name, placeholder, etc.,
  TokenNumber: "number",
  TokenText: "text", // ' or " quoted string
  TokenGroup: "group",
} as const;

export type TokenTypes = (typeof Tokens)[keyof typeof Tokens];

export type Token = {
  type: TokenTypes;
  literal: string;
};

export class Scanner {
  private reader: BufReader;

  constructor(public source: string) {
    this.source = source;
    // Create buffer from string
    const encoded = new TextEncoder().encode(source);
    this.reader = new BufReader(new Buffer(encoded), 1024);
  }

  read() {
    return this.reader.readByte();
  }

  async scan(): Promise<Token> {
    const ch = await this.reader.peek(1);

    if (!ch) {
      return { type: Tokens.TokenEOF, literal: "" };
    }

    const literal = String.fromCharCode(ch[0]);

    if (isWhitespace(literal)) {
      return await this.scanWhitespace();
    }

    // Checks for group start
    if (literal === "(") {
      return await this.scanGroup();
    }

    if (isIdentifierStart(ch[0])) {
      return await this.scanIdentifier();
    }

    if (isNumberStart(ch[0])) {
      return await this.scanNumber();
    }

    if (isTextStart(literal)) {
      return await this.scanText();
    }

    if (isSignStart(literal)) {
      return await this.scanSign();
    }

    if (isJoinStart(literal)) {
      return await this.scanJoin();
    }

    return {
      type: Tokens.TokenUnexpected,
      literal: literal,
    };
  }

  async scanGroup() {
    const sb = new StringWriter();

    const firstCh = await this.reader.readByte();

    if (!firstCh) {
      throw new Error("Invalid group, empty buffer");
    }

    let openGroups = 1;

    while (true) {
      const ch = await this.reader.peek(1);

      if (!ch) {
        break;
      }

      const literal = String.fromCharCode(ch[0]);

      if (literal === "(") {
        openGroups++;
        await sb.write(ch);
        await this.reader.readByte();
      } else if (isTextStart(literal)) {
        try {
          const textToken = await this.scanText();
          const encoded = new TextEncoder().encode(
            '"' + textToken.literal + '"'
          );
          await sb.write(encoded);
        } catch (e) {
          if (e instanceof TextTokenError) {
            const token = e.token;
            const encoded = new TextEncoder().encode(token.literal);
            await sb.write(encoded);

            throw new TextTokenError(
              `Invalid text in group: ${token.literal}`,
              {
                type: Tokens.TokenGroup,
                literal: sb.toString(),
              }
            );
          }
        }
      } else if (literal === ")") {
        openGroups--;
        await this.reader.readByte();

        if (openGroups <= 0) {
          break;
        }
        await sb.write(ch);
      } else {
        await sb.write(ch);
        await this.reader.readByte();
      }
    }

    const stringLiteral = sb.toString();

    if (String.fromCharCode(firstCh) !== "(" || openGroups > 0) {
      throw new Error(
        `Invalid group - missing ${openGroups} closing bracket(s)`
      );
    }

    return {
      type: Tokens.TokenGroup,
      literal: stringLiteral,
    };
  }

  async scanJoin() {
    const sb = new StringWriter();

    while (true) {
      const ch = await this.reader.peek(1);

      if (!ch) {
        break;
      }

      const literal = String.fromCharCode(ch[0]);

      if (!isJoinStart(literal)) {
        break;
      }

      await sb.write(ch);
      await this.reader.readByte();
    }

    const stringLiteral = sb.toString();

    // Check if the string literal is a valid join operator
    if (!Object.values(Joins).includes(stringLiteral as JoinOps)) {
      throw new Error(`Invalid join operator: ${stringLiteral}`);
    }

    return {
      type: Tokens.TokenJoin,
      literal: stringLiteral,
    };
  }

  async scanSign() {
    const sb = new StringWriter();

    while (true) {
      const ch = await this.reader.peek(1);

      if (!ch) {
        break;
      }

      const literal = String.fromCharCode(ch[0]);

      if (!isSignStart(literal)) {
        break;
      }

      await sb.write(ch);
      await this.reader.readByte();
    }

    const stringLiteral = sb.toString();

    if (!isSignOperator(stringLiteral)) {
      throw new Error(`Invalid sign operator: ${stringLiteral}`);
    }

    return {
      type: Tokens.TokenSign,
      literal: stringLiteral,
    };
  }

  private async scanText() {
    const sb = new StringWriter();

    const firstCh = await this.reader.readByte();

    if (!firstCh) {
      throw new Error("Invalid text, empty buffer");
    }

    const firstLiteral = String.fromCharCode(firstCh);

    sb.write(Uint8Array.from([firstCh]));

    let prevCh = firstCh;
    let hasMatchingQuotes = false;

    while (true) {
      const ch = await this.reader.readByte();

      if (!ch) {
        break;
      }

      const literal = String.fromCharCode(ch);
      sb.write(Uint8Array.from([ch]));

      if (literal === firstLiteral && prevCh !== 92) {
        hasMatchingQuotes = true;
        break;
      }
      prevCh = ch;
    }

    let stringLiteral = sb.toString();

    if (!hasMatchingQuotes) {
      const token = {
        type: Tokens.TokenText,
        literal: stringLiteral,
      };

      throw new TextTokenError(`Invalid text: ${stringLiteral}`, token);
    }

    stringLiteral = stringLiteral.substring(1, stringLiteral.length - 1);
    stringLiteral = stringLiteral.replaceAll(`\\${firstLiteral}`, firstLiteral);

    return {
      type: Tokens.TokenText,
      literal: stringLiteral,
    };
  }

  private async scanWhitespace() {
    const sb = new StringWriter();
    while (true) {
      const ch = await this.reader.peek(1);
      if (!ch) {
        break;
      }

      const literal = String.fromCharCode(ch[0]);

      if (!isWhitespace(literal)) {
        break;
      }

      await sb.write(ch);
      await this.reader.readByte();
    }

    return {
      type: Tokens.TokenWS,
      literal: sb.toString(),
    };
  }

  private async scanIdentifier() {
    const sb = new StringWriter();
    while (true) {
      const ch = await this.reader.peek(1);

      if (!ch) {
        break;
      }

      const literalChar = String.fromCharCode(ch[0]);

      if (
        !isIdentifierStart(ch[0]) &&
        !isDigit(ch[0]) &&
        literalChar !== "." &&
        literalChar !== ":"
      ) {
        break;
      }

      await sb.write(ch);
      await this.reader.readByte();
    }

    const stringLiteral = sb.toString();

    if (!isIdentifier(stringLiteral)) {
      throw new Error(`Invalid identifier: ${stringLiteral}`);
    }

    return {
      type: Tokens.TokenIdentifier,
      literal: stringLiteral,
    };
  }

  private async scanNumber() {
    const sb = new StringWriter();

    // Read the first char to skip sign if it exists
    const ch = await this.reader.peek(1);

    if (!ch) {
      throw new Error("Invalid number");
    }

    await sb.write(ch);
    await this.reader.readByte();

    while (true) {
      const ch = await this.reader.peek(1);

      if (!ch) {
        break;
      }

      const literal = String.fromCharCode(ch[0]);

      if (!isDigit(ch[0]) && literal !== ".") {
        break;
      }

      await sb.write(ch);
      await this.reader.readByte();
    }

    const stringLiteral = sb.toString();

    if (!isNumber(stringLiteral)) {
      throw new Error(`Invalid number: ${stringLiteral}`);
    }

    return {
      type: Tokens.TokenNumber,
      literal: stringLiteral,
    };
  }
}

export function isWhitespace(literal: string) {
  return literal.trim().length === 0;
}

// Checks if char code is a letter , underscore, pound sign, or @
export function isIdentifierStart(ch: number) {
  return isLetter(ch) || ch === 95 || ch === 35 || ch === 64;
}

// Checks if char code is a valid letter (a-z, A-Z)
export function isLetter(ch: number) {
  return (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122);
}

// Checks if char code is a valid number start (0-9, -)
function isNumberStart(ch: number) {
  return ch === 45 || isDigit(ch);
}

// Checks if char code is a digit (0-9)
function isDigit(ch: number) {
  return ch >= 48 && ch <= 57;
}

function isTextStart(literal: string) {
  return literal === "'" || literal === '"';
}

function isSignStart(literal: string) {
  return (
    literal === "=" ||
    literal === "!" ||
    literal === "<" ||
    literal === ">" ||
    literal === "?" ||
    literal === "~"
  );
}

function isJoinStart(literal: string) {
  return literal === "&" || literal === "|";
}

const identifierRegex = /^[\@\#_]?[\w\.\:]*\w+$/;

function isIdentifier(literal: string) {
  return identifierRegex.test(literal);
}

function isNumber(literal: string) {
  if (literal === "" || literal.endsWith(".")) {
    return false;
  }

  return !isNaN(parseFloat(literal));
}

class TextTokenError extends Error {
  constructor(message: string, public token: Token, options?: ErrorOptions) {
    super(message, options);
    this.name = "TestTokenError";
  }
}

function isSignOperator(stringLiteral: string) {
  return Object.values(SignOps).includes(stringLiteral as SignOps);
}
