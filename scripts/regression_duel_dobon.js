/**
 * 一騎打ち・ドボン回帰テスト（Trash/一騎打ち・ドボン_回帰テスト.md と同期）
 * 実行: node scripts/regression_duel_dobon.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const code = fs
  .readFileSync(path.join(ROOT, "js/filter.js"), "utf8")
  .replace("const FilterEngine", "globalThis.FilterEngine");
eval(code);

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mode_all.json"), "utf8"));
const pick = (...subs) => data.filter((p) => subs.every((s) => p.n.includes(s)));
const byName = (n) => data.filter((p) => p.n === n);

const DUEL_CASES = [
  { name: "全件", hits: data, count: 1264, lines: 604, duel: false },
  { name: "カラカラのみ", hits: byName("カラカラ"), count: 1, lines: 1, duel: false },
  {
    name: "カラカラ+両ガラガラ",
    hits: [...byName("カラカラ"), ...pick("ガラガラ")],
    count: 3,
    lines: 2,
    duel: true,
    display: ["カラカラ・ガラガラ", "ガラガラ（アローラのすがた）"],
  },
  {
    name: "両ガラガラのみ",
    hits: pick("ガラガラ"),
    count: 2,
    lines: 2,
    duel: true,
    display: ["ガラガラ", "ガラガラ（アローラのすがた）"],
  },
  { name: "タマタマのみ", hits: byName("タマタマ"), count: 1, lines: 1, duel: false },
  { name: "イーブイのみ", hits: byName("イーブイ"), count: 1, lines: 1, duel: false },
];

function checkDobon(prevCount, prevLines, count, lines, conditionsChanged, hasActive) {
  if (prevCount == null || prevLines == null) return false;
  if (!hasActive) return false;
  if (!conditionsChanged) return false;
  if (lines !== 0 && lines !== 1) return false;
  const statsChanged = prevCount !== count || prevLines !== lines;
  const countUnchanged = count >= prevCount;
  return countUnchanged || statsChanged;
}

const DOBON_CASES = [
  { prev: [null, null], cur: [100, 1], changed: true, active: true, expect: false },
  { prev: [50, 2], cur: [40, 1], changed: true, active: true, expect: true },
  { prev: [50, 1], cur: [50, 1], changed: true, active: true, expect: true },
  { prev: [50, 1], cur: [30, 1], changed: true, active: true, expect: true },
  { prev: [50, 1], cur: [50, 1], changed: false, active: true, expect: false },
  { prev: [50, 1], cur: [50, 2], changed: true, active: true, expect: false },
  { prev: [50, 1], cur: [50, 1], changed: true, active: false, expect: false },
];

let failed = 0;

for (const c of DUEL_CASES) {
  const r = FilterEngine.countResults(c.hits);
  const duel = FilterEngine.shouldDuel(r.lines);
  const ok = r.count === c.count && r.lines === c.lines && duel === c.duel;
  if (!ok) {
    console.error(`FAIL duel ${c.name}: got count=${r.count} lines=${r.lines} duel=${duel}`);
    failed++;
    continue;
  }
  if (c.display) {
    const g = FilterEngine.groupHitsForDisplay(c.hits).map((x) => x.join("・"));
    const displayOk =
      g.length === c.display.length && g.every((row, i) => row === c.display[i]);
    if (!displayOk) {
      console.error(`FAIL display ${c.name}: got ${JSON.stringify(g)}`);
      failed++;
      continue;
    }
  }
  console.log(`OK duel ${c.name}`);
}

for (const c of DOBON_CASES) {
  const got = checkDobon(
    c.prev[0],
    c.prev[1],
    c.cur[0],
    c.cur[1],
    c.changed,
    c.active
  );
  if (got !== c.expect) {
    console.error(`FAIL dobon prev=${c.prev} cur=${c.cur}: got ${got} expect ${c.expect}`);
    failed++;
  } else {
    console.log(`OK dobon prev=${c.prev} cur=${c.cur}`);
  }
}

const fire = FilterEngine.applyAll(data, [
  { kind: "type", op: "has", typeId: 10, excluded: false },
]);
const rf = FilterEngine.countResults(fire);
if (rf.count !== 103 || rf.lines !== 53 || FilterEngine.shouldDuel(rf.lines)) {
  console.error(`FAIL fire type: got count=${rf.count} lines=${rf.lines}`);
  failed++;
} else {
  console.log("OK fire type");
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll regression tests passed");
