const HABITS_COUNT = 8;
const DAYS_COUNT = 31;
const CENTER_X = 500;
const CENTER_Y = 500;
const INNER_RADIUS = 150;
const RING_WIDTH = 35;
const OUTER_RADIUS = INNER_RADIUS + (HABITS_COUNT * RING_WIDTH);

const TOTAL_ANGLE_DEG = 270; 
const START_ANGLE_DEG = -90; // Top
const GAP_ANGLE_DEG = 90;

const COLORS = [
  'var(--habit-1)',
  'var(--habit-2)',
  'var(--habit-3)',
  'var(--habit-4)',
  'var(--habit-5)',
  'var(--habit-6)',
  'var(--habit-7)',
  'var(--habit-8)',
];

// Helper to convert polar to cartesian
function polarToCartesian(x, y, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: x + (radius * Math.cos(angleInRadians)),
    y: y + (radius * Math.sin(angleInRadians))
  };
}

function createCellPath(rInner, rOuter, startAngle, endAngle) {
  const deg2rad = Math.PI / 180;
  const a1 = (startAngle - 90) * deg2rad;
  const a2 = (endAngle - 90) * deg2rad;
  
  const p1 = { x: CENTER_X + rInner * Math.cos(a1), y: CENTER_Y + rInner * Math.sin(a1) };
  const p2 = { x: CENTER_X + rOuter * Math.cos(a1), y: CENTER_Y + rOuter * Math.sin(a1) };
  const p3 = { x: CENTER_X + rOuter * Math.cos(a2), y: CENTER_Y + rOuter * Math.sin(a2) };
  const p4 = { x: CENTER_X + rInner * Math.cos(a2), y: CENTER_Y + rInner * Math.sin(a2) };

  const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;

  return `M ${p1.x} ${p1.y} 
          L ${p2.x} ${p2.y} 
          A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p3.x} ${p3.y}
          L ${p4.x} ${p4.y}
          A ${rInner} ${rInner} 0 ${largeArc} 0 ${p1.x} ${p1.y} Z`;
}

function initApp() {
  const svg = document.getElementById('wheel-svg');
  const statsGrid = document.getElementById('stats-grid');
  
  // Load state
  const state = JSON.parse(localStorage.getItem('wheelOfHabitsState') || '{}');
  const saveState = () => localStorage.setItem('wheelOfHabitsState', JSON.stringify(state));
  
  if (!state.cells) state.cells = {};
  if (!state.habits) state.habits = Array(HABITS_COUNT).fill('');
  if (!state.targets) state.targets = Array(HABITS_COUNT).fill(DAYS_COUNT);

  const anglePerDay = TOTAL_ANGLE_DEG / DAYS_COUNT;

  // Render Horizontal Lines to the left for habits
  const lineLeftEdge = 20; // Extend far to the left within the SVG
  
  for (let h = 0; h <= HABITS_COUNT; h++) {
    const r = INNER_RADIUS + (h * RING_WIDTH);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    // Top axis is at y = CENTER_Y - r. X starts from CENTER_X. Goes left.
    line.setAttribute("x1", lineLeftEdge);
    line.setAttribute("y1", CENTER_Y - r);
    line.setAttribute("x2", CENTER_X);
    line.setAttribute("y2", CENTER_Y - r);
    line.setAttribute("class", "grid-line");
    svg.appendChild(line);
  }

  // Render Habit Inputs precisely bounded between the lines using foreignObject
  for (let h = 0; h < HABITS_COUNT; h++) {
    const rIn = INNER_RADIUS + (h * RING_WIDTH);
    const rOut = INNER_RADIUS + ((h + 1) * RING_WIDTH);
    const yTop = CENTER_Y - rOut;
    
    const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    foreignObject.setAttribute("x", lineLeftEdge);
    foreignObject.setAttribute("y", yTop);
    foreignObject.setAttribute("width", Math.abs(CENTER_X - lineLeftEdge));
    foreignObject.setAttribute("height", RING_WIDTH);
    
    // Create inner HTML for the foreignObject
    const container = document.createElement("div");
    container.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    container.className = "embedded-habit-container";
    
    const indicator = document.createElement('div');
    indicator.className = "habit-color-dot";
    indicator.style.backgroundColor = COLORS[h];
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'embedded-habit-input';
    input.placeholder = `Habit #${h + 1}`;
    input.value = state.habits[h];
    
    input.addEventListener('input', (e) => {
      state.habits[h] = e.target.value;
      saveState();
      renderStats();
    });

    container.appendChild(indicator);
    container.appendChild(input);
    foreignObject.appendChild(container);
    svg.appendChild(foreignObject);
  }

  // Render Days (Segments)
  for (let d = 0; d < DAYS_COUNT; d++) {
    const startAngle = d * anglePerDay;
    const endAngle = (d + 1) * anglePerDay;

    // Draw cells for this day
    for (let h = 0; h < HABITS_COUNT; h++) {
      const rInner = INNER_RADIUS + (h * RING_WIDTH);
      const rOuter = rInner + RING_WIDTH;
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", createCellPath(rInner, rOuter, startAngle, endAngle));
      path.setAttribute("class", "cell");
      
      const cellId = `d${d}-h${h}`;
      if (state.cells[cellId]) {
        path.style.fill = COLORS[h];
        path.classList.add('active');
      }

      path.addEventListener('click', () => {
        path.classList.toggle('active');
        if (path.classList.contains('active')) {
          path.style.fill = COLORS[h];
          state.cells[cellId] = true;
        } else {
          path.style.fill = '';
          state.cells[cellId] = false;
        }
        saveState();
        renderStats();
      });

      svg.appendChild(path);
    }

    // Add Day Labels
    const midAngle = startAngle + (anglePerDay / 2);
    const labelRad = OUTER_RADIUS + 25;
    const aRad = (midAngle - 90) * (Math.PI / 180);
    const lx = CENTER_X + labelRad * Math.cos(aRad);
    const ly = CENTER_Y + labelRad * Math.sin(aRad);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", lx);
    text.setAttribute("y", ly);
    text.setAttribute("class", "day-label");
    let rotation = midAngle;
    text.setAttribute("transform", `rotate(${rotation}, ${lx}, ${ly})`);
    text.textContent = d + 1;
    
    svg.appendChild(text);

    // Draw radial line at startAngle
    const radialLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const rStart = { x: CENTER_X + INNER_RADIUS * Math.cos((startAngle - 90) * (Math.PI / 180)), y: CENTER_Y + INNER_RADIUS * Math.sin((startAngle - 90) * (Math.PI / 180)) };
    const rEnd = { x: CENTER_X + OUTER_RADIUS * Math.cos((startAngle - 90) * (Math.PI / 180)), y: CENTER_Y + OUTER_RADIUS * Math.sin((startAngle - 90) * (Math.PI / 180)) };
    radialLine.setAttribute("x1", rStart.x);
    radialLine.setAttribute("y1", rStart.y);
    radialLine.setAttribute("x2", rEnd.x);
    radialLine.setAttribute("y2", rEnd.y);
    radialLine.setAttribute("class", "grid-line");
    svg.appendChild(radialLine);

    // Final closing line for the last day
    if (d === DAYS_COUNT - 1) {
      const finalLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const fStart = { x: CENTER_X + INNER_RADIUS * Math.cos((endAngle - 90) * (Math.PI / 180)), y: CENTER_Y + INNER_RADIUS * Math.sin((endAngle - 90) * (Math.PI / 180)) };
      const fEnd = { x: CENTER_X + OUTER_RADIUS * Math.cos((endAngle - 90) * (Math.PI / 180)), y: CENTER_Y + OUTER_RADIUS * Math.sin((endAngle - 90) * (Math.PI / 180)) };
      finalLine.setAttribute("x1", fStart.x);
      finalLine.setAttribute("y1", fStart.y);
      finalLine.setAttribute("x2", fEnd.x);
      finalLine.setAttribute("y2", fEnd.y);
      finalLine.setAttribute("class", "grid-line");
      svg.appendChild(finalLine);
    }
  }

  function renderStats() {
    statsGrid.innerHTML = '';
    
    const achieved = Array(HABITS_COUNT).fill(0);
    for (const key in state.cells) {
      if (state.cells[key]) {
        const match = key.match(/d\d+-h(\d+)/);
        if (match) achieved[parseInt(match[1])]++;
      }
    }

    for (let h = 0; h < HABITS_COUNT; h++) {
      const target = state.targets[h];
      const count = achieved[h];
      const progress = target > 0 ? Math.min(100, (count / target) * 100) : 0;
      
      const card = document.createElement('div');
      card.className = 'stat-card';
      
      card.innerHTML = `
        <div class="stat-header">
          <div class="habit-color-dot" style="background-color: ${COLORS[h]}; margin-right: 8px;"></div>
          <span>${state.habits[h] || `Habit #${h + 1}`}</span>
        </div>
        <div class="stat-details">
          <span>Achieved: <strong>${count}</strong></span>
          <div>
            Goal: <input type="number" class="stat-goal-input" data-index="${h}" value="${target}" min="1" max="31" />
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progress}%; background-color: ${COLORS[h]}"></div>
        </div>
      `;
      
      statsGrid.appendChild(card);
    }

    // Attach listeners to newly created inputs
    const inputs = statsGrid.querySelectorAll('.stat-goal-input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        state.targets[parseInt(e.target.dataset.index)] = val;
        saveState();
        renderStats();
      });
    });
  }

  // Initial render
  renderStats();
}

document.addEventListener('DOMContentLoaded', initApp);
