/**
 * Miller Engine — Coevolving Automata Model
 *
 * Pure logic, no DOM. Implements Miller's (1989/1996/2022) model:
 * Moore machines playing iterated games, two populations coevolving
 * via cross-population tournament. Genetic algorithm with
 * fitness-proportional selection, circular crossover, per-gene mutation.
 * Default: two-population coevolution (Miller's model).
 * Set singlePopulation:true for single-population round-robin variant.
 *
 * Reference: Miller (1996) JEBO 29:87-112
 *            Miller (2022) Ex Machina, SFI Press
 */
const Miller = (function() {
  'use strict';

  // ===== RNG Module =====
  // Mulberry32 — fast, seedable, 32-bit PRNG

  var RNG = {};

  RNG.create = function(seed) {
    var state = seed | 0;
    if (state === 0) state = 1;

    function next() {
      state = (state + 0x6D2B79F5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    return {
      random: next,
      randInt: function(min, max) {
        return min + Math.floor(next() * (max - min + 1));
      },
      choice: function(arr) {
        return arr[Math.floor(next() * arr.length)];
      }
    };
  };

  // ===== Automaton Module =====

  var Automaton = {};

  Automaton.create = function(states, options) {
    var rng = (options && options.rng) || RNG.create(Date.now());
    var n = states;
    var actions = new Uint8Array(n);
    var transC = new Uint8Array(n);
    var transD = new Uint8Array(n);
    for (var i = 0; i < n; i++) {
      actions[i] = rng.randInt(0, 1);
      transC[i] = rng.randInt(0, n - 1);
      transD[i] = rng.randInt(0, n - 1);
    }
    return {
      states: n,
      startState: rng.randInt(0, n - 1),
      actions: actions,
      transC: transC,
      transD: transD,
      currentState: undefined // set by reset
    };
  };

  Automaton.createNamed = function(name) {
    switch (name) {
      case 'allC':
        return {
          states: 1,
          startState: 0,
          actions: new Uint8Array([0]),
          transC: new Uint8Array([0]),
          transD: new Uint8Array([0]),
          currentState: 0
        };
      case 'allD':
        return {
          states: 1,
          startState: 0,
          actions: new Uint8Array([1]),
          transC: new Uint8Array([0]),
          transD: new Uint8Array([0]),
          currentState: 0
        };
      case 'tft':
        // State 0: C, on C stay 0, on D go 1
        // State 1: D, on C go 0, on D stay 1
        return {
          states: 2,
          startState: 0,
          actions: new Uint8Array([0, 1]),
          transC: new Uint8Array([0, 0]),
          transD: new Uint8Array([1, 1]),
          currentState: 0
        };
      case 'grimTrigger':
        // State 0: C, on C stay 0, on D go 1
        // State 1: D, on C stay 1, on D stay 1 (absorbing)
        return {
          states: 2,
          startState: 0,
          actions: new Uint8Array([0, 1]),
          transC: new Uint8Array([0, 1]),
          transD: new Uint8Array([1, 1]),
          currentState: 0
        };
      case 'pavlov':
        // Win Stay, Lose Shift
        // State 0: C, on C (mutual coop=win) stay 0, on D (sucker=lose) go 1
        // State 1: D, on C (temptation=win) stay 1, on D (punishment=lose) go 0
        return {
          states: 2,
          startState: 0,
          actions: new Uint8Array([0, 1]),
          transC: new Uint8Array([0, 1]),
          transD: new Uint8Array([1, 0]),
          currentState: 0
        };
      case 'punishTwice':
        // Cooperate, on D punish for 2 rounds then forgive
        // State 0: C, on C stay 0, on D go 1
        // State 1: D, on C go 2, on D go 2
        // State 2: D, on C go 0, on D go 0
        return {
          states: 3,
          startState: 0,
          actions: new Uint8Array([0, 1, 1]),
          transC: new Uint8Array([0, 2, 0]),
          transD: new Uint8Array([1, 2, 0]),
          currentState: 0
        };
      case 'tf2t':
        // Tit-for-Two-Tats: defect only after TWO consecutive defections
        // State 0: C, on C stay 0, on D go 1
        // State 1: C (forgive once), on C go 0, on D go 2
        // State 2: D, on C go 0, on D stay 2
        return {
          states: 3,
          startState: 0,
          actions: new Uint8Array([0, 0, 1]),
          transC: new Uint8Array([0, 0, 0]),
          transD: new Uint8Array([1, 2, 2]),
          currentState: 0
        };
      default:
        return null;
    }
  };

  Automaton.step = function(auto, opponentAction) {
    var s = (auto.currentState !== undefined) ? auto.currentState : auto.startState;
    var action = auto.actions[s];
    var nextState = (opponentAction === 0) ? auto.transC[s] : auto.transD[s];
    return { action: action, nextState: nextState };
  };

  Automaton.reset = function(auto) {
    return {
      states: auto.states,
      startState: auto.startState,
      actions: new Uint8Array(auto.actions),
      transC: new Uint8Array(auto.transC),
      transD: new Uint8Array(auto.transD),
      currentState: auto.startState
    };
  };

  Automaton.clone = function(auto) {
    return {
      states: auto.states,
      startState: auto.startState,
      actions: new Uint8Array(auto.actions),
      transC: new Uint8Array(auto.transC),
      transD: new Uint8Array(auto.transD),
      currentState: auto.currentState
    };
  };

  Automaton.stats = function(auto) {
    // BFS from startState to find accessible states
    var visited = new Uint8Array(auto.states);
    var queue = [auto.startState];
    visited[auto.startState] = 1;
    var accessibleCount = 0;
    while (queue.length > 0) {
      var s = queue.shift();
      accessibleCount++;
      var nc = auto.transC[s];
      var nd = auto.transD[s];
      if (!visited[nc]) { visited[nc] = 1; queue.push(nc); }
      if (!visited[nd]) { visited[nd] = 1; queue.push(nd); }
    }

    // Cooperation-reciprocity: fraction of accessible states where
    // if opponent cooperates, the machine cooperates in the next state
    // i.e., action[transC[s]] == 0 for accessible states
    var cRecipCount = 0;
    var dRecipCount = 0;
    var terminalCount = 0;
    var countingCount = 0;
    for (var i = 0; i < auto.states; i++) {
      if (!visited[i]) continue;
      // c-reciprocity: does this state cooperate after opponent's C?
      // Meaning: the state we transition to on C has action=0
      if (auto.actions[auto.transC[i]] === 0) cRecipCount++;
      // d-reciprocity: does this state defect after opponent's D?
      if (auto.actions[auto.transD[i]] === 1) dRecipCount++;
      // terminal: both transitions point to self
      if (auto.transC[i] === i && auto.transD[i] === i) terminalCount++;
      // counting: same transition on both inputs
      if (auto.transC[i] === auto.transD[i]) countingCount++;
    }

    return {
      accessibleStates: accessibleCount,
      cReciprocity: accessibleCount > 0 ? cRecipCount / accessibleCount : 0,
      dReciprocity: accessibleCount > 0 ? dRecipCount / accessibleCount : 0,
      terminalStates: terminalCount,
      countingStates: countingCount
    };
  };

  Automaton.equals = function(a, b) {
    if (a.states !== b.states || a.startState !== b.startState) return false;
    for (var i = 0; i < a.states; i++) {
      if (a.actions[i] !== b.actions[i]) return false;
      if (a.transC[i] !== b.transC[i]) return false;
      if (a.transD[i] !== b.transD[i]) return false;
    }
    return true;
  };

  Automaton.identify = function(auto) {
    var names = ['allC', 'allD', 'tft', 'grimTrigger', 'pavlov', 'punishTwice', 'tf2t'];
    for (var i = 0; i < names.length; i++) {
      var named = Automaton.createNamed(names[i]);
      if (Automaton.equals(auto, named)) return names[i];
    }
    return null;
  };

  /**
   * Reduce an automaton to its accessible states via BFS from startState.
   * Remaps visited states to 0,1,2... in BFS order. Returns a new automaton
   * with only accessible states and canonicalized state numbering.
   */
  Automaton.reduce = function(auto) {
    // BFS from startState
    var visited = [];
    var queue = [auto.startState];
    var oldToNew = {};
    oldToNew[auto.startState] = 0;
    visited.push(auto.startState);

    while (queue.length > 0) {
      var s = queue.shift();
      var neighbors = [auto.transC[s], auto.transD[s]];
      for (var k = 0; k < neighbors.length; k++) {
        var nb = neighbors[k];
        if (oldToNew[nb] === undefined) {
          oldToNew[nb] = visited.length;
          visited.push(nb);
          queue.push(nb);
        }
      }
    }

    var n = visited.length;
    var actions = new Uint8Array(n);
    var transC = new Uint8Array(n);
    var transD = new Uint8Array(n);

    for (var i = 0; i < n; i++) {
      var oldState = visited[i];
      actions[i] = auto.actions[oldState];
      transC[i] = oldToNew[auto.transC[oldState]];
      transD[i] = oldToNew[auto.transD[oldState]];
    }

    return {
      states: n,
      startState: 0, // always 0 after canonicalization
      actions: actions,
      transC: transC,
      transD: transD,
      currentState: 0
    };
  };

  /**
   * Functional strategy identification: reduce the automaton to accessible states
   * with canonical numbering, then compare to known strategies.
   * Critical: ~35% of 2-state evolved agents labeled "other" by structural identify()
   * are functionally Grim Trigger with swapped state numbering.
   */
  Automaton.identifyFunctional = function(auto) {
    var reduced = Automaton.reduce(auto);
    return Automaton.identify(reduced);
  };

  // ===== Game Module =====

  var Game = {};

  Game.defaultPD = function() {
    return { T: 5, R: 3, P: 1, S: 0 };
  };

  Game.bookPD = function() {
    return { T: 5, R: 4, P: 1, S: 0 };
  };

  Game.play = function(autoA, autoB, rounds, payoffs) {
    var a = Automaton.reset(autoA);
    var b = Automaton.reset(autoB);
    var scoreA = 0, scoreB = 0;
    var history = [];

    for (var r = 0; r < rounds; r++) {
      // Read actions from current state (Moore machine: output depends only on state)
      var moveA = a.actions[a.currentState];
      var moveB = b.actions[b.currentState];

      // Compute payoffs
      if (moveA === 0 && moveB === 0) {
        scoreA += payoffs.R; scoreB += payoffs.R;
      } else if (moveA === 0 && moveB === 1) {
        scoreA += payoffs.S; scoreB += payoffs.T;
      } else if (moveA === 1 && moveB === 0) {
        scoreA += payoffs.T; scoreB += payoffs.S;
      } else {
        scoreA += payoffs.P; scoreB += payoffs.P;
      }

      history.push({ moveA: moveA, moveB: moveB });

      // Transition: each sees opponent's move
      var nextA = (moveB === 0) ? a.transC[a.currentState] : a.transD[a.currentState];
      var nextB = (moveA === 0) ? b.transC[b.currentState] : b.transD[b.currentState];
      a.currentState = nextA;
      b.currentState = nextB;
    }

    return { scoreA: scoreA, scoreB: scoreB, history: history };
  };

  Game.playNoHistory = function(autoA, autoB, rounds, payoffs) {
    var a = Automaton.reset(autoA);
    var b = Automaton.reset(autoB);
    var scoreA = 0, scoreB = 0;

    for (var r = 0; r < rounds; r++) {
      var moveA = a.actions[a.currentState];
      var moveB = b.actions[b.currentState];

      if (moveA === 0 && moveB === 0) {
        scoreA += payoffs.R; scoreB += payoffs.R;
      } else if (moveA === 0 && moveB === 1) {
        scoreA += payoffs.S; scoreB += payoffs.T;
      } else if (moveA === 1 && moveB === 0) {
        scoreA += payoffs.T; scoreB += payoffs.S;
      } else {
        scoreA += payoffs.P; scoreB += payoffs.P;
      }

      var nextA = (moveB === 0) ? a.transC[a.currentState] : a.transD[a.currentState];
      var nextB = (moveA === 0) ? b.transC[b.currentState] : b.transD[b.currentState];
      a.currentState = nextA;
      b.currentState = nextB;
    }

    return { scoreA: scoreA, scoreB: scoreB };
  };

  // ===== GA Module =====

  var GA = {};

  GA.createPopulation = function(size, states, rng) {
    var agents = [];
    for (var i = 0; i < size; i++) {
      agents.push(Automaton.create(states, { rng: rng }));
    }
    return {
      agents: agents,
      fitness: new Float64Array(size),
      size: size
    };
  };

  GA.tournament = function(population, rounds, payoffs) {
    var n = population.size;
    var agents = population.agents;
    var fitness = new Float64Array(n);

    // Round-robin including self-play
    for (var i = 0; i < n; i++) {
      for (var j = i; j < n; j++) {
        var result = Game.playNoHistory(agents[i], agents[j], rounds, payoffs);
        if (i === j) {
          // Self-play: agent gets average score
          fitness[i] += result.scoreA;
        } else {
          fitness[i] += result.scoreA;
          fitness[j] += result.scoreB;
        }
      }
    }

    return fitness;
  };

  GA.crossTournament = function(pop0, pop1, rounds, payoffs) {
    var n0 = pop0.size;
    var n1 = pop1.size;
    var fitness0 = new Float64Array(n0);
    var fitness1 = new Float64Array(n1);

    for (var i = 0; i < n0; i++) {
      for (var j = 0; j < n1; j++) {
        var result = Game.playNoHistory(pop0.agents[i], pop1.agents[j], rounds, payoffs);
        fitness0[i] += result.scoreA;
        fitness1[j] += result.scoreB;
      }
    }

    return { fitness0: fitness0, fitness1: fitness1 };
  };

  GA.normalizeScores = function(fitness, alpha) {
    var n = fitness.length;
    if (n === 0) return new Float64Array(0);

    // Compute mean and std dev
    var sum = 0;
    for (var i = 0; i < n; i++) sum += fitness[i];
    var mean = sum / n;

    var sqSum = 0;
    for (var i = 0; i < n; i++) sqSum += (fitness[i] - mean) * (fitness[i] - mean);
    var std = Math.sqrt(sqSum / (n - 1));

    var normalized = new Float64Array(n);
    if (std < 1e-10) {
      // All same fitness — equal probability
      for (var i = 0; i < n; i++) normalized[i] = 1;
    } else {
      for (var i = 0; i < n; i++) {
        normalized[i] = (fitness[i] - mean) / (std * alpha);
        if (normalized[i] < 0) normalized[i] = 0;
      }
    }

    // Convert to probabilities
    var total = 0;
    for (var i = 0; i < n; i++) total += normalized[i];
    if (total > 0) {
      for (var i = 0; i < n; i++) normalized[i] /= total;
    }

    return normalized;
  };

  GA.selectParent = function(population, normalizedFitness, rng) {
    var r = rng.random();
    var cumulative = 0;
    for (var i = 0; i < population.size; i++) {
      cumulative += normalizedFitness[i];
      if (r <= cumulative) return i;
    }
    return population.size - 1; // fallback for floating point
  };

  GA.circularCrossover = function(parentA, parentB, rng) {
    var n = parentA.states;
    // Flatten genome: [startState, action0, transC0, transD0, action1, transC1, transD1, ...]
    // Total genes = 1 + n * 3
    var totalGenes = 1 + n * 3;

    var genomeA = new Array(totalGenes);
    var genomeB = new Array(totalGenes);
    genomeA[0] = parentA.startState;
    genomeB[0] = parentB.startState;
    for (var i = 0; i < n; i++) {
      genomeA[1 + i * 3] = parentA.actions[i];
      genomeA[2 + i * 3] = parentA.transC[i];
      genomeA[3 + i * 3] = parentA.transD[i];
      genomeB[1 + i * 3] = parentB.actions[i];
      genomeB[2 + i * 3] = parentB.transC[i];
      genomeB[3 + i * 3] = parentB.transD[i];
    }

    // Circular crossover: pick random start point and length
    var crossPoint = rng.randInt(0, totalGenes - 1);
    var crossLen = rng.randInt(1, totalGenes - 1);

    var childGenomeA = genomeA.slice();
    var childGenomeB = genomeB.slice();

    for (var k = 0; k < crossLen; k++) {
      var idx = (crossPoint + k) % totalGenes;
      childGenomeA[idx] = genomeB[idx];
      childGenomeB[idx] = genomeA[idx];
    }

    // Reconstruct automata from genomes
    function genomeToAutomaton(genome, states) {
      var auto = {
        states: states,
        startState: genome[0] % states, // ensure valid
        actions: new Uint8Array(states),
        transC: new Uint8Array(states),
        transD: new Uint8Array(states),
        currentState: undefined
      };
      for (var i = 0; i < states; i++) {
        auto.actions[i] = genome[1 + i * 3] & 1; // ensure binary
        auto.transC[i] = genome[2 + i * 3] % states; // ensure valid range
        auto.transD[i] = genome[3 + i * 3] % states;
      }
      return auto;
    }

    return [genomeToAutomaton(childGenomeA, n), genomeToAutomaton(childGenomeB, n)];
  };

  GA.mutate = function(automaton, rate, rng) {
    var auto = Automaton.clone(automaton);
    var n = auto.states;

    // Mutate startState
    if (rng.random() < rate) {
      auto.startState = rng.randInt(0, n - 1);
    }

    // Mutate each state's genes
    for (var i = 0; i < n; i++) {
      // Action: flip
      if (rng.random() < rate) {
        auto.actions[i] = auto.actions[i] ^ 1;
      }
      // transC: random state
      if (rng.random() < rate) {
        auto.transC[i] = rng.randInt(0, n - 1);
      }
      // transD: random state
      if (rng.random() < rate) {
        auto.transD[i] = rng.randInt(0, n - 1);
      }
    }

    auto.currentState = auto.startState;
    return auto;
  };

  GA.evolve = function(population, fitness, config) {
    var rng = config.rng;
    var eliteCount = config.eliteCount || 20;
    var mutationRate = config.mutationRate || 0.005;
    var n = population.size;
    var states = population.agents[0].states;

    // Sort indices by fitness descending
    var indices = [];
    for (var i = 0; i < n; i++) indices.push(i);
    indices.sort(function(a, b) { return fitness[b] - fitness[a]; });

    // Elite survive
    var newAgents = [];
    for (var i = 0; i < eliteCount && i < n; i++) {
      newAgents.push(Automaton.clone(population.agents[indices[i]]));
    }

    // Compute per-gene mutation rate from per-bit equivalent
    // Miller: 0.5% per bit on 148 bits = 0.74 expected mutations
    // For N states: genes = 1 + N*3
    // rate_per_gene = 0.74 / (1 + N*3) when mutationRate == 0.005
    // General: rate_per_gene = (mutationRate * 148) / (1 + N*3)
    var totalGenes = 1 + states * 3;
    var perGeneRate = (mutationRate * 148) / totalGenes;

    // Normalize scores for selection from ENTIRE old population (Miller 1989: Prob(i) = μ(i,t) / Σ μ(j,t))
    var normalized = GA.normalizeScores(fitness, 2);
    var oldPop = { agents: population.agents, size: n };

    // Breed offspring to fill remaining slots
    while (newAgents.length < n) {
      var pA = GA.selectParent(oldPop, normalized, rng);
      var pB = GA.selectParent(oldPop, normalized, rng);
      if (n > 1) {
        var attempts = 0;
        while (pB === pA && attempts < 5) {
          pB = GA.selectParent(oldPop, normalized, rng);
          attempts++;
        }
      }

      var children = GA.circularCrossover(population.agents[pA], population.agents[pB], rng);
      children[0] = GA.mutate(children[0], perGeneRate, rng);
      children[1] = GA.mutate(children[1], perGeneRate, rng);

      newAgents.push(children[0]);
      if (newAgents.length < n) {
        newAgents.push(children[1]);
      }
    }

    return {
      agents: newAgents,
      fitness: new Float64Array(n),
      size: n
    };
  };

  // ===== Experiment Module =====

  var Experiment = {};

  // Compute stats by replaying matches for cooperation counting,
  // reusing fitness from tournament
  Experiment._computeStats = function(population, fitness, rounds, generation) {
    var n = population.size;
    var agents = population.agents;

    // Count cooperation moves by replaying all matches
    var totalC = 0, totalD = 0;
    for (var i = 0; i < n; i++) {
      for (var j = i; j < n; j++) {
        var a = Automaton.reset(agents[i]);
        var b = Automaton.reset(agents[j]);
        for (var r = 0; r < rounds; r++) {
          var moveA = a.actions[a.currentState];
          var moveB = b.actions[b.currentState];
          totalC += (moveA === 0 ? 1 : 0) + (moveB === 0 ? 1 : 0);
          totalD += (moveA === 1 ? 1 : 0) + (moveB === 1 ? 1 : 0);
          var nextA = (moveB === 0) ? a.transC[a.currentState] : a.transD[a.currentState];
          var nextB = (moveA === 0) ? b.transC[b.currentState] : b.transD[b.currentState];
          a.currentState = nextA;
          b.currentState = nextB;
        }
      }
    }

    var cooperationRate = (totalC + totalD) > 0 ? totalC / (totalC + totalD) : 0;

    // Fitness stats
    var sumFit = 0, maxFit = -Infinity;
    for (var i = 0; i < n; i++) {
      sumFit += fitness[i];
      if (fitness[i] > maxFit) maxFit = fitness[i];
    }
    var matchesPerAgent = n; // plays against every agent including self
    var avgPayoff = (sumFit / n) / (matchesPerAgent * rounds);
    var maxPayoff = maxFit / (matchesPerAgent * rounds);

    // Strategy census using functional identification
    var census = { allC: 0, allD: 0, tft: 0, grimTrigger: 0, pavlov: 0, tf2t: 0, other: 0 };
    for (var i = 0; i < n; i++) {
      var id = Automaton.identifyFunctional(agents[i]);
      if (id && census.hasOwnProperty(id)) {
        census[id]++;
      } else {
        census.other++;
      }
    }

    return {
      generation: generation,
      cooperationRate: cooperationRate,
      avgPayoff: avgPayoff,
      maxPayoff: maxPayoff,
      census: census
    };
  };

  Experiment._computeCoevolveStats = function(pop0, pop1, fitness0, fitness1, rounds, generation) {
    var n0 = pop0.size, n1 = pop1.size;

    var totalC = 0, totalD = 0;
    for (var i = 0; i < n0; i++) {
      for (var j = 0; j < n1; j++) {
        var a = Automaton.reset(pop0.agents[i]);
        var b = Automaton.reset(pop1.agents[j]);
        for (var r = 0; r < rounds; r++) {
          var moveA = a.actions[a.currentState];
          var moveB = b.actions[b.currentState];
          totalC += (moveA === 0 ? 1 : 0) + (moveB === 0 ? 1 : 0);
          totalD += (moveA === 1 ? 1 : 0) + (moveB === 1 ? 1 : 0);
          var nextA = (moveB === 0) ? a.transC[a.currentState] : a.transD[a.currentState];
          var nextB = (moveA === 0) ? b.transC[b.currentState] : b.transD[b.currentState];
          a.currentState = nextA;
          b.currentState = nextB;
        }
      }
    }

    var cooperationRate = (totalC + totalD) > 0 ? totalC / (totalC + totalD) : 0;

    var sumFit = 0, maxFit = -Infinity;
    for (var i = 0; i < n0; i++) {
      sumFit += fitness0[i];
      if (fitness0[i] > maxFit) maxFit = fitness0[i];
    }
    for (var j = 0; j < n1; j++) {
      sumFit += fitness1[j];
      if (fitness1[j] > maxFit) maxFit = fitness1[j];
    }

    var avgPayoff = sumFit / (2 * n0 * n1 * rounds);
    var maxPayoff = maxFit / (Math.max(n0, n1) * rounds);

    // Strategy census: merge both populations using functional identification
    var census = { allC: 0, allD: 0, tft: 0, grimTrigger: 0, pavlov: 0, tf2t: 0, other: 0 };
    for (var i = 0; i < n0; i++) {
      var id = Automaton.identifyFunctional(pop0.agents[i]);
      if (id && census.hasOwnProperty(id)) {
        census[id]++;
      } else {
        census.other++;
      }
    }
    for (var j = 0; j < n1; j++) {
      var id = Automaton.identifyFunctional(pop1.agents[j]);
      if (id && census.hasOwnProperty(id)) {
        census[id]++;
      } else {
        census.other++;
      }
    }

    return {
      generation: generation,
      cooperationRate: cooperationRate,
      avgPayoff: avgPayoff,
      maxPayoff: maxPayoff,
      census: census
    };
  };

  Experiment.run = function(config) {
    var rng = RNG.create(config.seed || 12345);
    var payoffs = config.payoffs || Game.defaultPD();
    var popSize = config.populationSize || 30;
    var states = config.states || 16;
    var rounds = config.rounds || 150;
    var generations = config.generations || 50;
    var eliteCount = config.eliteCount || 20;
    var mutationRate = config.mutationRate || 0.005;
    var onGeneration = config.onGeneration || null;
    var stats = [];

    if (config.singlePopulation) {
      var population = GA.createPopulation(popSize, states, rng);
      for (var g = 0; g < generations; g++) {
        var fitness = GA.tournament(population, rounds, payoffs);
        population.fitness = fitness;
        var genStats = Experiment._computeStats(population, fitness, rounds, g);
        stats.push(genStats);
        if (onGeneration) onGeneration(genStats);
        if (g < generations - 1) {
          population = GA.evolve(population, fitness, {
            rng: rng, eliteCount: eliteCount, mutationRate: mutationRate
          });
        }
      }
      return { stats: stats, population: population };
    }

    var pop0 = GA.createPopulation(popSize, states, rng);
    var pop1 = GA.createPopulation(popSize, states, rng);

    for (var g = 0; g < generations; g++) {
      var result = GA.crossTournament(pop0, pop1, rounds, payoffs);
      var genStats = Experiment._computeCoevolveStats(
        pop0, pop1, result.fitness0, result.fitness1, rounds, g);
      stats.push(genStats);
      if (onGeneration) onGeneration(genStats);
      if (g < generations - 1) {
        pop0 = GA.evolve(pop0, result.fitness0, {
          rng: rng, eliteCount: eliteCount, mutationRate: mutationRate
        });
        pop1 = GA.evolve(pop1, result.fitness1, {
          rng: rng, eliteCount: eliteCount, mutationRate: mutationRate
        });
      }
    }

    return { stats: stats, pop0: pop0, pop1: pop1 };
  };

  Experiment.runAsync = function(config) {
    return new Promise(function(resolve) {
      var rng = RNG.create(config.seed || 12345);
      var payoffs = config.payoffs || Game.defaultPD();
      var popSize = config.populationSize || 30;
      var states = config.states || 16;
      var rounds = config.rounds || 150;
      var generations = config.generations || 50;
      var eliteCount = config.eliteCount || 20;
      var mutationRate = config.mutationRate || 0.005;
      var onGeneration = config.onGeneration || null;
      var batchSize = config.batchSize || 2;
      var stats = [];
      var g = 0;

      if (config.singlePopulation) {
        var population = GA.createPopulation(popSize, states, rng);
        function batchSingle() {
          var end = Math.min(g + batchSize, generations);
          while (g < end) {
            var fitness = GA.tournament(population, rounds, payoffs);
            population.fitness = fitness;
            var genStats = Experiment._computeStats(population, fitness, rounds, g);
            stats.push(genStats);
            if (onGeneration) onGeneration(genStats);
            if (g < generations - 1) {
              population = GA.evolve(population, fitness, {
                rng: rng, eliteCount: eliteCount, mutationRate: mutationRate
              });
            }
            g++;
          }
          if (g < generations) setTimeout(batchSingle, 0);
          else resolve({ stats: stats, population: population });
        }
        batchSingle();
        return;
      }

      var pop0 = GA.createPopulation(popSize, states, rng);
      var pop1 = GA.createPopulation(popSize, states, rng);

      function batch() {
        var end = Math.min(g + batchSize, generations);
        while (g < end) {
          var result = GA.crossTournament(pop0, pop1, rounds, payoffs);
          var genStats = Experiment._computeCoevolveStats(
            pop0, pop1, result.fitness0, result.fitness1, rounds, g);
          stats.push(genStats);
          if (onGeneration) onGeneration(genStats);
          if (g < generations - 1) {
            pop0 = GA.evolve(pop0, result.fitness0, {
              rng: rng, eliteCount: eliteCount, mutationRate: mutationRate
            });
            pop1 = GA.evolve(pop1, result.fitness1, {
              rng: rng, eliteCount: eliteCount, mutationRate: mutationRate
            });
          }
          g++;
        }
        if (g < generations) setTimeout(batch, 0);
        else resolve({ stats: stats, pop0: pop0, pop1: pop1 });
      }

      batch();
    });
  };

  /**
   * Extract top N agents from a run result, sorted by fitness descending.
   * For two-pop: merges pop0 and pop1 agents with their fitness arrays.
   * For single-pop: sorts population.agents by population.fitness.
   * Each entry: {agent, fitness, identified} where identified = identifyFunctional result.
   */
  Experiment.topAgents = function(runResult, n) {
    var entries = [];

    if (runResult.population) {
      // Single-pop result
      var pop = runResult.population;
      for (var i = 0; i < pop.agents.length; i++) {
        entries.push({ agent: pop.agents[i], fitness: pop.fitness[i] });
      }
    } else {
      // Two-pop result: merge both populations
      var p0 = runResult.pop0;
      var p1 = runResult.pop1;
      for (var i = 0; i < p0.agents.length; i++) {
        entries.push({ agent: p0.agents[i], fitness: p0.fitness[i] });
      }
      for (var j = 0; j < p1.agents.length; j++) {
        entries.push({ agent: p1.agents[j], fitness: p1.fitness[j] });
      }
    }

    // Sort by fitness descending
    entries.sort(function(a, b) { return b.fitness - a.fitness; });

    // Take top n and add identification
    var result = [];
    var count = Math.min(n, entries.length);
    for (var i = 0; i < count; i++) {
      result.push({
        agent: entries[i].agent,
        fitness: entries[i].fitness,
        identified: Automaton.identifyFunctional(entries[i].agent)
      });
    }

    return result;
  };

  Experiment.sweep = function(configs) {
    var results = [];
    for (var i = 0; i < configs.length; i++) {
      results.push(Experiment.run(configs[i]));
    }
    return results;
  };

  Experiment.sweepAsync = function(configs, onTrialComplete) {
    var results = [];
    var idx = 0;

    return new Promise(function(resolve) {
      function next() {
        if (idx >= configs.length) {
          resolve(results);
          return;
        }
        var config = configs[idx];
        var localIdx = idx;
        idx++;

        Experiment.runAsync(config).then(function(stats) {
          results[localIdx] = stats;
          if (onTrialComplete) onTrialComplete(localIdx, stats, configs[localIdx]);
          setTimeout(next, 0);
        });
      }
      next();
    });
  };

  // ===== Public API =====

  return {
    RNG: RNG,
    Automaton: Automaton,
    Game: Game,
    GA: GA,
    Experiment: Experiment
  };

})();
