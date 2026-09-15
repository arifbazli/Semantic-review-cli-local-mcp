import { describe, expect, it } from "vitest";
import { functionNameOverlap } from "../../src/search/lexical.js";

describe("functionNameOverlap", () => {
  it("scores full overlap when every query word appears in the camelCase-split name", () => {
    expect(functionNameOverlap("retrieve basket", "retrieveBasket")).toBe(1);
  });

  it("scores partial overlap when only some query words match", () => {
    expect(functionNameOverlap("fetch a shopping basket by id", "retrieveBasket")).toBeCloseTo(1 / 5, 6);
  });

  it("scores zero when no words overlap", () => {
    expect(functionNameOverlap("who validates a login", "retrieveBasket")).toBe(0);
  });

  it("splits snake_case and kebab-case names too", () => {
    expect(functionNameOverlap("resolve handler expression", "resolve_handler-expression")).toBe(1);
  });

  it("returns 0 for an empty query", () => {
    expect(functionNameOverlap("", "anything")).toBe(0);
  });
});
