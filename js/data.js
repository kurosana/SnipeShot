/**
 * データ読み込み
 */
const DataStore = {
  index: null,
  types: [],
  abilities: [],
  moves: [],
  pokemon: [],
  typeById: new Map(),
  abilityById: new Map(),
  moveById: new Map(),

  async init() {
    const base = CONFIG.dataFolder;
    const [index, types, abilities, moves] = await Promise.all([
      fetch(`${base}/index.json`).then((r) => r.json()),
      fetch(`${base}/types.json`).then((r) => r.json()),
      fetch(`${base}/abilities.json`).then((r) => r.json()),
      fetch(`${base}/moves.json`).then((r) => r.json()),
    ]);
    this.index = index;
    this.types = types;
    this.abilities = abilities;
    this.moves = moves;
    types.forEach((t) => this.typeById.set(t.id, t));
    abilities.forEach((a) => this.abilityById.set(a.id, a));
    moves.forEach((m) => this.moveById.set(m.id, m));
    return index;
  },

  async loadMode(modeKey) {
    const mode = this.index.modes.find((m) => m.key === modeKey);
    if (!mode) throw new Error(`Unknown mode: ${modeKey}`);
    const res = await fetch(`${CONFIG.dataFolder}/${mode.file}`);
    this.pokemon = await res.json();
    return mode;
  },

  getGenerationModes() {
    return this.index.modes.filter((m) => m.key !== "all");
  },
};
