"use strict";

const raw = await d3.csv("../static/data/full_annotated_film_score.csv");

function parseNum(v) {
  if (v == null || v === "") return NaN;
  const num = +String(v).replace(/[^0-9.-]/g, "");
  return Number.isFinite(num) ? num : NaN;
}

const COL = {
  year: "year",
  score: "score",
  box: "worldwide_gross_income_2020",
  budget: "budget_2020",
};

const movies = raw
  .map((d) => ({
    year: parseNum(d[COL.year]),
    score: parseNum(d[COL.score]),
    box: parseNum(d[COL.box]),
    budget: parseNum(d[COL.budget]),
  }))
  .filter((d) => Number.isFinite(d.year));

// Dimensions
const width = 460;
const height = 260;
const margin = { top: 52, right: 18, bottom: 58, left: 70 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

// Helpers
function getSvg(id) {
  const sel = d3.select(id);
  if (sel.empty()) return null;
  sel.selectAll("*").remove();
  sel
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  sel.style("shape-rendering", "crispEdges");
  return sel;
}

function createFigure(svg, figTitle) {
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("text")
    .attr("x", 0)
    .attr("y", -26)
    .attr("fill", "#f6f6f9")
    .attr("font-size", 13)
    .attr("font-weight", 700)
    .text(figTitle);

  return g;
}

function addGridY(g, y) {
  const grid = g
    .append("g")
    .attr("class", "grid-y")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""));
  grid.select(".domain").remove();

  grid.selectAll(".tick line").attr("stroke-opacity", 0.25);

  grid
    .selectAll(".tick")
    .filter(function () {
      return d3.select(this).attr("transform") === "translate(0,0)";
    })
    .select("line")
    .attr("stroke-opacity", 0.25);
}

function addAxisLabels(g, xLabel, yLabel) {
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 46)
    .attr("text-anchor", "middle")
    .attr("fill", "#aab")
    .attr("font-size", 12)
    .text(xLabel);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -52)
    .attr("text-anchor", "middle")
    .attr("fill", "#aab")
    .attr("font-size", 12)
    .text(yLabel);
}

function drawCountPlot({
  svgId,
  figTitle,
  values,
  order = null,
  xLabel,
  yLabel = "Films (count)",
}) {
  const svg = getSvg(svgId);
  if (!svg) return;

  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return;

  const countsMap = d3.rollups(
    clean,
    (v) => v.length,
    (d) => d
  );

  let cats = countsMap.map((d) => d[0]);
  if (order) cats = order.filter((k) => cats.includes(k));
  else cats.sort(d3.ascending);

  const data = cats.map((k) => ({
    key: k,
    count: countsMap.find((x) => x[0] === k)?.[1] ?? 0,
  }));

  const g = createFigure(svg, figTitle);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => String(d.key)))
    .range([0, innerW])
    .padding(0.18);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.count) || 0])
    .nice()
    .range([innerH, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  g.append("g").call(d3.axisLeft(y).ticks(5));

  addGridY(g, y);

  g.selectAll("rect.bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(String(d.key)))
    .attr("y", (d) => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", (d) => Math.max(0, innerH - y(d.count) - 1));

  addAxisLabels(g, xLabel, yLabel);
}

function drawHistogram({
  svgId,
  figTitle,
  values,
  binsCount = 22,
  xTickFormat = null,
  xLabel,
  yLabel = "Count",
}) {
  const svg = getSvg(svgId);
  if (!svg) return;

  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return;

  const g = createFigure(svg, figTitle);

  const x = d3.scaleLinear().domain(d3.extent(clean)).nice().range([0, innerW]);
  const bins = d3.bin().domain(x.domain()).thresholds(binsCount)(clean);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length) || 0])
    .nice()
    .range([innerH, 0]);

  const xAxis = d3.axisBottom(x).ticks(6);
  if (xTickFormat) xAxis.tickFormat(xTickFormat);

  g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
  g.append("g").call(d3.axisLeft(y).ticks(5));

  addGridY(g, y);

  g.selectAll("rect.bar")
    .data(bins)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.x0))
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", (d) => Math.max(0, innerH - y(d.length) - 1));

  addAxisLabels(g, xLabel, yLabel);
}

function drawYearCounts({ svgId, figTitle }) {
  const svg = getSvg(svgId);
  if (!svg) return;

  const yearCounts = d3
    .rollups(
      movies.filter((d) => Number.isFinite(d.year)),
      (v) => v.length,
      (d) => d.year
    )
    .sort((a, b) => d3.ascending(a[0], b[0]));

  if (!yearCounts.length) return;

  const years = yearCounts.map((d) => d[0]);
  const counts = yearCounts.map((d) => d[1]);

  const g = createFigure(svg, figTitle);

  const x = d3.scaleBand().domain(years).range([0, innerW]).padding(0.12);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(counts) || 0])
    .nice()
    .range([innerH, 0]);

  const step = Math.max(1, Math.ceil(years.length / 8));
  const tickYears = years.filter((_, i) => i % step === 0);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickSizeOuter(0));

  g.append("g").call(d3.axisLeft(y).ticks(5));

  addGridY(g, y);

  g.selectAll("rect.bar")
    .data(yearCounts)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d[0]))
    .attr("y", (d) => y(d[1]))
    .attr("width", x.bandwidth())
    .attr("height", (d) => Math.max(0, innerH - y(d[1]) - 1));

  addAxisLabels(g, "Release year", "Films (count)");
}

function makeToggle(controlsId, options, onChange, defaultKey) {
  const root = d3.select(controlsId);
  if (root.empty()) return;

  root.selectAll("*").remove();

  const wrap = root.append("div").attr("class", "plot-toggle");
  const state = { key: defaultKey };

  options.forEach((opt) => {
    wrap
      .append("button")
      .attr("type", "button")
      .attr("class", `toggle-btn ${opt.key === defaultKey ? "is-active" : ""}`)
      .text(opt.label)
      .on("click", function () {
        state.key = opt.key;
        wrap.selectAll("button").classed("is-active", false);
        d3.select(this).classed("is-active", true);
        onChange(state.key);
      });
  });
}

// FIGURES

drawCountPlot({
  svgId: "#score-plot",
  figTitle: "Figure 1.a — Distribution of prediction scores",
  values: movies.map((d) => d.score).filter((v) => Number.isFinite(v)),
  xLabel: "Prediction score (0–5)",
  yLabel: "Films (count)",
});

drawYearCounts({
  svgId: "#year-plot",
  figTitle: "Figure 1.b — Films per release year",
});

function renderBox(mode) {
  const vals = movies
    .map((d) => d.box)
    .filter((v) => Number.isFinite(v) && v > 0);

  const values = mode === "log" ? vals.map((v) => Math.log10(v)) : vals;

  drawHistogram({
    svgId: "#boxoffice-plot",
    figTitle: `Figure 1.c — Worldwide box office (${
      mode === "log" ? "log10" : "raw"
    })`,
    values,
    binsCount: 22,
    xTickFormat: mode === "log" ? d3.format(".2f") : d3.format("$.2s"),
    xLabel: mode === "log" ? "log10 Box office (2020$)" : "Box office (2020$)",
    yLabel: "Films (count)",
  });
}

makeToggle(
  "#boxoffice-controls",
  [
    { key: "raw", label: "Box office (raw)" },
    { key: "log", label: "Box office (log10)" },
  ],
  renderBox,
  "raw"
);
renderBox("raw");

function renderBudget(mode) {
  const vals = movies
    .map((d) => d.budget)
    .filter((v) => Number.isFinite(v) && v > 0);

  const values = mode === "log" ? vals.map((v) => Math.log10(v)) : vals;

  drawHistogram({
    svgId: "#budget-plot",
    figTitle: `Figure 1.d — Budget (${mode === "log" ? "log10" : "raw"})`,
    values,
    binsCount: 22,
    xTickFormat: mode === "log" ? d3.format(".2f") : d3.format("$.2s"),
    xLabel: mode === "log" ? "log10 Budget (2020$)" : "Budget (2020$)",
    yLabel: "Films (count)",
  });
}

makeToggle(
  "#budget-controls",
  [
    { key: "raw", label: "Budget (raw)" },
    { key: "log", label: "Budget (log10)" },
  ],
  renderBudget,
  "raw"
);
renderBudget("raw");

// Source
const figureRoot = document.querySelector(".chart-wrap.variables");
if (figureRoot && !figureRoot.querySelector(".figure-source")) {
  const source = document.createElement("div");
  source.className = "figure-source";
  source.textContent = "Source: IMDb dataset, 2020";
  figureRoot.appendChild(source);
}
