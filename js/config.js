/**
 * ねらいうちゲーム - 静的デフォルト設定（config.json で上書き）
 */
const CONFIG = {
  appTitle: "ねらいうちゲーム",
  version: "",
  releaseNotes: "",
  rulesHtml: "",
  rulesBasicHtml:
    "<p>一人ずつ順番に、ポケモンを絞り込む条件を指定します。</p><ul><li>タイプ（持つ / 持たない）</li><li>とくせい（持つ / 持たない）</li><li>わざ（覚える / 覚えない）</li><li>種族値（以上 / 以下）</li><li>タマゴグループ（である / でない）</li></ul><p>条件を満たすポケモンが2系統に絞り込まれたらねらいうちモード！<br>話し合って2匹を当てよう。</p>",
  rulesDetailHtml:
    "<p><strong>匹数と系統数</strong></p><ul><li><strong>匹</strong>：条件にヒットしたポケモンの合計です。フォルム違いは別々に数えます。</li><li><strong>系統</strong>：進化・フォルム系統を1本の系統にまとめた数です。ねらいうちモードは系統がちょうど2本のときに発生します。</li></ul><p><strong>除外ボタン</strong></p><p>条件行の「除外」を押すと、その条件は検索に使われなくなります。絞り込みがうまくいかなかったときなどに使えます。もう一度押すと「戻す」で元に戻せます。</p><p><strong>カンニング</strong></p><p>いまの条件で該当ポケモン一覧の表示を切り替えられます。ねらいうちモード中に条件を変えて確認するのにも使えます。</p>",
  dataFolder: "data",
  imgFolder: "Img",
  searchResultLimit: 80,
  shareUrl: "https://kurosana.github.io/SnipeShot/",
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
    { value: "ability", label: "とくせい" },
    { value: "move", label: "わざ" },
    { value: "stat", label: "種族値" },
    { value: "egg", label: "タマゴグループ" },
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
