/**
 * 絞り込みロジック
 *
 * 進化・フォルムライン: 同一 evolution_chain_id で1グループ（進化段階・メガ/フォルム問わず）
 * 一騎打ち判定: 該当ポケモンに含まれる進化・フォルムラインの数が2のとき
 */
const FilterEngine = {
  evoFormLineKey(p) {
    return String(p.e);
  },

  applyAll(pokemon, conditions) {
    let result = pokemon;
    for (const cond of conditions) {
      if (cond.excluded) continue;
      if (!this.isComplete(cond)) continue;
      result = this.applyOne(result, cond);
    }
    return result;
  },

  isComplete(cond) {
    if (!cond.kind || !cond.op) return false;
    if (cond.kind === "type") return cond.typeId != null;
    if (cond.kind === "ability") return cond.abilityId != null;
    if (cond.kind === "move") return cond.moveId != null;
    if (cond.kind === "stat") {
      return cond.statKey && cond.statValue !== "" && !Number.isNaN(Number(cond.statValue));
    }
    return false;
  },

  applyOne(pokemon, cond) {
    switch (cond.kind) {
      case "type":
        return pokemon.filter((p) => {
          const has = p.t.includes(cond.typeId);
          return cond.op === "has" ? has : !has;
        });
      case "ability":
        return pokemon.filter((p) => {
          const has = p.a.includes(cond.abilityId);
          return cond.op === "has" ? has : !has;
        });
      case "move":
        return pokemon.filter((p) => {
          const has = p.m.includes(cond.moveId);
          return cond.op === "learn" ? has : !has;
        });
      case "stat": {
        const n = Number(cond.statValue);
        const key = cond.statKey;
        return pokemon.filter((p) => {
          const v = p.s[key] ?? 0;
          return cond.op === "gte" ? v >= n : v <= n;
        });
      }
      default:
        return pokemon;
    }
  },

  countResults(hits) {
    const byLine = new Map();
    for (const p of hits) {
      const lineKey = this.evoFormLineKey(p);
      if (!byLine.has(lineKey)) byLine.set(lineKey, []);
      byLine.get(lineKey).push(p);
    }
    let evoFormLines = 0;
    for (const group of byLine.values()) {
      if (group.length >= 2) evoFormLines += 1;
    }
    return { count: hits.length, evoFormLines, lines: byLine.size };
  },

  groupByEvoFormLine(hits) {
    const byLine = new Map();
    for (const p of hits) {
      const key = this.evoFormLineKey(p);
      if (!byLine.has(key)) byLine.set(key, []);
      byLine.get(key).push(p);
    }
    return [...byLine.values()].map((group) =>
      group.sort((a, b) => a.i - b.i).map((p) => p.n)
    );
  },

  shouldDuel(lines) {
    return lines === 2;
  },
};
