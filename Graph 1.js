"use strict";

const raw = await d3.csv("annotated_film_score.csv");

function parseGross(value) {
  if (!value) return NaN;
  const num = +String(value).replace(/[^0-9.-]/g, "");
  return Number.isFinite(num) ? num : NaN;
}

const movies = raw
  .map((d) => ({
    year: +d.year,
    worldwide: parseGross(d.worldwide_gross_income_2020),
  }))
  .filter((d) => !Number.isNaN(d.year));

// Dimensions
const width = 460;
const height = 320;
const margin = { top: 32, right: 16, bottom: 50, left: 55 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

// SVG
function createSvg(selector, title) {
  const svg = d3
    .select(selector)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", -12)
    .attr("text-anchor", "middle")
    .attr("fill", "#f6f6f9")
    .attr("font-size", 13)
    .attr("font-weight", 600)
    .text(title);

  return g;
}

// Horizontal grid
function addHorizontalGrid(g, yScale) {
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW).tickFormat(""))
    .selectAll("line")
    .attr("stroke-opacity", 0.35);
}

// ---- Graph 1 : film per year ----
function drawYearChart() {
  const yearCounts = d3
    .rollups(
      movies.filter((d) => !Number.isNaN(d.year)),
      (v) => v.length,
      (d) => d.year
    )
    .sort((a, b) => d3.ascending(a[0], b[0]));

  const years = yearCounts.map((d) => d[0]);
  const counts = yearCounts.map((d) => d[1]);

  const x = d3.scaleBand().domain(years).range([0, innerW]).padding(0.1);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(counts) || 0])
    .nice()
    .range([innerH, 0]);

  const g = createSvg("#year-plot", "Films per year");

  const step = Math.max(1, Math.ceil(years.length / 8));
  const tickYears = years.filter((_, i) => i % step === 0);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickValues(tickYears).tickSizeOuter(0));

  g.append("g").call(d3.axisLeft(y).ticks(5));

  addHorizontalGrid(g, y);

  g.selectAll("rect.bar")
    .data(yearCounts)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d[0]))
    .attr("y", (d) => y(d[1]))
    .attr("width", x.bandwidth())
    .attr("height", (d) => innerH - y(d[1]));
}

// ---- Graph 2 : box-office distribution ----
function drawGrossChart() {
  const values = movies
    .map((d) => d.worldwide)
    .filter((v) => Number.isFinite(v) && v > 0);

  if (!values.length) return;
  const upper = d3.quantile(values, 1);

  const x = d3.scaleLinear().domain([0, upper]).nice().range([0, innerW]);

  const bins = d3.bin().domain(x.domain()).thresholds(20)(values);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length) || 0])
    .nice()
    .range([innerH, 0]);

  const g = createSvg("#gross-plot", "Worldwide box office");

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("$.2s")));

  g.append("g").call(d3.axisLeft(y).ticks(5));

  addHorizontalGrid(g, y);

  g.selectAll("rect.bar")
    .data(bins)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.x0))
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", (d) => innerH - y(d.length));
}

// Graphs
drawYearChart();
drawGrossChart();
