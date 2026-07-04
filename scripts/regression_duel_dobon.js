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
  { name: "全件", hits: data, count: 1255, lines: 604, duel: false },
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

const bugEgg = FilterEngine.applyAll(data, [
  { kind: "egg", op: "is", eggId: 3, excluded: false },
]);
const re = FilterEngine.countResults(bugEgg);
if (re.count !== 99) {
  console.error(`FAIL bug egg: got count=${re.count}`);
  failed++;
} else {
  console.log("OK bug egg");
}

const singleType = FilterEngine.applyAll(data, [
  { kind: "type", op: "is_single", typeId: "single", excluded: false },
]);
const rs = FilterEngine.countResults(singleType);
if (rs.count !== 556) {
  console.error(`FAIL single type: got count=${rs.count}`);
  failed++;
} else {
  console.log("OK single type");
}

const namesOf = (...expected) => {
  const got = data.filter((p) => expected.includes(p.n)).map((p) => p.n);
  const ok =
    expected.length === got.length && expected.every((n) => got.includes(n));
  if (!ok) {
    console.error(`FAIL names expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`);
    failed++;
    return;
  }
  console.log(`OK names ${expected[0].slice(0, 4)}… (${expected.length})`);
};

namesOf("ゲッコウガ", "ゲッコウガ（サトシゲッコウガ）", "ゲッコウガ（メガゲッコウガ）");
namesOf(
  "ジガルデ（５０％フォルム）",
  "ジガルデ（パーフェクトフォルム）",
  "ジガルデ（１０％フォルム）",
  "ジガルデ（メガジガルデ）"
);
if (data.some((p) => p.i === 10116)) {
  console.error("FAIL greninja battle-bond pid 10116 should be excluded");
  failed++;
} else {
  console.log("OK exclude battle-bond greninja");
}

function assertNames(label, expected) {
  const got = data.filter((p) => expected.includes(p.n)).map((p) => p.n);
  const ok =
    expected.length === got.length && expected.every((n) => got.includes(n));
  if (!ok) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)} got ${JSON.stringify(got.sort())}`);
    failed++;
    return;
  }
  console.log(`OK ${label}`);
}

function assertAbsent(label, names) {
  const got = data.filter((p) => names.includes(p.n)).map((p) => p.n);
  if (got.length) {
    console.error(`FAIL ${label}: should be absent got ${JSON.stringify(got)}`);
    failed++;
    return;
  }
  console.log(`OK ${label}`);
}

// A区分統合（ピカチュウ除く）— フォルム差_表示調査.md A表
assertNames("A merge ウッウ", ["ウッウ"]);
assertAbsent("A merge ウッウ alt", ["ウッウ（うのみのすがた）", "ウッウ（まるのみのすがた）"]);
assertNames("A merge コライドン", ["コライドン"]);
assertAbsent("A merge コライドン alt", ["コライドン（せいげんけいたい）", "コライドン（しっそうけいたい）"]);
assertNames("A merge ザルード", ["ザルード"]);
assertAbsent("A merge ザルード alt", ["ザルード（とうちゃん）"]);
assertNames("A merge マギアナ default", ["マギアナ"]);
assertAbsent("A merge マギアナ alt", ["マギアナ（５００ねんまえのいろ）"]);
assertNames("A merge ミミッキュ", ["ミミッキュ"]);
assertAbsent("A merge ミミッキュ alt", ["ミミッキュ（ばれたすがた）", "ミミッキュ（ばけたすがた）"]);
assertNames("A merge ミライドン", ["ミライドン"]);
assertAbsent("A merge ミライドン alt", ["ミライドン（リミテッドモード）", "ミライドン（コンプリートモード）"]);
assertNames("A pikachu cosplay", [
  "ピカチュウ",
  "ピカチュウ（ハードロック・ピカチュウ）",
  "ピカチュウ（マダム・ピカチュウ）",
  "ピカチュウ（アイドル・ピカチュウ）",
  "ピカチュウ（ドクター・ピカチュウ）",
  "ピカチュウ（マスクド・ピカチュウ）",
  "ピカチュウ（おきがえピカチュウ）",
]);

// B-1 種族値差（全件）
assertNames("B-1 イダイトウ", ["イダイトウ（オスのすがた）", "イダイトウ（メスのすがた）"]);
assertNames("B-1 イルカマン", ["イルカマン（ナイーブフォルム）", "イルカマン（マイティフォルム）"]);
assertNames("B-1 ギルガルド", ["ギルガルド（シールドフォルム）", "ギルガルド（ブレードフォルム）"]);
assertNames("B-1 コオリッポ", ["コオリッポ（アイスフェイス）", "コオリッポ（ナイスフェイス）"]);
assertNames("B-1 バケッチャ", [
  "バケッチャ（ふつうのサイズ）",
  "バケッチャ（ちいさいサイズ）",
  "バケッチャ（おおきいサイズ）",
  "バケッチャ（とくだいサイズ）",
]);
assertNames("B-1 パンプジン", [
  "パンプジン（ふつうのサイズ）",
  "パンプジン（ちいさいサイズ）",
  "パンプジン（おおきいサイズ）",
  "パンプジン（とくだいサイズ）",
]);
assertNames("B-1 メテノ core", ["メテノ（りゅうせいのすがた）", "メテノ（あかいろのコア）"]);
assertNames("B-1 ヨワシ", ["ヨワシ（たんどくのすがた）", "ヨワシ（むれたすがた）"]);

// B-2 タイプ差（全件）
assertNames("B-2 オドリドリ", [
  "オドリドリ（めらめらスタイル）",
  "オドリドリ（ぱちぱちスタイル）",
  "オドリドリ（ふらふらスタイル）",
  "オドリドリ（まいまいスタイル）",
]);
assertNames("B-2 ポワルン", [
  "ポワルン",
  "ポワルン（たいようのすがた）",
  "ポワルン（あまみずのすがた）",
  "ポワルン（ゆきぐものすがた）",
]);

// B-3 特性差（全件）
assertNames("B-3 イキリンコ", ["イキリンコ（グリーンフェザー）", "イキリンコ（イエローフェザー）"]);
assertNames("B-3 バスラオ", ["バスラオ（あかすじのすがた）", "バスラオ（あおすじのすがた）"]);

// B-5 複合差（代表）
assertNames("B-5 フシギバナ mega", ["フシギバナ", "フシギバナ（メガフシギバナ）"]);
assertNames("B-5 ガラガラ alola", ["ガラガラ", "ガラガラ（アローラのすがた）"]);
assertNames("B-5 ウインディ hisui", ["ウインディ", "ウインディ（ヒスイのすがた）"]);
assertNames("B-5 テラパゴス", [
  "テラパゴス（ノーマルフォルム）",
  "テラパゴス（テラスタルフォルム）",
  "テラパゴス（ステラフォルム）",
]);
assertNames("B-5 リザードン mega", [
  "リザードン",
  "リザードン（メガリザードンＸ）",
  "リザードン（メガリザードンＹ）",
]);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll regression tests passed");
