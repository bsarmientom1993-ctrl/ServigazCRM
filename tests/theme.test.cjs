const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { themeBootstrap } = require("../src/lib/theme.ts");
function bootstrap(saved, systemDark, blocked = false) {
  const root = { dataset: {}, style: {}, classList: { toggle(name, active) { root.dark = active; } } };
  vm.runInNewContext(themeBootstrap, {
    document: { documentElement: root },
    window: { matchMedia: () => ({ matches: systemDark }) },
    localStorage: { getItem: () => { if (blocked) throw new Error("Storage blocked"); return saved; } },
  });
  return root;
}
test("theme applies a saved dark preference before hydration", () => {
  const root = bootstrap("dark", false);
  assert.equal(root.dark, true); assert.equal(root.dataset.theme, "dark"); assert.equal(root.style.colorScheme, "dark");
});
test("an explicit light preference overrides the operating system", () => {
  assert.equal(bootstrap("light", true).dataset.theme, "light");
});
test("new visitors follow the operating system", () => {
  assert.equal(bootstrap(null, true).dataset.theme, "dark");
  assert.equal(bootstrap(null, false).dataset.theme, "light");
});
test("blocked storage or invalid values do not prevent rendering", () => {
  assert.equal(bootstrap(null, true, true).dataset.theme, "dark");
  assert.equal(bootstrap("unknown", false).dataset.theme, "light");
});
