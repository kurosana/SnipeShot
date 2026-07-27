/**
 * データ読み込み
 */
const DataStore = {
  index: null,
  types: [],
  typeEfficacy: {},
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
    this.typeEfficacy = typeEfficacy;
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
    return mode;
  },

  getGenerationModes() {
    return this.index.modes.filter((m) => m.key !== "all");
  },
};
