/**
 * データ読み込み
 */
const DataStore = {
  index: null,
  types: [],
  typeEfficacy: {},
  typeEfficacyByGen: null,
  abilities: [],
  moves: [],
  eggGroups: [],
  pokemon: [],
  typeById: new Map(),
  abilityById: new Map(),
  moveById: new Map(),
  eggById: new Map(),

  cacheQuery() {
    const v = CONFIG.version || "1.6.0";
    return `?v=${encodeURIComponent(v)}`;
  },

  normalizeTypeEfficacy(raw) {
    if (raw && raw.byGen) {
      this.typeEfficacyByGen = raw.byGen;
      return raw.latest || raw.byGen["6"] || {};
    }
    this.typeEfficacyByGen = null;
    return raw || {};
  },

  chartKeyForMaxGen(maxGen) {
    const g = Number(maxGen) || 9;
    if (g <= 1) return "1";
    if (g <= 5) return "2";
    return "6";
  },

  pickTypeEfficacy(maxGen) {
    if (!this.typeEfficacyByGen) return this.typeEfficacy;
    const key = this.chartKeyForMaxGen(maxGen);
    return this.typeEfficacyByGen[key] || this.typeEfficacyByGen["6"] || this.typeEfficacy;
  },

  async init() {
    const base = CONFIG.dataFolder;
    const q = this.cacheQuery();
    const [index, types, typeEfficacy, abilities, moves, eggGroups] = await Promise.all([
      fetch(`${base}/index.json${q}`).then((r) => r.json()),
      fetch(`${base}/types.json${q}`).then((r) => r.json()),
      fetch(`${base}/type_efficacy.json${q}`).then((r) => r.json()),
      fetch(`${base}/abilities.json${q}`).then((r) => r.json()),
      fetch(`${base}/moves.json${q}`).then((r) => r.json()),
      fetch(`${base}/egg_groups.json${q}`).then((r) => r.json()),
    ]);
    this.index = index;
    this.types = types;
    this.typeEfficacy = this.normalizeTypeEfficacy(typeEfficacy);
    this.abilities = abilities;
    this.moves = moves;
    this.eggGroups = eggGroups;
    types.forEach((t) => this.typeById.set(t.id, t));
    abilities.forEach((a) => this.abilityById.set(a.id, a));
    moves.forEach((m) => this.moveById.set(m.id, m));
    eggGroups.forEach((g) => this.eggById.set(g.id, g));
    return index;
  },

  async loadMode(modeKey) {
    const mode = this.index.modes.find((m) => m.key === modeKey);
    if (!mode) throw new Error(`Unknown mode: ${modeKey}`);
    const res = await fetch(`${CONFIG.dataFolder}/${mode.file}${this.cacheQuery()}`);
    this.pokemon = await res.json();
    this.typeEfficacy = this.pickTypeEfficacy(mode.max_gen);
    return mode;
  },

  /** 世代指定用。スタンダードは除外し、全作品は常に末尾 */
  getGenerationModes() {
    const modes = this.index.modes.filter((m) => m.key !== "standard");
    const rest = modes.filter((m) => m.key !== "all");
    const all = modes.filter((m) => m.key === "all");
    return [...rest, ...all];
  },
};
