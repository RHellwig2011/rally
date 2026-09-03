/**
 * @jest-environment node
 */

import { ACCESS_TOKEN_MAX_AGE_SEC } from "@/lib/auth";

describe("access token lifetime", () => {
  it("is 15 minutes so a stolen sessionToken is not a 30-day key", () => {
    expect(ACCESS_TOKEN_MAX_AGE_SEC).toBe(15 * 60);
  });
});
