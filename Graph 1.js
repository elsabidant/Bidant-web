"use strict";

// plot
const data = await d3.csv("babel_full_annotated.csv");

// cleaning data
const clean = data.filter(
  (r) =>
    r.genre !== undefined &&
    r.genre !== null &&
    String(r.genre).trim() !== "" &&
    String(r.genre).toLowerCase() !== "nan"
);

// count
const genreCount = d3.rollups(
  clean,
  (g) => g.length,
  (r) => r.genre
);

// transform the type of array
const genreCountObjects = genreCount.map(([key, value]) => ({
  genre: key,
  count: value,
}));

const subset = genreCountObjects
  .filter((d) => d.genre.toLowerCase() !== "na")
  .sort((a, b) => d3.descending(a.count, b.count))
  .slice(0, 15);

// plot the bar
let genre_barplot = d3.select("#barplot");

const width = 928;
const height = 600;
const margin = { top: 30, right: 20, bottom: 120, left: 30 };
const {
  top: marginTop,
  right: marginRight,
  bottom: marginBottom,
  left: marginLeft,
} = margin;
const innerW = width - marginLeft - marginRight;
const innerH = height - marginTop - marginBottom;

const x = d3
  .scaleBand()
  .domain(subset.map((d) => d.genre))
  .range([marginLeft, width - marginRight])
  .padding(0.1);

const y = d3
  .scaleLinear()
  .domain([0, d3.max(subset, (d) => d.count)])
  .nice()
  .range([innerH, 0]);

genre_barplot
  .attr("viewBox", [0, 0, width, height])
  .attr("preserveAspectRatio", "xMidYMid meet");

const maingroup = genre_barplot
  .append("g")
  .attr("transform", `translate(${marginLeft},${marginTop})`);

// Y axis
const yaxis = d3.axisLeft(y);
maingroup.append("g").call(yaxis);

// X axis
const xaxis = d3.axisBottom(x);

// rotate the text
maingroup
  .append("g")
  .call(xaxis)
  .attr("transform", `translate(0,${innerH})`)
  .selectAll("text")
  .attr("text-anchor", "end")
  .attr("transform", "rotate(-35)")
  .attr("dx", "-0.5em")
  .attr("dy", "0.25em");

//  bars
maingroup
  .selectAll("rect.bar")
  .data(subset)
  .join("rect")
  .attr("class", "bar")
  .attr("x", (d) => x(d.genre))
  .attr("y", (d) => y(d.count))
  .attr("width", x.bandwidth())
  .attr("height", (d) => innerH - y(d.count))
  .attr("fill", "purple");
