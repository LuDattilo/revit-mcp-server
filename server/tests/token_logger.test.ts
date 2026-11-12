import { describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("fs", () => fsMock);

const { logTokenUsage } = await import("../src/utils/tokenLogger.js");

describe("tokenLogger.logTokenUsage", () => {
  it("creates the log directory on import", () => {
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(expect.stringMatching(/logs$/), { recursive: true });
  });

  it("appends one JSON line with a chars/4 token estimate", () => {
    logTokenUsage("get_materials", "x".repeat(10), false);
    const [file, line] = fsMock.appendFileSync.mock.calls.at(-1)!;
    expect(file).toMatch(/token-usage\.jsonl$/);
    expect(line.endsWith("\n")).toBe(true);
    const entry = JSON.parse(line);
    expect(entry).toMatchObject({ toolName: "get_materials", responseChars: 10, estimatedTokens: 3, isError: false });
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it("never throws when the log cannot be written", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    fsMock.appendFileSync.mockImplementationOnce(() => {
      throw new Error("EACCES");
    });
    expect(() => logTokenUsage("t", "x", true)).not.toThrow();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
