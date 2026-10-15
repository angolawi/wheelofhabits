import { jsPDF } from 'jspdf';

const HABITS_COUNT = 8;
const CENTER_X = 500;
const CENTER_Y = 500;
const INNER_RADIUS = 150;
const RING_WIDTH = 35;
const OUTER_RADIUS = INNER_RADIUS + (HABITS_COUNT * RING_WIDTH);
const TOTAL_ANGLE_DEG = 270;

// GitHub Dark Palette
export const GITHUB_DARK_COLORS = [
  '#196c2e', // Habit 1
  '#238636', // Habit 2
  '#2ea043', // Habit 3
  '#26a641', // Habit 4
  '#34b854', // Habit 5
  '#39d353', // Habit 6
  '#56d364', // Habit 7
  '#7ee787'  // Habit 8
];

// GitHub Light Palette (Printer-friendly)
export const GITHUB_LIGHT_COLORS = [
  '#19542a', // Habit 1 - Deep Forest
  '#216e39', // Habit 2 - Classic GH Level 4
  '#288842', // Habit 3
  '#30a14e', // Habit 4 - Classic GH Level 3
  '#34b854', // Habit 5
  '#40c463', // Habit 6 - Classic GH Level 2
  '#6fd98b', // Habit 7
  '#9be9a8'  // Habit 8 - Classic GH Level 1
];

// GitHub 4 Levels
export const GITHUB_DARK_LEVELS = [
  '#161b22', // Level 0 (empty)
  '#0e4429', // Level 1
  '#006d32', // Level 2
  '#26a641', // Level 3
  '#39d353'  // Level 4
];

export const GITHUB_LIGHT_LEVELS = [
  '#ebedf0', // Level 0 (empty)
  '#9be9a8', // Level 1
  '#40c463', // Level 2
  '#30a14e', // Level 3
  '#216e39'  // Level 4
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

  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ` +
         `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} ` +
         `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} ` +
         `L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} ` +
         `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
}

/**
 * Calculates current and best streaks for a given habit
 */
export function calculateHabitStreaks(cells, habitIndex, daysCount) {
  let currentStreak = 0;
  let bestStreak = 0;
  let running = 0;

  for (let d = 0; d < daysCount; d++) {
    const key = `d${d}-h${habitIndex}`;
    if (cells && cells[key]) {
      running++;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  // Count backwards from current day or last checked for current active streak
  let currentRunning = 0;
  for (let d = daysCount - 1; d >= 0; d--) {
    const key = `d${d}-h${habitIndex}`;
    if (cells && cells[key]) {
      currentRunning++;
    } else if (currentRunning > 0) {
      break;
    }
  }
  currentStreak = currentRunning;

  return { currentStreak, bestStreak };
}

/**
 * Builds a 100% self-contained standalone SVG string without foreignObject
 * that renders reliably on any canvas and in jsPDF.
 */
export function buildExportSvg(state, { theme = 'dark', daysCount = 31 } = {}) {
  const isLight = theme === 'light';
  const colors = isLight ? GITHUB_LIGHT_COLORS : GITHUB_DARK_COLORS;
  const levels = isLight ? GITHUB_LIGHT_LEVELS : GITHUB_DARK_LEVELS;

  const bgColor = isLight ? '#ffffff' : '#0d1117';
  const gridLineColor = isLight ? '#d0d7de' : '#30363d';
  const emptyCellColor = isLight ? '#f6f8fa' : '#161b22';
  const cellBorderColor = isLight ? '#d0d7de' : '#30363d';
  const activeBorderColor = isLight ? 'rgba(27, 31, 36, 0.4)' : 'rgba(255, 255, 255, 0.4)';
  const textColor = isLight ? '#24292f' : '#f0f6fc';
  const dayLabelColor = isLight ? '#57606a' : '#8b949e';

  const lineLeftEdge = 20;
  const anglePerDay = TOTAL_ANGLE_DEG / daysCount;

  let elements = '';

  // Background rect
  elements += `<rect width="1000" height="1000" fill="${bgColor}" />`;

  // Horizontal habit grid lines on the left
  for (let h = 0; h <= HABITS_COUNT; h++) {
    const r = INNER_RADIUS + (h * RING_WIDTH);
    const y = CENTER_Y - r;
    elements += `<line x1="${lineLeftEdge}" y1="${y}" x2="${CENTER_X}" y2="${y}" stroke="${gridLineColor}" stroke-width="1.5" />`;
  }

  // Habit labels and color dots (native SVG, no foreignObject)
  for (let h = 0; h < HABITS_COUNT; h++) {
    const rIn = INNER_RADIUS + (h * RING_WIDTH);
    const rOut = INNER_RADIUS + ((h + 1) * RING_WIDTH);
    const yCenter = CENTER_Y - ((rIn + rOut) / 2);
    const habitColor = colors[h];
    const rawName = state.habits?.[h] || '';
    const habitName = (rawName.trim() || `Hábito #${h + 1}`)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Color dot (circle)
    elements += `<circle cx="478" cy="${yCenter}" r="5.5" fill="${habitColor}" />`;

    // Habit text label
    elements += `<text x="464" y="${yCenter + 1}" text-anchor="end" dominant-baseline="central" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="600">${habitName}</text>`;
  }

  // Days and cells
  for (let d = 0; d < daysCount; d++) {
    const startAngle = d * anglePerDay;
    const endAngle = (d + 1) * anglePerDay;

    // Cells for this day
    for (let h = 0; h < HABITS_COUNT; h++) {
      const rInner = INNER_RADIUS + (h * RING_WIDTH);
      const rOuter = rInner + RING_WIDTH;
      const pathD = createCellPath(rInner, rOuter, startAngle, endAngle);

      const cellId = `d${d}-h${h}`;
      const cellVal = state.cells?.[cellId];

      let fillColor = emptyCellColor;
      let strokeColor = cellBorderColor;

      if (cellVal) {
        if (typeof cellVal === 'number' && cellVal >= 1 && cellVal <= 4) {
          fillColor = levels[cellVal];
        } else {
          fillColor = colors[h];
        }
        strokeColor = activeBorderColor;
      }

      elements += `<path d="${pathD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" />`;
    }

    // Day labels
    const midAngle = startAngle + (anglePerDay / 2);
    const labelRad = OUTER_RADIUS + 25;
    const aRad = (midAngle - 90) * (Math.PI / 180);
    const lx = CENTER_X + labelRad * Math.cos(aRad);
    const ly = CENTER_Y + labelRad * Math.sin(aRad);

    elements += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${midAngle.toFixed(2)}, ${lx.toFixed(2)}, ${ly.toFixed(2)})" fill="${dayLabelColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="600">${d + 1}</text>`;

    // Radial lines
    const rad = (startAngle - 90) * (Math.PI / 180);
    const rStartX = CENTER_X + INNER_RADIUS * Math.cos(rad);
    const rStartY = CENTER_Y + INNER_RADIUS * Math.sin(rad);
    const rEndX = CENTER_X + OUTER_RADIUS * Math.cos(rad);
    const rEndY = CENTER_Y + OUTER_RADIUS * Math.sin(rad);

    elements += `<line x1="${rStartX.toFixed(2)}" y1="${rStartY.toFixed(2)}" x2="${rEndX.toFixed(2)}" y2="${rEndY.toFixed(2)}" stroke="${gridLineColor}" stroke-width="1.5" />`;

    // Final closing line for the last day
    if (d === daysCount - 1) {
      const endRad = (endAngle - 90) * (Math.PI / 180);
      const fStartX = CENTER_X + INNER_RADIUS * Math.cos(endRad);
      const fStartY = CENTER_Y + INNER_RADIUS * Math.sin(endRad);
      const fEndX = CENTER_X + OUTER_RADIUS * Math.cos(endRad);
      const fEndY = CENTER_Y + OUTER_RADIUS * Math.sin(endRad);

      elements += `<line x1="${fStartX.toFixed(2)}" y1="${fStartY.toFixed(2)}" x2="${fEndX.toFixed(2)}" y2="${fEndY.toFixed(2)}" stroke="${gridLineColor}" stroke-width="1.5" />`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    </style>
  </defs>
  ${elements}
</svg>`;
}

/**
 * Converts the generated SVG string into a high-resolution PNG data URL
 */
export function svgToPngDataUrl(svgString, scale = 2.5) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(1000 * scale);
        canvas.height = Math.round(1000 * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into image: ' + e));
    };

    img.src = url;
  });
}

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * Generates and downloads a complete, beautiful A4 PDF
 */
export async function generateAndDownloadPdf({
  state,
  theme = 'dark',
  daysCount = 31,
  monthYearText = '',
  title = 'Roda de Hábitos',
  subtitle = 'Faça o seu melhor, todos os dias',
  fileName = 'roda-de-habitos.pdf'
} = {}) {
  const isLight = theme === 'light';
  const colors = isLight ? GITHUB_LIGHT_COLORS : GITHUB_DARK_COLORS;
  const levels = isLight ? GITHUB_LIGHT_LEVELS : GITHUB_DARK_LEVELS;

  // 1. Build crisp SVG and convert to PNG data URL
  const svgString = buildExportSvg(state, { theme, daysCount });
  const wheelPngUrl = await svgToPngDataUrl(svgString, 2.5);

  // 2. Initialize jsPDF (A4 Portrait: 210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = 210;
  const pageHeight = 297;

  // Background
  if (isLight) {
    doc.setFillColor(255, 255, 255);
  } else {
    doc.setFillColor(13, 17, 23); // GitHub Dark
  }
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Header Title
  const displayTitle = monthYearText ? `${title} • ${monthYearText}` : title;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  if (isLight) {
    doc.setTextColor(36, 41, 47);
  } else {
    doc.setTextColor(240, 246, 252);
  }
  doc.text(displayTitle, pageWidth / 2, 22, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (isLight) {
    doc.setTextColor(87, 96, 106);
  } else {
    doc.setTextColor(139, 148, 158);
  }
  doc.text(subtitle, pageWidth / 2, 29, { align: 'center' });

  // Place Centered & Enlarged Wheel Image
  const wheelSize = 180; // mm
  const wheelX = (pageWidth - wheelSize) / 2;
  const wheelY = 67;
  doc.addImage(wheelPngUrl, 'PNG', wheelX, wheelY, wheelSize, wheelSize, undefined, 'FAST');

  // Footer & Heatmap Legend
  const footerY = 280;

  // Heatmap Legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (isLight) {
    doc.setTextColor(87, 96, 106);
  } else {
    doc.setTextColor(139, 148, 158);
  }
  doc.text('Menos', 15, footerY + 2.5);

  const legendBoxSize = 3.2;
  const legendBoxGap = 1.2;
  let legendStartX = 26;

  for (let l = 0; l < levels.length; l++) {
    const lRgb = hexToRgb(levels[l]);
    doc.setFillColor(lRgb.r, lRgb.g, lRgb.b);
    if (isLight) {
      doc.setDrawColor(208, 215, 222);
    } else {
      doc.setDrawColor(48, 54, 61);
    }
    doc.roundedRect(legendStartX + l * (legendBoxSize + legendBoxGap), footerY, legendBoxSize, legendBoxSize, 0.5, 0.5, 'FD');
  }

  const legendTextX = legendStartX + levels.length * (legendBoxSize + legendBoxGap) + 1.8;
  doc.text('Mais', legendTextX, footerY + 2.5);

  // Footer right info
  const dateStr = monthYearText || new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const footerText = `Roda de Hábitos • GitHub Heatmap Edition • ${dateStr}`;

  doc.text(footerText, pageWidth - 15, footerY + 2.5, { align: 'right' });

  // Save PDF
  doc.save(fileName);
}
