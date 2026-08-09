import { describe, expect, it } from "vitest";
import {
  signLocalSessionId,
  verifyLocalSessionCookie,
} from "./local-session-cookie";

const ID = "11111111-2222-4333-8444-555555555555";

describe("local session cookie signing", () => {
  it("round-trips a server-minted visitor id", () => {
    const cookie = signLocalSessionId(ID, "test-secret");
    expect(verifyLocalSessionCookie(cookie, "test-secret")).toBe(ID);
  });

  it("rejects id and signature tampering", () => {
    const cookie = signLocalSessionId(ID, "test-secret");
    const changedLastCharacter = cookie.endsWith("0") ? "1" : "0";
    expect(
      verifyLocalSessionCookie(
        cookie.replace("11111111", "aaaaaaaa"),
        "test-secret",
      ),
    ).toBeNull();
    expect(
      verifyLocalSessionCookie(
        `${cookie.slice(0, -1)}${changedLastCharacter}`,
        "test-secret",
      ),
    ).toBeNull();
  });

  it("rejects unsigned, malformed and wrong-secret cookies", () => {
    const cookie = signLocalSessionId(ID, "test-secret");
    expect(verifyLocalSessionCookie(ID, "test-secret")).toBeNull();
    expect(verifyLocalSessionCookie("not-a-cookie", "test-secret")).toBeNull();
    expect(verifyLocalSessionCookie(cookie, "wrong-secret")).toBeNull();
  });
});
