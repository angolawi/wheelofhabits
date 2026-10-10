import {
  GITHUB_DARK_COLORS,
  GITHUB_DARK_LEVELS,
  GITHUB_LIGHT_COLORS,
  GITHUB_LIGHT_LEVELS,
  calculateHabitStreaks,
  generateAndDownloadPdf
} from './exportPdf.js';

const HABITS_COUNT = 8;
const CENTER_X = 500;
const CENTER_Y = 500;
const INNER_RADIUS = 150;
const RING_WIDTH = 35;
const OUTER_RADIUS = INNER_RADIUS + (HABITS_COUNT * RING_WIDTH);
const TOTAL_ANGLE_DEG = 270;

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

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
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth(); // 0-11
  let currentDay = now.getDate();

  let selectedYear = currentYear;
  let selectedMonth = currentMonth;

  // Load state
  const rawState = JSON.parse(localStorage.getItem('wheelOfHabitsState') || '{}');
  const state = {
    habits: rawState.habits || Array(HABITS_COUNT).fill(''),
    targets: rawState.targets || Array(HABITS_COUNT).fill(31),
    months: rawState.months || {}
  };

  // Migration for previous version
  const initialMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  if (rawState.cells && Object.keys(rawState.cells).length > 0 && !state.months[initialMonthKey]) {
    state.months[initialMonthKey] = { ...rawState.cells };
  }

  const saveState = () => {
    localStorage.setItem('wheelOfHabitsState', JSON.stringify({
      habits: state.habits,
      targets: state.targets,
      months: state.months
    }));
  };

  // Theme Management
  let currentTheme = localStorage.getItem('wheelTheme') || 'dark';
  applyTheme(currentTheme);

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wheelTheme', theme);
    const moonIcon = document.getElementById('theme-icon-moon');
    const sunIcon = document.getElementById('theme-icon-sun');
    if (moonIcon && sunIcon) {
      if (theme === 'light') {
        moonIcon.classList.remove('hidden');
        sunIcon.classList.add('hidden');
      } else {
        moonIcon.classList.add('hidden');
        sunIcon.classList.remove('hidden');
      }
    }
  }

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      renderWheel();
      renderStats();
    });
  }

  // DOM Elements
  const svg = document.getElementById('wheel-svg');
  const statsGrid = document.getElementById('stats-grid');
  const tooltip = document.getElementById('wheel-tooltip');
  const currentMonthDisplay = document.getElementById('current-month-display');
  const daysBadge = document.getElementById('days-in-month-badge');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');
  const todayMonthBtn = document.getElementById('today-month-btn');

  // Month Helpers
  function getActiveMonthKey() {
    return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  }

  function getActiveMonthCells() {
    const key = getActiveMonthKey();
    if (!state.months[key]) state.months[key] = {};
    return state.months[key];
  }

  function getDaysInSelectedMonth() {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }

  function updateMonthHeader() {
    const monthName = MONTH_NAMES_PT[selectedMonth];
    if (currentMonthDisplay) {
      currentMonthDisplay.textContent = `${monthName} ${selectedYear}`;
    }
    const daysCount = getDaysInSelectedMonth();
    if (daysBadge) {
      daysBadge.textContent = `${daysCount} dias`;
    }
  }

  // Month Navigation Listeners
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      selectedMonth--;
      if (selectedMonth < 0) {
        selectedMonth = 11;
        selectedYear--;
      }
      renderAll();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      selectedMonth++;
      if (selectedMonth > 11) {
        selectedMonth = 0;
        selectedYear++;
      }
      renderAll();
    });
  }

  if (todayMonthBtn) {
    todayMonthBtn.addEventListener('click', () => {
      selectedYear = currentYear;
      selectedMonth = currentMonth;
      renderAll();
    });
  }

  // Drag-to-paint State
  let isPointerDown = false;
  let dragFillValue = null;

  document.addEventListener('pointerup', () => {
    isPointerDown = false;
    dragFillValue = null;
  });

  // Render Wheel
  function renderWheel() {
    svg.innerHTML = '';
    const daysCount = getDaysInSelectedMonth();
    const anglePerDay = TOTAL_ANGLE_DEG / daysCount;
    const lineLeftEdge = 20;
    const monthCells = getActiveMonthCells();
    const colors = currentTheme === 'light' ? GITHUB_LIGHT_COLORS : GITHUB_DARK_COLORS;
    const levels = currentTheme === 'light' ? GITHUB_LIGHT_LEVELS : GITHUB_DARK_LEVELS;

    const isThisMonth = selectedYear === currentYear && selectedMonth === currentMonth;

    // Render Horizontal Lines to the left for habits
    for (let h = 0; h <= HABITS_COUNT; h++) {
      const r = INNER_RADIUS + (h * RING_WIDTH);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
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

      const container = document.createElement("div");
      container.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      container.className = "embedded-habit-container";

      const indicator = document.createElement('div');
      indicator.className = "habit-color-dot";
      indicator.style.backgroundColor = colors[h];

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'embedded-habit-input';
      input.placeholder = `Hábito #${h + 1}`;
      input.value = state.habits[h] || '';

      input.addEventListener('input', (e) => {
        state.habits[h] = e.target.value;
        saveState();
        renderStats();
      });

      container.appendChild(input);
      container.appendChild(indicator);
      foreignObject.appendChild(container);
      svg.appendChild(foreignObject);
    }

    // Render Days (Segments)
    for (let d = 0; d < daysCount; d++) {
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
        const cellVal = monthCells[cellId];

        const applyCellVisual = (val) => {
          if (!val) {
            path.style.fill = '';
            path.classList.remove('active');
          } else if (typeof val === 'number' && val >= 1 && val <= 4) {
            path.style.fill = levels[val];
            path.classList.add('active');
          } else {
            path.style.fill = colors[h];
            path.classList.add('active');
          }
        };

        applyCellVisual(cellVal);

        // Cell Click & Drag Handlers
        const setCellState = (val) => {
          if (val) {
            monthCells[cellId] = val;
          } else {
            delete monthCells[cellId];
          }
          applyCellVisual(val);
          saveState();
          renderStats();
        };

        path.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return; // only left click initiates drag
          isPointerDown = true;
          const currentVal = monthCells[cellId];
          dragFillValue = currentVal ? false : true;
          setCellState(dragFillValue);
          updateTooltip(e, d, h);
        });

        path.addEventListener('pointerenter', (e) => {
          if (isPointerDown && dragFillValue !== null) {
            setCellState(dragFillValue);
          }
          updateTooltip(e, d, h);
        });

        // Right Click: Cycle heatmap levels (1 -> 2 -> 3 -> 4 -> 0)
        path.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          let cur = monthCells[cellId];
          let nextVal = 0;

          if (cur === true) cur = 4;
          if (typeof cur === 'number') {
            nextVal = (cur % 4) + 1;
            if (cur === 4) nextVal = 0;
          } else {
            nextVal = 1;
          }

          setCellState(nextVal > 0 ? nextVal : false);
          updateTooltip(e, d, h);
        });

        path.addEventListener('mousemove', (e) => positionTooltip(e));
        path.addEventListener('mouseleave', () => hideTooltip());

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
      let classNames = "day-label";
      if (isThisMonth && (d + 1) === currentDay) {
        classNames += " today";
      }
      text.setAttribute("class", classNames);
      let rotation = midAngle;
      text.setAttribute("transform", `rotate(${rotation}, ${lx}, ${ly})`);
      text.textContent = d + 1;

      svg.appendChild(text);

      // Radial grid line at startAngle
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
      if (d === daysCount - 1) {
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
  }

  // Tooltip Helpers
  function updateTooltip(e, dayIndex, habitIndex) {
    if (!tooltip) return;
    const monthCells = getActiveMonthCells();
    const cellId = `d${dayIndex}-h${habitIndex}`;
    const val = monthCells[cellId];
    const habitName = state.habits[habitIndex]?.trim() || `Hábito #${habitIndex + 1}`;
    const monthName = MONTH_NAMES_PT[selectedMonth];

    let statusText = 'Não realizado';
    if (val === true) statusText = 'Concluído';
    else if (typeof val === 'number' && val > 0) statusText = `Nível ${val}/4`;

    tooltip.innerHTML = `<strong>${habitName}</strong><br>${dayIndex + 1} de ${monthName} • <span style="color: ${val ? '#39d353' : '#8b949e'}">${statusText}</span>`;
    tooltip.classList.add('visible');
    positionTooltip(e);
  }

  function positionTooltip(e) {
    if (!tooltip) return;
    const wheelRect = svg.parentElement.getBoundingClientRect();
    const x = e.clientX - wheelRect.left;
    const y = e.clientY - wheelRect.top;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.remove('visible');
  }

  // Render Stats & Executive KPIs
  function renderStats() {
    const daysCount = getDaysInSelectedMonth();
    const monthCells = getActiveMonthCells();
    const colors = currentTheme === 'light' ? GITHUB_LIGHT_COLORS : GITHUB_DARK_COLORS;

    const achieved = Array(HABITS_COUNT).fill(0);
    let totalAchieved = 0;
    let totalTarget = 0;

    let overallBestStreak = 0;
    let overallBestHabitName = '';

    for (let h = 0; h < HABITS_COUNT; h++) {
      const target = state.targets[h] || daysCount;
      totalTarget += target;

      const { currentStreak, bestStreak } = calculateHabitStreaks(monthCells, h, daysCount);
      if (bestStreak > overallBestStreak) {
        overallBestStreak = bestStreak;
        overallBestHabitName = state.habits[h]?.trim() || `Hábito #${h + 1}`;
      }
    }

    for (const key in monthCells) {
      if (monthCells[key]) {
        const match = key.match(/d\d+-h(\d+)/);
        if (match) {
          const hIdx = parseInt(match[1]);
          achieved[hIdx]++;
          totalAchieved++;
        }
      }
    }

    // Update KPI Dashboard
    const completionPercent = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    const kpiCompletionRate = document.getElementById('kpi-completion-rate');
    const kpiProgressFill = document.getElementById('kpi-progress-fill');
    if (kpiCompletionRate) kpiCompletionRate.textContent = `${completionPercent}%`;
    if (kpiProgressFill) kpiProgressFill.style.width = `${Math.min(100, completionPercent)}%`;

    const kpiTotalCheckins = document.getElementById('kpi-total-checkins');
    if (kpiTotalCheckins) kpiTotalCheckins.textContent = totalAchieved;

    const kpiDailyAvg = document.getElementById('kpi-daily-avg');
    if (kpiDailyAvg) {
      const isThisMonth = selectedYear === currentYear && selectedMonth === currentMonth;
      const elapsedDays = isThisMonth ? Math.max(1, currentDay) : daysCount;
      const avg = (totalAchieved / elapsedDays).toFixed(1);
      kpiDailyAvg.textContent = `${avg} / dia em média`;
    }

    const kpiBestStreak = document.getElementById('kpi-best-streak');
    const kpiStreakHabit = document.getElementById('kpi-streak-habit');
    if (kpiBestStreak) kpiBestStreak.textContent = `${overallBestStreak}d`;
    if (kpiStreakHabit) {
      kpiStreakHabit.textContent = overallBestHabitName ? `Recorde em ${overallBestHabitName}` : 'Nenhuma sequência';
    }

    const activeHabitsCount = state.habits.filter(h => h && h.trim().length > 0).length;
    const kpiActiveHabits = document.getElementById('kpi-active-habits');
    if (kpiActiveHabits) kpiActiveHabits.textContent = activeHabitsCount || 8;

    // Render Stat Cards
    statsGrid.innerHTML = '';
    for (let h = 0; h < HABITS_COUNT; h++) {
      const target = state.targets[h] || daysCount;
      const count = achieved[h];
      const progress = target > 0 ? Math.min(100, (count / target) * 100) : 0;
      const { currentStreak, bestStreak } = calculateHabitStreaks(monthCells, h, daysCount);

      const card = document.createElement('div');
      card.className = 'stat-card';

      const streakBadge = bestStreak > 0
        ? `<span class="stat-streak-badge" title="Sequência atual: ${currentStreak} dias | Melhor: ${bestStreak} dias">🔥 ${bestStreak}d</span>`
        : '';

      card.innerHTML = `
        <div class="stat-card-top">
          <div class="stat-header">
            <div class="habit-color-dot" style="background-color: ${colors[h]};"></div>
            <span>${state.habits[h]?.trim() || `Hábito #${h + 1}`}</span>
          </div>
          ${streakBadge}
        </div>
        <div class="stat-details">
          <span>Realizado: <strong>${count}</strong>/${target} dias (${Math.round(progress)}%)</span>
          <div>
            Meta: <input type="number" class="stat-goal-input" data-index="${h}" value="${target}" min="1" max="${daysCount}" />
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progress}%; background-color: ${colors[h]}"></div>
        </div>
      `;

      statsGrid.appendChild(card);
    }

    // Goal inputs listeners
    const inputs = statsGrid.querySelectorAll('.stat-goal-input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > daysCount) val = daysCount;
        state.targets[parseInt(e.target.dataset.index)] = val;
        saveState();
        renderStats();
      });
    });
  }

  function renderAll() {
    updateMonthHeader();
    renderWheel();
    renderStats();
  }

  // Clear cells button
  const clearBtn = document.getElementById('clear-cells-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const monthName = MONTH_NAMES_PT[selectedMonth];
      if (confirm(`Deseja limpar as marcações de ${monthName} de ${selectedYear}? Os nomes e metas serão mantidos.`)) {
        const key = getActiveMonthKey();
        state.months[key] = {};
        saveState();
        renderAll();
      }
    });
  }

  // Backup & Restore Dialog
  setupBackupModal(state, renderAll);

  // PDF Export Modal
  setupPdfModal({
    getState: () => ({
      habits: state.habits,
      targets: state.targets,
      cells: getActiveMonthCells()
    }),
    getMonthYearText: () => `${MONTH_NAMES_PT[selectedMonth]} de ${selectedYear}`,
    getDaysCount: () => getDaysInSelectedMonth(),
    getMonthKey: () => getActiveMonthKey()
  });

  // Initial Boot
  renderAll();
}

function setupBackupModal(state, onUpdate) {
  const backupBtn = document.getElementById('backup-btn');
  const modal = document.getElementById('backup-modal');
  const closeBtn = document.getElementById('backup-modal-close');
  const cancelBtn = document.getElementById('backup-modal-cancel');
  const exportBtn = document.getElementById('btn-export-json');
  const triggerImportBtn = document.getElementById('btn-trigger-import-json');
  const fileInput = document.getElementById('import-json-file');

  if (!backupBtn || !modal) return;

  const openModal = () => modal.classList.remove('hidden');
  const closeModal = () => modal.classList.add('hidden');

  backupBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Export JSON
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `roda-de-habitos-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  // Import JSON
  if (triggerImportBtn && fileInput) {
    triggerImportBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && (imported.habits || imported.months)) {
            if (imported.habits) state.habits = imported.habits;
            if (imported.targets) state.targets = imported.targets;
            if (imported.months) state.months = imported.months;
            localStorage.setItem('wheelOfHabitsState', JSON.stringify(state));
            alert('Backup importado com sucesso!');
            closeModal();
            onUpdate();
          } else {
            alert('O arquivo selecionado não contém um formato de backup válido.');
          }
        } catch (err) {
          alert('Erro ao carregar o arquivo JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
}

function setupPdfModal({ getState, getMonthYearText, getDaysCount, getMonthKey }) {
  const downloadBtn = document.getElementById('download-pdf-btn');
  const modal = document.getElementById('pdf-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const spinner = document.getElementById('modal-confirm-spinner');
  const confirmText = document.getElementById('modal-confirm-text');
  const includeStatsCheckbox = document.getElementById('pdf-include-stats');
  const hintText = document.getElementById('pdf-modal-hint-text');

  if (!downloadBtn || !modal) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    confirmBtn.disabled = false;
    spinner.classList.add('hidden');
    confirmText.textContent = 'Baixar PDF';
    if (hintText) {
      hintText.textContent = `O PDF será gerado em formato A4 de alta resolução para ${getMonthYearText()}.`;
    }
  };

  const closeModal = () => modal.classList.add('hidden');

  downloadBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      try {
        confirmBtn.disabled = true;
        spinner.classList.remove('hidden');
        confirmText.textContent = 'Gerando PDF...';

        const selectedThemeRadio = document.querySelector('input[name="pdf-theme"]:checked');
        const theme = selectedThemeRadio ? selectedThemeRadio.value : 'dark';
        const includeStats = includeStatsCheckbox ? includeStatsCheckbox.checked : true;

        const monthKey = getMonthKey();
        const fileName = `roda-de-habitos-${monthKey}.pdf`;

        await generateAndDownloadPdf({
          state: getState(),
          theme,
          daysCount: getDaysCount(),
          monthYearText: getMonthYearText(),
          includeStats,
          title: 'Roda de Hábitos',
          subtitle: 'Faça o seu melhor, todos os dias',
          fileName
        });

        setTimeout(() => {
          closeModal();
        }, 500);
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        alert('Ocorreu um erro ao gerar o PDF. Verifique o console para mais detalhes.');
        confirmBtn.disabled = false;
        spinner.classList.add('hidden');
        confirmText.textContent = 'Baixar PDF';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);
