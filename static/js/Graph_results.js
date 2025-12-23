"use strict";

// Theme helpers
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

const THEME = {
  bg: cssVar("--bg", "#0d0d10"),
  ink: cssVar("--ink", "#f6f6f9"),
  muted: cssVar("--muted", "#aab"),
  line: cssVar("--line", "#1a1a25"),
  panel: cssVar("--panel", "#121218"),
  accent: cssVar("--accent", "#8e24aa"),
};

// Centralized plot colors
const COLORS = {
  zero: THEME.accent,
  grid: "rgba(255,255,255,0.10)",
  ci: THEME.ink,
  point: THEME.accent,
  text: THEME.ink,
  axis: "rgba(255,255,255,0.18)",
};

const file = "../static/data/regression_results.csv";

// Utils
function toNum(v) {
  const n = +String(v).trim();
  return Number.isFinite(n) ? n : NaN;
}

function fmtP(p) {
  if (!Number.isFinite(p)) return "NA";
  if (p < 1e-3) return "< 0.001";
  return p.toFixed(3);
}

// Layout
const margin = { top: 34, right: 40, bottom: 64, left: 240 };
const width = 1100;
const rowH = 100;

// Load + parse
const raw = await d3.csv(file);

const data = raw
  .map((d) => ({
    term: d.term,
    estimate: toNum(d.estimate),
    ci_low: toNum(d.ci_low),
    ci_high: toNum(d.ci_high),
    p_value: toNum(d.p_value),
  }))
  .filter(
    (d) => d.term && [d.estimate, d.ci_low, d.ci_high].every(Number.isFinite)
  );

// Sort by effect size
data.sort((a, b) => Math.abs(b.estimate) - Math.abs(a.estimate));

// Dimensions
const height = margin.top + margin.bottom + data.length * rowH;
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

// SVG
const svg = d3.select("#results");
svg.selectAll("*").remove();

svg
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("width", width)
  .attr("height", height)
  .style("max-width", "100%")
  .style("height", "auto")
  .style("background", "transparent")
  .attr(
    "font-family",
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial"
  );

const g = svg
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Scales
const xMin = d3.min(data, (d) => d.ci_low);
const xMax = d3.max(data, (d) => d.ci_high);
const pad = 0.06 * (xMax - xMin || 1);

const x = d3
  .scaleLinear()
  .domain([xMin - pad, xMax + pad])
  .range([0, innerW])
  .nice();

const y = d3
  .scaleBand()
  .domain(data.map((d) => d.term))
  .range([0, innerH])
  .paddingInner(0.35);

// Axes
const xAxis = d3.axisBottom(x).ticks(7);

// Grid (subtle)
g.append("g")
  .attr("transform", `translate(0,${innerH})`)
  .call(d3.axisBottom(x).ticks(7).tickSize(-innerH).tickFormat(""))
  .call((sel) => sel.select(".domain").remove())
  .attr("opacity", 1)
  .selectAll("line")
  .attr("stroke", COLORS.grid);

g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);

// Y labels
const yAxisG = g
  .append("g")
  .call(d3.axisLeft(y).tickSize(0))
  .call((sel) => sel.select(".domain").remove());

yAxisG.selectAll(".tick text").attr("dx", "-0.6em");

// Style axis text/lines to match theme
g.selectAll(".tick text").attr("fill", COLORS.text).attr("font-size", 16);

g.selectAll(".domain, .tick line").attr("stroke", COLORS.axis);

// Zero line
g.append("line")
  .attr("x1", x(0))
  .attr("x2", x(0))
  .attr("y1", 0)
  .attr("y2", innerH)
  .attr("stroke", COLORS.zero)
  .attr("stroke-width", 2)
  .attr("stroke-dasharray", "7 7");

// Rows
const rows = g
  .append("g")
  .selectAll("g.row")
  .data(data)
  .join("g")
  .attr("class", "row")
  .attr("transform", (d) => `translate(0,${y(d.term)})`);

// CI lines
rows
  .append("line")
  .attr("x1", (d) => x(d.ci_low))
  .attr("x2", (d) => x(d.ci_high))
  .attr("y1", y.bandwidth() / 2)
  .attr("y2", y.bandwidth() / 2)
  .attr("stroke", COLORS.ci)
  .attr("stroke-width", 6)
  .attr("stroke-linecap", "round")
  .attr("opacity", 0.95);

// Caps
const cap = 10;

rows
  .append("line")
  .attr("x1", (d) => x(d.ci_low))
  .attr("x2", (d) => x(d.ci_low))
  .attr("y1", y.bandwidth() / 2 - cap)
  .attr("y2", y.bandwidth() / 2 + cap)
  .attr("stroke", COLORS.ci)
  .attr("stroke-width", 5);

rows
  .append("line")
  .attr("x1", (d) => x(d.ci_high))
  .attr("x2", (d) => x(d.ci_high))
  .attr("y1", y.bandwidth() / 2 - cap)
  .attr("y2", y.bandwidth() / 2 + cap)
  .attr("stroke", COLORS.ci)
  .attr("stroke-width", 5);

// Point estimate (circle)
rows
  .append("circle")
  .attr("cx", (d) => x(d.estimate))
  .attr("cy", y.bandwidth() / 2)
  .attr("r", 10)
  .attr("fill", COLORS.point)
  .attr("stroke", "rgba(255,255,255,0.85)")
  .attr("stroke-width", 1.5);

// X-axis label
svg
  .append("text")
  .attr("x", margin.left + innerW / 2)
  .attr("y", height - 10)
  .attr("text-anchor", "middle")
  .attr("font-size", 16)
  .attr("fill", COLORS.text)
  .text("Coefficient (β) and 95% confidence interval");
