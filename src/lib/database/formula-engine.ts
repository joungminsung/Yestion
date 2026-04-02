// src/lib/database/formula-engine.ts

type FormulaValue = string | number | boolean | Date | null;
type PropertyGetter = (name: string) => FormulaValue;

class FormulaEngine {
  private pos = 0;
  private input = "";
  private getProp: PropertyGetter;

  constructor(getProp: PropertyGetter) {
    this.getProp = getProp;
  }

  evaluate(formula: string): FormulaValue {
    this.input = formula.trim();
    this.pos = 0;
    if (!this.input) return null;
    try {
      const result = this.parseExpression();
      return result;
    } catch {
      return null;
    }
  }

  private parseExpression(): FormulaValue {
    let left = this.parseTerm();
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const ch = this.input[this.pos];
      if (ch === "+" || ch === "-") {
        this.pos++;
        const right = this.parseTerm();
        if (typeof left === "number" && typeof right === "number") {
          left = ch === "+" ? left + right : left - right;
        } else {
          left = String(left ?? "") + String(right ?? "");
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): FormulaValue {
    let left = this.parseFactor();
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const ch = this.input[this.pos];
      if (ch === "*" || ch === "/") {
        this.pos++;
        const right = this.parseFactor();
        const l = Number(left);
        const r = Number(right);
        if (ch === "*") left = l * r;
        else left = r === 0 ? null : l / r;
      } else {
        break;
      }
    }
    return left;
  }

  private parseFactor(): FormulaValue {
    this.skipWhitespace();
    const ch = this.input[this.pos];

    if (ch === "-") {
      this.pos++;
      const val = this.parseFactor();
      return -(Number(val));
    }

    if (ch === "(") {
      this.pos++;
      const val = this.parseExpression();
      this.skipWhitespace();
      if (this.input[this.pos] === ")") this.pos++;
      return val;
    }

    if (ch === '"') return this.parseString();

    if (ch !== undefined && ((ch >= "0" && ch <= "9") || ch === ".")) {
      return this.parseNumber();
    }

    if (ch !== undefined && /[a-zA-Z_]/.test(ch)) {
      return this.parseFunctionOrIdent();
    }

    return null;
  }

  private parseString(): string {
    this.pos++; // skip opening "
    let str = "";
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === "\\" && this.pos + 1 < this.input.length) {
        this.pos++;
      }
      str += this.input[this.pos];
      this.pos++;
    }
    this.pos++; // skip closing "
    return str;
  }

  private parseNumber(): number {
    const start = this.pos;
    while (this.pos < this.input.length && /[\d.]/.test(this.input[this.pos]!)) {
      this.pos++;
    }
    return parseFloat(this.input.slice(start, this.pos));
  }

  private parseFunctionOrIdent(): FormulaValue {
    const start = this.pos;
    while (this.pos < this.input.length && /[a-zA-Z_\d]/.test(this.input[this.pos]!)) {
      this.pos++;
    }
    const name = this.input.slice(start, this.pos);
    this.skipWhitespace();

    // Check for true/false literals
    if (name === "true") return true;
    if (name === "false") return false;

    if (this.input[this.pos] !== "(") return null;
    this.pos++; // skip (

    const args = this.parseArgs();
    this.skipWhitespace();
    if (this.input[this.pos] === ")") this.pos++;

    return this.callFunction(name, args);
  }

  private parseArgs(): FormulaValue[] {
    const args: FormulaValue[] = [];
    this.skipWhitespace();
    if (this.input[this.pos] === ")") return args;

    args.push(this.parseExpression());
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.input[this.pos] !== ",") break;
      this.pos++;
      args.push(this.parseExpression());
    }
    return args;
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos]!)) {
      this.pos++;
    }
  }

  private callFunction(name: string, args: FormulaValue[]): FormulaValue {
    switch (name) {
      case "prop":
        return this.getProp(String(args[0] ?? ""));

      case "if":
        return args[0] ? args[1] ?? null : args[2] ?? null;

      case "add":
        return Number(args[0] ?? 0) + Number(args[1] ?? 0);

      case "subtract":
        return Number(args[0] ?? 0) - Number(args[1] ?? 0);

      case "multiply":
        return Number(args[0] ?? 0) * Number(args[1] ?? 0);

      case "divide": {
        const divisor = Number(args[1] ?? 0);
        return divisor === 0 ? null : Number(args[0] ?? 0) / divisor;
      }

      case "now":
        return new Date();

      case "length":
        return String(args[0] ?? "").length;

      case "contains":
        return String(args[0] ?? "").includes(String(args[1] ?? ""));

      case "lower":
        return String(args[0] ?? "").toLowerCase();

      case "upper":
        return String(args[0] ?? "").toUpperCase();

      case "round":
        return Math.round(Number(args[0] ?? 0));

      case "ceil":
        return Math.ceil(Number(args[0] ?? 0));

      case "floor":
        return Math.floor(Number(args[0] ?? 0));

      case "dateAdd": {
        const date = new Date(args[0] as string | number | Date);
        const num = Number(args[1] ?? 0);
        const unit = String(args[2] ?? "days");
        const ms = unit === "years" ? num * 365.25 * 86400000
          : unit === "months" ? num * 30 * 86400000
          : unit === "weeks" ? num * 7 * 86400000
          : unit === "hours" ? num * 3600000
          : unit === "minutes" ? num * 60000
          : num * 86400000;
        return new Date(date.getTime() + ms);
      }

      case "dateBetween": {
        const d1 = new Date(args[0] as string | number | Date);
        const d2 = new Date(args[1] as string | number | Date);
        const u = String(args[2] ?? "days");
        const diffMs = d1.getTime() - d2.getTime();
        if (u === "years") return Math.floor(diffMs / (365.25 * 86400000));
        if (u === "months") return Math.floor(diffMs / (30 * 86400000));
        if (u === "weeks") return Math.floor(diffMs / (7 * 86400000));
        if (u === "hours") return Math.floor(diffMs / 3600000);
        if (u === "minutes") return Math.floor(diffMs / 60000);
        return Math.floor(diffMs / 86400000);
      }

      case "formatDate": {
        const d = new Date(args[0] as string | number | Date);
        const fmt = String(args[1] ?? "YYYY-MM-DD");
        return fmt
          .replace("YYYY", String(d.getFullYear()))
          .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
          .replace("DD", String(d.getDate()).padStart(2, "0"));
      }

      case "and":
        return Boolean(args[0]) && Boolean(args[1]);

      case "or":
        return Boolean(args[0]) || Boolean(args[1]);

      case "not":
        return !args[0];

      case "empty":
        return args[0] === null || args[0] === undefined || args[0] === "";

      case "sum":
        return args.reduce((acc, v) => Number(acc) + Number(v ?? 0), 0 as FormulaValue) as number;

      case "average": {
        const nums = args.filter((v) => v !== null && v !== undefined);
        if (nums.length === 0) return 0;
        const total = nums.reduce((a, v) => Number(a) + Number(v), 0);
        return Number(total) / nums.length;
      }

      case "min":
        return Math.min(...args.map((v) => Number(v ?? Infinity)));

      case "max":
        return Math.max(...args.map((v) => Number(v ?? -Infinity)));

      case "count":
        return args.filter((v) => v !== null && v !== undefined && v !== "").length;

      default:
        return null;
    }
  }
}

export function evaluateFormula(
  formula: string,
  getProperty: (name: string) => FormulaValue
): FormulaValue {
  const engine = new FormulaEngine(getProperty);
  return engine.evaluate(formula);
}

export function formatFormulaResult(value: FormulaValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}
