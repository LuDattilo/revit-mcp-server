import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorMessage } from "../src/utils/errorUtils.js";
import { addSuggestions, suggestIf } from "../src/utils/suggestions.js";
import { compactResponse } from "../src/utils/responseCompactor.js";
import { toolResponse, toolError, rawToolResponse, rawToolError } from "../src/utils/compactTool.js";
import { logTokenUsage } from "../src/utils/tokenLogger.js";

vi.mock("../src/utils/tokenLogger.js", () => ({ logTokenUsage: vi.fn() }));

beforeEach(() => {
  vi.mocked(logTokenUsage).mockClear();
});

describe("errorUtils.errorMessage", () => {
  it("uses Error.message and stringifies anything else", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage(new TypeError("typed"))).toBe("typed");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(undefined)).toBe("undefined");
    expect(errorMessage(null)).toBe("null");
  });
});

describe("suggestions", () => {
  it("suggestIf returns a step only when the condition holds", () => {
    expect(suggestIf(true, "p", "r")).toEqual({ prompt: "p", reason: "r" });
    expect(suggestIf(false, "p", "r")).toBeNull();
  });

  it("addSuggestions appends non-null steps and leaves the response alone otherwise", () => {
    const base = { a: 1 };
    expect(addSuggestions(base, [null, null])).toBe(base);
    expect(addSuggestions(base, [suggestIf(true, "p", "r"), null])).toEqual({
      a: 1,
      suggestedNextSteps: [{ prompt: "p", reason: "r" }],
    });
    expect(base).toEqual({ a: 1 }); // not mutated
  });
});

describe("responseCompactor.compactResponse", () => {
  it("strips null, undefined, empty strings and empty arrays but keeps 0 and false", () => {
    expect(
      compactResponse({ a: null, b: undefined, c: "", d: [], e: 0, f: false, g: "x", h: { i: null, j: 1 } })
    ).toEqual({ e: 0, f: false, g: "x", h: { j: 1 } });
  });

  it("drops objects that become empty after stripping", () => {
    expect(compactResponse({ a: { b: null }, c: 1 })).toEqual({ c: 1 });
    expect(compactResponse({ a: null })).toBeUndefined();
    expect(compactResponse(null)).toBeUndefined();
  });

  it("can leave nulls in place", () => {
    expect(compactResponse({ a: null }, { stripNulls: false })).toEqual({ a: null });
  });

  it("truncates long object arrays and records the original count", () => {
    const items = Array.from({ length: 150 }, (_, i) => ({ id: i }));
    const out = compactResponse({ elements: items }, { maxArrayItems: 100 });
    expect(out.elements).toHaveLength(100);
    expect(out._truncated).toBe(true);
    expect(out._totalCount_elements).toBe(150);
  });

  it("does not truncate short primitive arrays", () => {
    const ids = Array.from({ length: 19 }, (_, i) => i);
    expect(compactResponse({ ids }, { maxArrayItems: 5 }).ids).toHaveLength(19);
  });

  it("compact mode replaces large object arrays with a count summary", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: i }));
    const out = compactResponse({ elements: items, few: [{ a: 1 }], tags: ["a", "b", "c", "d", "e", "f"] }, { compact: true });
    expect(out.elements).toBe("7 items");
    expect(out.elementsCount).toBe(7);
    expect(out.few).toEqual([{ a: 1 }]);
    expect(out.tags).toHaveLength(6);
  });
});

describe("compactTool response helpers", () => {
  it("toolResponse returns compacted JSON text and logs token usage", () => {
    const r = toolResponse("t", { a: 1, b: null });
    expect(r).toEqual({ content: [{ type: "text", text: '{"a":1}' }] });
    expect(logTokenUsage).toHaveBeenCalledWith("t", '{"a":1}', false);
  });

  it("toolResponse honours compact", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i }));
    const r = toolResponse("t", { items }, { compact: true });
    expect(JSON.parse(r.content[0].text)).toEqual({ items: "6 items", itemsCount: 6 });
  });

  it.each([
    ["null", null, "null"],
    ["undefined", undefined, "null"],
    ["{}", {}, "{}"],
    ["all-empty object", { a: null, b: "" }, '{"a":null,"b":""}'],
  ])("toolResponse always returns string text, even for %s", (_label, value, expected) => {
    const r = toolResponse("t", value);
    expect(r.content[0].text).toBe(expected);
  });

  it("rawToolResponse serialises verbatim (no compaction), undefined as null", () => {
    expect(rawToolResponse("t", { a: null }).content[0].text).toBe('{"a":null}');
    expect(rawToolResponse("t", undefined).content[0].text).toBe("null");
    expect(logTokenUsage).toHaveBeenCalledWith("t", "null", false);
  });

  it("toolError / rawToolError return isError results and log them as errors", () => {
    expect(toolError("t", "bad")).toEqual({ content: [{ type: "text", text: "bad" }], isError: true });
    expect(rawToolError("t", "worse")).toEqual({ content: [{ type: "text", text: "worse" }], isError: true });
    expect(logTokenUsage).toHaveBeenCalledWith("t", "bad", true);
    expect(logTokenUsage).toHaveBeenCalledWith("t", "worse", true);
  });
});
