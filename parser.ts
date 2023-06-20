import { JoinOps, Scanner, SignOps } from "./index.ts";
import { Token } from "./index.ts";
import { Joins, Tokens } from "./scanner.ts";

export type Expr = {
  left: Token;
  op: SignOps;
  right: Token;
};

export type ExprGroup = {
  join: JoinOps;
  item: Expr | ExprGroup[];
};

enum Steps {
  beforeSign = 1,
  sign,
  afterSign,
  join,
}

export async function parse(text: string): Promise<ExprGroup[]> {
  let res: ExprGroup[] = [];
  const scanner = new Scanner(text);

  let step = Steps.beforeSign;
  let join: JoinOps = Joins.and;

  let expr: Partial<Expr> = {};

  while (true) {
    const token = await scanner.scan();

    if (token.type === Tokens.TokenEOF) {
      break;
    }

    if (token.type === Tokens.TokenWS) {
      continue;
    }

    if (token.type === Tokens.TokenGroup) {
      const groupRes = await parse(token.literal);

      if (groupRes.length > 0) {
        res.push({
          join,
          item: groupRes,
        });
      }
      step = Steps.join;
      continue;
    }

    switch (step) {
      case Steps.beforeSign:
        if (
          token.type !== Tokens.TokenIdentifier &&
          token.type !== Tokens.TokenText &&
          token.type !== Tokens.TokenNumber
        ) {
          throw new Error(
            `Expected left operand (identifier, text or number) but got ${token.type}`
          );
        }
        expr.left = token;
        step = Steps.sign;
        break;
      case Steps.sign:
        if (token.type !== Tokens.TokenSign) {
          throw new Error(`Expected sign but got ${token.type}`);
        }
        expr.op = token.literal as SignOps;
        step = Steps.afterSign;
        break;

      case Steps.afterSign:
        if (
          token.type !== Tokens.TokenIdentifier &&
          token.type !== Tokens.TokenText &&
          token.type !== Tokens.TokenNumber
        ) {
          throw new Error(
            `Expected right operand (identifier, text or number) but got ${token.type}`
          );
        }
        expr.right = token;

        if (isFullExpr(expr)) {
          res.push({
            join,
            item: expr,
          });
        } else {
          throw new Error(
            `Invalid expression, missing one of the operands: ${JSON.stringify(
              expr
            )}`
          );
        }
        step = Steps.join;
        break;
      case Steps.join:
        if (token.type !== Tokens.TokenJoin) {
          throw new Error(`Expected join but got ${token.type}`);
        }

        join = Joins.and;

        if (token.literal === "||") {
          join = Joins.or;
        }

        step = Steps.beforeSign;
        expr = {};
        break;
    }
  }

  if (step !== Steps.join) {
    throw new Error(`Unexpected end of input`);
  }

  return res;
}

function isFullExpr(expr: Partial<Expr>): expr is Expr {
  return (
    typeof expr.left !== "undefined" &&
    typeof expr.op !== "undefined" &&
    typeof expr.right !== "undefined"
  );
}
