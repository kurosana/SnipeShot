/**
 * ねらいうちゲーム - 静的デフォルト設定（config.json で上書き）
 */
const CONFIG = {
  appTitle: "ねらいうちゲーム",
  version: "",
  releaseNotes: "",
  rulesHtml: "",
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
