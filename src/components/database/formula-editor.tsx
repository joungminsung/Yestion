"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { DatabaseData, PropertyConfig } from "@/types/database";

type FormulaEditorProps = {
  formula: string;
  properties: DatabaseData["properties"];
  config: PropertyConfig;
  onChange: (formula: string) => void;
  /** Sample row values for preview */
  sampleValues?: Record<string, unknown>;
};

const FORMULA_FUNCTIONS = [
  { name: "prop", signature: 'prop("name")', description: "Reference a property value" },
  { name: "if", signature: "if(cond, true, false)", description: "Conditional expression" },
  { name: "add", signature: "add(a, b)", description: "Add two numbers" },
  { name: "subtract", signature: "subtract(a, b)", description: "Subtract b from a" },
  { name: "multiply", signature: "multiply(a, b)", description: "Multiply two numbers" },
  { name: "divide", signature: "divide(a, b)", description: "Divide a by b" },
  { name: "now", signature: "now()", description: "Current date and time" },
  { name: "length", signature: "length(text)", description: "Length of text" },
  { name: "contains", signature: "contains(text, search)", description: "Check if text contains search" },
  { name: "lower", signature: "lower(text)", description: "Convert to lowercase" },
  { name: "upper", signature: "upper(text)", description: "Convert to uppercase" },
  { name: "round", signature: "round(number)", description: "Round to nearest integer" },
  { name: "ceil", signature: "ceil(number)", description: "Round up" },
  { name: "floor", signature: "floor(number)", description: "Round down" },
  { name: "dateAdd", signature: "dateAdd(date, num, unit)", description: "Add to date" },
  { name: "dateBetween", signature: "dateBetween(date1, date2, unit)", description: "Difference between dates" },
  { name: "formatDate", signature: "formatDate(date, format)", description: "Format a date" },
  { name: "and", signature: "and(a, b)", description: "Logical AND" },
  { name: "or", signature: "or(a, b)", description: "Logical OR" },
  { name: "not", signature: "not(value)", description: "Logical NOT" },
  { name: "empty", signature: "empty(value)", description: "Check if empty" },
  { name: "sum", signature: "sum(values...)", description: "Sum of values" },
  { name: "average", signature: "average(values...)", description: "Average of values" },
  { name: "min", signature: "min(values...)", description: "Minimum value" },
  { name: "max", signature: "max(values...)", description: "Maximum value" },
  { name: "count", signature: "count(values...)", description: "Count of values" },
];

const FUNCTION_NAMES = FORMULA_FUNCTIONS.map((f) => f.name);

/** Basic formula syntax validation */
function validateFormula(formula: string): { valid: boolean; error?: string; errorStart?: number; errorEnd?: number } {
  if (!formula.trim()) return { valid: true };

  // Check balanced parentheses
  let depth = 0;
  for (let i = 0; i < formula.length; i++) {
    if (formula[i] === "(") depth++;
    if (formula[i] === ")") depth--;
    if (depth < 0) return { valid: false, error: "Unexpected closing parenthesis", errorStart: i, errorEnd: i + 1 };
  }
  if (depth > 0) return { valid: false, error: "Missing closing parenthesis", errorStart: formula.length - 1, errorEnd: formula.length };

  // Check balanced quotes
  let inString = false;
  for (let i = 0; i < formula.length; i++) {
    if (formula[i] === '"' && (i === 0 || formula[i - 1] !== "\\")) {
      inString = !inString;
    }
  }
  if (inString) return { valid: false, error: "Unterminated string", errorStart: formula.lastIndexOf('"'), errorEnd: formula.length };

  // Check for known function names
  const funcCallPattern = /([a-zA-Z_]\w*)\s*\(/g;
  let match;
  while ((match = funcCallPattern.exec(formula)) !== null) {
    const fnName = match[1]!;
    if (!FUNCTION_NAMES.includes(fnName)) {
      return {
        valid: false,
        error: `Unknown function: ${fnName}`,
        errorStart: match.index,
        errorEnd: match.index + fnName.length,
      };
    }
  }

  return { valid: true };
}

/** Safe arithmetic evaluator: only handles +, -, *, /, (), and numbers */
function safeEvalArithmetic(expr: string): number | null {
  let pos = 0;
  const input = expr.replace(/\s+/g, "");

  function parseExpression(): number {
    let left = parseTerm();
    while (pos < input.length && (input[pos] === "+" || input[pos] === "-")) {
      const op = input[pos]!;
      pos++;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < input.length && (input[pos] === "*" || input[pos] === "/")) {
      const op = input[pos]!;
      pos++;
      const right = parseFactor();
      if (op === "/" && right === 0) throw new Error("Division by zero");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    if (input[pos] === "-") {
      pos++;
      return -parseFactor();
    }
    if (input[pos] === "(") {
      pos++;
      const val = parseExpression();
      if (input[pos] === ")") pos++;
      return val;
    }
    const start = pos;
    while (pos < input.length && ((input[pos]! >= "0" && input[pos]! <= "9") || input[pos] === ".")) {
      pos++;
    }
    if (pos === start) throw new Error("Unexpected token");
    return parseFloat(input.slice(start, pos));
  }

  try {
    const result = parseExpression();
    if (pos !== input.length) return null;
    return result;
  } catch {
    return null;
  }
}

/** Evaluate formula for preview (simplified) */
function evaluateFormula(
  formula: string,
  properties: DatabaseData["properties"],
  sampleValues: Record<string, unknown>,
): string {
  if (!formula.trim()) return "";

  try {
    // Very simple evaluator for prop() references and basic math
    let expr = formula;

    // Replace prop("name") with actual values
    expr = expr.replace(/prop\("([^"]+)"\)/g, (_match, propName: string) => {
      const prop = properties.find((p) => p.name === propName);
      if (!prop) return "undefined";
      const val = sampleValues[prop.id];
      if (val === undefined || val === null) return "null";
      if (typeof val === "string") return `"${val}"`;
      return String(val);
    });

    // Replace now() with current date
    expr = expr.replace(/now\(\)/g, `"${new Date().toISOString()}"`);

    // Try simple math evaluation for basic expressions
    // Only evaluate if it looks like a simple numeric expression
    if (/^[\d\s+\-*/().]+$/.test(expr)) {
      const result = safeEvalArithmetic(expr);
      if (result !== null) return String(result);
    }

    // For function calls, provide a simplified preview
    if (expr.includes("(")) {
      return "(formula)";
    }

    return expr.replace(/"/g, "");
  } catch {
    return "(error)";
  }
}

export function FormulaEditor({
  formula,
  properties,
  onChange,
  sampleValues = {},
}: FormulaEditorProps) {
  const [value, setValue] = useState(formula);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<
    { label: string; insert: string; description?: string }[]
  >([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setCursorWord] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const validation = useMemo(() => validateFormula(value), [value]);
  const preview = useMemo(
    () => evaluateFormula(value, properties, sampleValues),
    [value, properties, sampleValues],
  );

  const updateAutocomplete = useCallback(
    (text: string, cursorPos: number) => {
      // Extract word at cursor
      const before = text.slice(0, cursorPos);
      const wordMatch = before.match(/([a-zA-Z_]\w*)$/);
      const word = wordMatch ? wordMatch[1]! : "";
      setCursorWord(word);

      if (!word || word.length < 1) {
        setShowAutocomplete(false);
        return;
      }

      const items: { label: string; insert: string; description?: string }[] = [];

      // Check if we're inside prop("")
      const propMatch = before.match(/prop\("([^"]*)$/);
      if (propMatch) {
        const search = propMatch[1]!.toLowerCase();
        properties.forEach((p) => {
          if (p.name.toLowerCase().includes(search)) {
            items.push({
              label: p.name,
              insert: `${p.name}")`,
              description: p.type,
            });
          }
        });
      } else {
        // Function names
        const lower = word.toLowerCase();
        FORMULA_FUNCTIONS.forEach((fn) => {
          if (fn.name.toLowerCase().startsWith(lower)) {
            items.push({
              label: fn.name,
              insert: fn.name === "now" ? "now()" : `${fn.name}(`,
              description: fn.description,
            });
          }
        });

        // Property names (as prop() shortcut)
        properties.forEach((p) => {
          if (p.name.toLowerCase().startsWith(lower)) {
            items.push({
              label: `prop("${p.name}")`,
              insert: `prop("${p.name}")`,
              description: `Property: ${p.type}`,
            });
          }
        });
      }

      if (items.length > 0) {
        setAutocompleteItems(items);
        setSelectedIndex(0);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    },
    [properties],
  );

  const handleInsertAutocomplete = useCallback(
    (item: { insert: string }) => {
      const textarea = inputRef.current;
      if (!textarea) return;

      const pos = textarea.selectionStart;
      const before = value.slice(0, pos);
      const after = value.slice(pos);

      // Find the start of the word we're completing
      const propMatch = before.match(/prop\("([^"]*)$/);
      let replaceStart: number;
      if (propMatch) {
        replaceStart = pos - propMatch[1]!.length;
      } else {
        const wordMatch = before.match(/([a-zA-Z_]\w*)$/);
        replaceStart = wordMatch ? pos - wordMatch[1]!.length : pos;
      }

      const newValue = value.slice(0, replaceStart) + item.insert + after;
      setValue(newValue);
      onChange(newValue);
      setShowAutocomplete(false);

      // Restore cursor position
      const newPos = replaceStart + item.insert.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showAutocomplete) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, autocompleteItems.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const item = autocompleteItems[selectedIndex];
          if (item) handleInsertAutocomplete(item);
          return;
        }
        if (e.key === "Escape") {
          setShowAutocomplete(false);
          return;
        }
      }
    },
    [showAutocomplete, autocompleteItems, selectedIndex, handleInsertAutocomplete],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      setValue(newVal);
      onChange(newVal);
      updateAutocomplete(newVal, e.target.selectionStart);
    },
    [onChange, updateAutocomplete],
  );

  // Close autocomplete on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Formula
      </label>

      <div className="relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder='e.g. add(prop("Price"), prop("Tax"))'
          rows={3}
          className="w-full resize-none rounded border px-2 py-1.5 font-mono text-sm outline-none focus:ring-1 focus:ring-[#2383e2]"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: validation.valid ? "var(--border-default)" : "#e03e3e",
            color: "var(--text-primary)",
          }}
          spellCheck={false}
        />

        {/* Error underline indicator */}
        {!validation.valid && validation.error && (
          <div
            className="mt-0.5 text-xs"
            style={{ color: "#e03e3e" }}
          >
            {validation.error}
          </div>
        )}

        {/* Autocomplete dropdown */}
        {showAutocomplete && autocompleteItems.length > 0 && (
          <div
            ref={autocompleteRef}
            className="absolute left-0 top-full z-50 mt-1 max-h-[200px] w-full overflow-y-auto rounded-md border shadow-lg"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-default)",
            }}
          >
            {autocompleteItems.map((item, i) => (
              <button
                key={`${item.label}-${i}`}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm transition-colors"
                style={{
                  backgroundColor:
                    i === selectedIndex
                      ? "var(--bg-hover)"
                      : "transparent",
                  color: "var(--text-primary)",
                }}
                onClick={() => handleInsertAutocomplete(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="font-mono text-xs">{item.label}</span>
                {item.description && (
                  <span
                    className="shrink-0 text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {value.trim() && (
        <div
          className="rounded border px-2 py-1.5 text-xs"
          style={{
            backgroundColor: "var(--bg-secondary, #f7f6f3)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="font-medium">Preview: </span>
          <span style={{ color: "var(--text-primary)" }}>{preview}</span>
        </div>
      )}

      {/* Quick function reference */}
      <details className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        <summary className="cursor-pointer hover:underline">
          Available functions ({FORMULA_FUNCTIONS.length})
        </summary>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {FORMULA_FUNCTIONS.map((fn) => (
            <div
              key={fn.name}
              className="rounded px-1 py-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="font-mono">{fn.name}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
