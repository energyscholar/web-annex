/* demo-bank.js — the six-item demo bank for engine-demo.html (one of every item type and tier).
   Shape per the engine contract: CC_BANKS[page] = {page, sections, items}. quizN = 2: the first two
   items of each section are its Check-yourself; the rest are the final test's pool. */
window.CC_BANKS = window.CC_BANKS || {};
window.CC_BANKS.demo = {
  page: 'demo', title: 'Engine demo', url: 'engine-demo.html', quizN: 2,
  sections: ['1-trace', '2-flow'],
  items: [
    { id: 'demo-1-01', section: '1-trace', tier: 'name', type: 'mc', label: 'Berezinskii',
      prompt: 'Who published the vortex-unbinding argument first, in 1971&ndash;72, independently of Kosterlitz and Thouless?',
      options: ['Berezinskii', 'Mermin', 'Nelson', 'Halperin'], answer: 0,
      explain: 'The transition is properly called BKT for that reason.', cite: 'fn1' },
    { id: 'demo-1-02', section: '1-trace', tier: 'equation', type: 'match',
      prompt: 'Match each term of F = &pi;J ln(L/a) &minus; 2k<sub>B</sub>T ln(L/a) to what it is.',
      answer: [['&pi;J ln(L/a)', 'the energy of one vortex'], ['2k<sub>B</sub>T ln(L/a)', 'temperature times the entropy of its position'], ['(&pi;J &minus; 2k<sub>B</sub>T) ln(L/a)', 'the free energy of one vortex']],
      explain: 'Both terms grow like ln(L/a); their coefficients decide the sign.', cite: 'fn1' },
    { id: 'demo-1-03', section: '1-trace', tier: 'concept', type: 'mc',
      prompt: 'Why does the system size L drop out of the SIGN of the free energy of one vortex?',
      options: ['Both terms grow like ln(L/a), so it factors out', 'The vortex core energy cancels it', 'Mermin&ndash;Wagner forbids any L dependence', 'L only enters through the lattice spacing a'], answer: 0,
      explain: 'F = (&pi;J &minus; 2k<sub>B</sub>T) ln(L/a): the logarithm is common to both terms.', cite: 'fn1' },
    { id: 'demo-2-01', section: '2-flow', tier: 'task', type: 'task',
      prompt: 'Drag the start point so that the flow lands ON the fixed line (y = 0, x &gt; 0), then press Check.',
      graphic: 'demo-flow', check: 'landsOnFixedLine',
      explain: 'Any start with x &gt; y (below the separatrix) flows to y = 0 and stops there, at the x it reached.', cite: 'fn3' },
    { id: 'demo-2-02', section: '2-flow', tier: 'name', type: 'order',
      prompt: 'Put these papers in the order they were published.',
      options: ['Berezinskii (vortex argument)', 'Kosterlitz &amp; Thouless (ordering in two dimensions)', 'Nelson &amp; Kosterlitz (the universal jump)', 'Hasenbusch, Marcu &amp; Pinn (RG matching of the roughening transition)'], answer: [0, 1, 2, 3],
      explain: '1971&ndash;72, 1973, 1977, 1994.', cite: 'fn2' },
    { id: 'demo-2-03', section: '2-flow', tier: 'name', type: 'mc', label: 'Hasenbusch, Marcu & Pinn',
      prompt: 'Which study writes the flow as dy/dt = &minus;xy, dx/dt = &minus;y<sup>2</sup> with x = &pi;&beta; &minus; 2 and conserves E = y<sup>2</sup> &minus; x<sup>2</sup>?',
      options: ['Hasenbusch, Marcu &amp; Pinn (1994)', 'Nelson &amp; Kosterlitz (1977)', 'Mermin &amp; Wagner (1966)', 'Bishop &amp; Reppy (1978)'], answer: 0,
      explain: 'Their eqs 22&ndash;24, used to match the roughening transition to the KT flow.', cite: 'fn3' }
  ]
};
