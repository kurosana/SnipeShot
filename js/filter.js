/**
 * 絞り込みロジック
 *
 * 進化・フォルムライン: 各エントリの e（リーフノード id の配列）でグループ化。
 * 分岐進化では共有の進化元が複数ラインに所属しうる。
 * 一騎打ち判定: 単独ライン数 + 吸収されない分岐個体の連結成分数が2のとき
 */
const FilterEngine = {
  lineIds(p) {
    const e = p.e;
    if (Array.isArray(e)) return e;
    return e != null ? [e] : [];
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

  countMultiLineComponents(multiSets) {
    if (multiSets.length === 0) return 0;
    const parent = multiSets.map((_, i) => i);
    const find = (i) => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < multiSets.length; i++) {
      for (let j = i + 1; j < multiSets.length; j++) {
        const shared = [...multiSets[i]].some((line) => multiSets[j].has(line));
        if (shared) union(i, j);
      }
    }
    const roots = new Set();
    for (let i = 0; i < multiSets.length; i++) roots.add(find(i));
    return roots.size;
  },

  countResults(hits) {
    const singleton = new Set();
    const multi = [];
    const byLine = new Map();

    for (const p of hits) {
      const lines = this.lineIds(p);
      if (lines.length === 1) {
        singleton.add(lines[0]);
      } else if (lines.length > 1) {
        multi.push(new Set(lines));
      }
      for (const lineId of lines) {
        if (!byLine.has(lineId)) byLine.set(lineId, []);
        byLine.get(lineId).push(p);
      }
    }

    let evoFormLines = 0;
    for (const group of byLine.values()) {
      if (group.length >= 2) evoFormLines += 1;
    }

    const remaining = multi.filter((lineSet) => ![...lineSet].some((l) => singleton.has(l)));
    const multiComponents = this.countMultiLineComponents(remaining);
    const lines = singleton.size + multiComponents;

    return { count: hits.length, evoFormLines, lines };
  },

  groupByEvoFormLine(hits) {
    const byLine = new Map();
    for (const p of hits) {
      for (const lineId of this.lineIds(p)) {
        if (!byLine.has(lineId)) byLine.set(lineId, []);
        byLine.get(lineId).push(p);
      }
    }
    return [...byLine.values()].map((group) =>
      group.sort((a, b) => a.i - b.i).map((p) => p.n)
    );
  },

  shouldDuel(lines) {
    return lines === 2;
  },
};
