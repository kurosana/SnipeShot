/**
 * タイプ相性回帰テスト（Trash/一騎打ち・ドボン_回帰テスト.md と同期）
 * 実行: node scripts/regression_type_efficacy.js
 *
 * 期待値は Bulbapedia Type chart（現行）に基づく攻撃タイプ→防御タイプの倍率積。
 * 特性（ふゆう等）はアプリ仕様どおり無視する。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const code = fs
  .readFileSync(path.join(ROOT, "js/filter.js"), "utf8")
  .replace("const FilterEngine", "globalThis.FilterEngine");
eval(code);

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/mode_all.json"), "utf8"));
const chart = JSON.parse(fs.readFileSync(path.join(ROOT, "data/type_efficacy.json"), "utf8"));
DataStore = { typeEfficacy: chart };

const TYPE = {
  1: "ノーマル",
  2: "かくとう",
  3: "ひこう",
  4: "どく",
  5: "じめん",
  6: "いわ",
  7: "むし",
  8: "ゴースト",
  9: "はがね",
  10: "ほのお",
  11: "みず",
  12: "くさ",
  13: "でんき",
  14: "エスパー",
  15: "こおり",
  16: "ドラゴン",
  17: "あく",
  18: "フェアリー",
};

function byId(pid) {
  const p = data.find((e) => e.i === pid);
  if (!p) throw new Error(`pid ${pid} not in mode_all`);
  return p;
}

function expectedMult(atk, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    m *= chart[String(atk)][String(d)];
  }
  return m;
}

/** Bulbapedia 現行チャートのスポット確認（攻撃→防御単タイプ） */
const CHART_SPOTS = [
  [2, 1, 2], // Fighting > Normal
  [8, 1, 0], // Ghost > Normal
  [5, 3, 0], // Ground > Flying
  [13, 5, 0], // Electric > Ground
  [12, 11, 2], // Grass > Water
  [12, 5, 2], // Grass > Ground
  [5, 13, 2], // Ground > Electric
  [5, 10, 2], // Ground > Fire
  [18, 16, 2], // Fairy > Dragon
  [16, 18, 0], // Dragon > Fairy
];

let failed = 0;

for (const [atk, def, exp] of CHART_SPOTS) {
  const got = chart[String(atk)][String(def)];
  if (got !== exp) {
    console.error(`FAIL chart ${TYPE[atk]}→${TYPE[def]}: got ${got} expect ${exp}`);
    failed++;
  }
}
console.log(`OK chart spot checks (${CHART_SPOTS.length})`);

/** 単タイプ 18 匹（各タイプ1） */
const MONO = [
  [143, 1, "カビゴン"],
  [68, 2, "カイリキー"],
  [821, 3, "ココガラ"],
  [24, 4, "アーボック"],
  [50, 5, "ディグダ"],
  [377, 6, "レジロック"],
  [127, 7, "カイロス"],
  [200, 8, "ムウマ"],
  [379, 9, "レジスチル"],
  [136, 10, "ブースター"],
  [9, 11, "カメックス"],
  [114, 12, "モンジャラ"],
  [25, 13, "ピカチュウ"],
  [65, 14, "フーディン"],
  [361, 15, "ユキワラシ"],
  [147, 16, "ミニリュウ"],
  [197, 17, "ブラッキー"],
  [36, 18, "ピクシー"],
];

/** 複合タイプ（18タイプを防御側でカバー） */
const DUAL = [
  [18, [1, 3], "ピジョット"], // ノーマル/ひこう
  [448, [2, 9], "ルカリオ"], // かくとう/はがね
  [6, [10, 3], "リザードン"], // ほのお/ひこう
  [3, [12, 4], "フシギバナ"], // くさ/どく
  [260, [11, 5], "ラグラージ"], // みず/じめん
  [248, [6, 17], "バンギラス"], // いわ/あく
  [212, [7, 9], "ハッサム"], // むし/はがね
  [94, [8, 4], "ゲンガー"], // ゴースト/どく
  [10008, [13, 10], "ヒートロトム"], // でんき/ほのお
  [282, [14, 18], "サーナイト"], // エスパー/フェアリー
  [460, [12, 15], "ユキノオー"], // くさ/こおり
  [149, [16, 3], "カイリュー"], // ドラゴン/ひこう
  [130, [11, 3], "ギャラドス"], // みず/ひこう
];

function assertPokemonChart(pid, expectTypes, label) {
  const p = byId(pid);
  if (JSON.stringify(p.t) !== JSON.stringify(expectTypes)) {
    console.error(`FAIL ${label}: types got ${JSON.stringify(p.t)} expect ${JSON.stringify(expectTypes)}`);
    failed++;
    return;
  }
  for (let atk = 1; atk <= 18; atk++) {
    const got = FilterEngine.typeMultiplier(atk, p.t, chart);
    const exp = expectedMult(atk, expectTypes);
    if (got !== exp) {
      console.error(
        `FAIL ${label} vs ${TYPE[atk]}: got ${got} expect ${exp} (types ${expectTypes})`
      );
      failed++;
    }
  }
}

for (const [pid, tid, name] of MONO) {
  assertPokemonChart(pid, [tid], `${name}(単${TYPE[tid]})`);
}
console.log(`OK mono-type charts (${MONO.length})`);

for (const [pid, types, name] of DUAL) {
  assertPokemonChart(pid, types, `${name}(${types.map((t) => TYPE[t]).join("/")})`);
}
console.log(`OK dual-type charts (${DUAL.length})`);

// カバー確認: 複合の防御タイプが 1..18 を網羅
const covered = new Set(DUAL.flatMap(([, types]) => types));
for (let t = 1; t <= 18; t++) {
  if (!covered.has(t)) {
    console.error(`FAIL dual coverage missing type ${t} ${TYPE[t]}`);
    failed++;
  }
}
console.log("OK dual type coverage (all 18)");

/** カテゴリ判定スポット */
const CAT = [
  [10008, 5, "x4", true, "ヒートロトム×じめん=4倍（特性無視）"],
  [10008, 5, "super", true, "ヒートロトム×じめん=抜群"],
  [10008, 5, "x2", false, "ヒートロトム×じめん≠2倍"],
  [260, 12, "x4", true, "ラグラージ×くさ=4倍"],
  [26, 5, "x2", true, "ライチュウ×じめん=2倍"],
  [18, 5, "x025", true, "ピジョット×じめん=効果なし"],
  [130, 13, "x4", true, "ギャラドス×でんき=4倍"],
  [149, 18, "x2", true, "カイリュー×フェアリー=2倍"],
  [149, 16, "x2", true, "カイリュー×ドラゴン=2倍"],
  [3, 10, "x2", true, "フシギバナ×ほのお=2倍"],
  [3, 3, "x2", true, "フシギバナ×ひこう=2倍"],
  [3, 15, "x2", true, "フシギバナ×こおり=2倍"],
  [212, 10, "x4", true, "ハッサム×ほのお=4倍"],
  [212, 10, "super", true, "ハッサム×ほのお=抜群"],
  [9, 10, "x05", true, "カメックス×ほのお=1/2"],
  [9, 10, "resist", true, "カメックス×ほのお=今一つ/無効"],
  [9, 12, "x2", true, "カメックス×くさ=2倍"],
];

for (const [pid, atk, effKey, expectMatch, label] of CAT) {
  const p = byId(pid);
  const mult = FilterEngine.typeMultiplier(atk, p.t, chart);
  const match = FilterEngine.matchesEfficacyCategory(mult, effKey);
  if (match !== expectMatch) {
    console.error(`FAIL cat ${label}: mult=${mult} match=${match} expect=${expectMatch}`);
    failed++;
  } else {
    console.log(`OK ${label} (×${mult})`);
  }
}

/** フィルタ適用: じめん4倍である → ヒートロトム含む */
const ground4 = FilterEngine.applyAll(data, [
  { kind: "efficacy", typeId: 5, effKey: "x4", op: "is", excluded: false },
]);
if (!ground4.some((p) => p.i === 10008)) {
  console.error("FAIL filter: Heat Rotom not in ground x4");
  failed++;
} else {
  console.log(`OK filter ground x4 includes Heat Rotom (n=${ground4.length})`);
}

const ground4not = FilterEngine.applyAll(data, [
  { kind: "efficacy", typeId: 5, effKey: "x4", op: "not", excluded: false },
]);
if (ground4not.some((p) => p.i === 10008)) {
  console.error("FAIL filter: Heat Rotom in ground x4 NOT");
  failed++;
} else {
  console.log("OK filter ground x4 でない excludes Heat Rotom");
}

if (failed) {
  console.error(`\n${failed} type efficacy check(s) failed`);
  process.exit(1);
}
console.log("\nAll type efficacy regression checks passed.");
