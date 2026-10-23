import { test } from "node:test";
import { strict as assert } from "node:assert";
import { hashMemberPassword, verifyMemberPassword } from "../lib/member-password";

test("member passwords are salted and only the correct password verifies", async () => {
  const first = await hashMemberPassword("a suitably long password");
  const second = await hashMemberPassword("a suitably long password");
  assert.notEqual(first, second);
  assert.equal(await verifyMemberPassword("a suitably long password", first), true);
  assert.equal(await verifyMemberPassword("a different long password", first), false);
  assert.equal(await verifyMemberPassword("a suitably long password", "invalid"), false);
});
