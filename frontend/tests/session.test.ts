import { expect, it } from "vitest";
import { IS_DEMO, SESSION_KEYS } from "@/config/runtime";
import { login } from "@/services/auth";
import { clearSession, get } from "@/services/api";

it("isolates demo sessions from real-backend credentials", async () => {
  expect(IS_DEMO).toBe(true);
  localStorage.setItem("crimenet_access_token", "production-session");
  const result = await login({
    badge_id: "admin@crimenet.gov.in",
    password: "Admin@123",
  });
  expect(result.access_token).toBe("demo-access-admin");
  expect(localStorage.getItem(SESSION_KEYS.access)).toBe("demo-access-admin");
  expect(localStorage.getItem("crimenet_access_token")).toBe(
    "production-session",
  );
  expect(await get<{ status: string }>("/health")).toMatchObject({
    status: "demo",
  });
  clearSession();
  expect(localStorage.getItem(SESSION_KEYS.access)).toBeNull();
  expect(localStorage.getItem("crimenet_access_token")).toBe(
    "production-session",
  );
});
