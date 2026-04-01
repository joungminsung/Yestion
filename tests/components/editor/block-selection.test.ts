import { describe, it, expect } from "vitest";
import { selectBlockRangePositions } from "@/components/editor/extensions/block-selection";

describe("selectBlockRangePositions", () => {
  it("returns positions between fromPos and toPos inclusive", () => {
    const blockOffsets = [0, 10, 20, 30];
    const result = selectBlockRangePositions(blockOffsets, 10, 30);
    expect(result).toEqual([10, 20, 30]);
  });

  it("handles reversed range (toPos < fromPos)", () => {
    const blockOffsets = [0, 10, 20, 30];
    const result = selectBlockRangePositions(blockOffsets, 30, 10);
    expect(result).toEqual([10, 20, 30]);
  });

  it("returns single block when from === to", () => {
    const blockOffsets = [0, 10, 20];
    const result = selectBlockRangePositions(blockOffsets, 10, 10);
    expect(result).toEqual([10]);
  });

  it("returns empty when no offsets in range", () => {
    const blockOffsets = [0, 10, 20, 30];
    const result = selectBlockRangePositions(blockOffsets, 15, 18);
    expect(result).toEqual([]);
  });
});
