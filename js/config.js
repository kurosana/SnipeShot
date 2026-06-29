/**
 * ねらいうちゲーム - 静的デフォルト設定（config.json で上書き）
 */
const CONFIG = {
  appTitle: "ねらいうちゲーム",
  version: "",
  releaseNotes: "",
  rulesHtml: "",
  rulesBasicHtml:
    "<p>一人ずつ順番に、ポケモンを絞り込む条件を指定します。</p><ul><li>タイプ（持つ / 持たない）</li><li>特性（持つ / 持たない）</li><li>わざ（覚える / 覚えない）</li><li>種族値（以上 / 以下）</li></ul><p>条件を満たすポケモンが2ラインに絞り込まれたら一騎打ち！<br>話し合って2匹を当てよう。</p>",
  rulesDetailHtml:
    "<p><strong>匹数とライン数</strong></p><ul><li><strong>匹</strong>：条件にヒットしたポケモンの合計です。フォルム違いは別々に数えます。</li><li><strong>ライン</strong>：進化・フォルム系統を1本のラインにまとめた数です。一騎打ちはラインがちょうど2本のときに発生します。</li></ul><p><strong>除外ボタン</strong></p><p>条件行の「除外」を押すと、その条件は検索に使われなくなります。絞り込みがうまくいかなかったときなどに使えます。もう一度押すと「戻す」で元に戻せます。</p><p><strong>カンニング</strong></p><p>いまの条件で該当ポケモン一覧の表示を切り替えられます。一騎打ち中に条件を変えて確認するのにも使えます。</p>",
  dataFolder: "data",
  imgFolder: "Img",
  searchResultLimit: 80,
  statLabels: {
    hp: "HP",
    atk: "こうげき",
    def: "ぼうぎょ",
    spa: "とくこう",
    spd: "とくぼう",
    spe: "すばやさ",
    tot: "合計",
  },
  conditionKinds: [
    { value: "type", label: "タイプ" },
    { value: "ability", label: "特性" },
    { value: "move", label: "わざ" },
    { value: "stat", label: "種族値" },
  ],
  colors: {
    bg: "#f0f9ff",
    btnPrimary: "#38bdf8",
    btnPrimaryHover: "#0ea5e9",
    btnSecondary: "#bae6fd",
    btnSecondaryHover: "#7dd3fc",
    btnPressed: "#0284c7",
    text: "#0c4a6e",
    textMuted: "#0369a1",
    placeholder: "#7dd3fc",
    border: "#bae6fd",
    danger: "#dc2626",
  },
};
