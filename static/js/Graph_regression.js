"use strict";

// ---- Helpers ----

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtMoney(v) {
  if (!Number.isFinite(v)) return "Unknown";
  return new Intl.NumberFormat("en-US").format(v) + " $";
}

// ---- Film details panel ----

function renderFilmDetails(film) {
  const container = document.getElementById("film-details");
  if (!container) return;

  if (!film) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  container.style.display = "block";

  const yearLabel = Number.isFinite(film.year) ? ` (${film.year})` : "";
  const grossLabel = fmtMoney(film.boxoffice);
  const budgetLabel = fmtMoney(film.budget);

  const anticipLabel =
    film.anticipatory === true
      ? "Anticipatory film"
      : film.anticipatory === false
      ? "Non-anticipatory film"
      : null;

  const justification =
    film.scoreEvaluation && String(film.scoreEvaluation).trim().length
      ? String(film.scoreEvaluation).trim()
      : null;

  container.innerHTML = `
    <h3>${escapeHtml(film.title)}${yearLabel}</h3>
    <p class="film-meta">
      Prediction score: <strong>${
        Number.isFinite(film.score) ? film.score.toFixed(2) : "NA"
      }</strong><br/>
      Worldwide box office (2020$): <strong>${escapeHtml(
        grossLabel
      )}</strong><br/>
      Budget (2020$): <strong>${escapeHtml(budgetLabel)}</strong><br/>
      ${anticipLabel ? `<span class="film-anticip">${anticipLabel}</span>` : ""}
    </p>
    ${
      justification
        ? `<div class="film-claim">
             <div class="film-claim-header">Score justification</div>
             <div class="film-claim-text">${escapeHtml(justification)}</div>
           </div>`
        : `<p class="muted">No score justification available for this film.</p>`
    }
  `;
}

// ---- Data loading & scatterplot ----

(async function () {
  const raw = await d3.csv("../static/data/full_annotated_film_score.csv");

  const films = raw
    .map((d) => {
      const year = d.year ? +d.year : NaN;

      // MODIF : score = movie_based_score (au lieu de d.score)
      const score = d.movie_based_score != null ? +d.movie_based_score : NaN;

      const boxoffice =
        d.worldwide_gross_income_2020 != null
          ? +d.worldwide_gross_income_2020
          : NaN;

      const budget = d.budget_2020 != null ? +d.budget_2020 : NaN;

      const scoreEvaluation =
        d.score_evaluation != null ? String(d.score_evaluation) : "";

      const anticip =
        d.anticipatory_label != null && d.anticipatory_label !== ""
          ? +d.anticipatory_label === 1
          : null;

      return {
        title: d.title || d.imdb || "Unknown title",
        year,
        score,
        boxoffice,
        budget,
        scoreEvaluation,
        anticipatory: anticip,
      };
    })
    .filter(
      (f) =>
        Number.isFinite(f.score) &&
        Number.isFinite(f.boxoffice) &&
        f.boxoffice > 0
    );

  if (!films.length) {
    console.warn("No usable films (score + boxoffice).");
    renderFilmDetails(null);
    return;
  }

  drawScatter(films);
})();

// Draw scatterplot of films (score vs log boxoffice)
function drawScatter(data) {
  const svg = d3.select("#film-scatter");
  if (svg.empty()) {
    console.warn("#film-scatter not found.");
    return;
  }

  svg.selectAll("*").remove();

  const width = 940;
  const height = 520;
  const margin = { top: 28, right: 18, bottom: 58, left: 70 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ---- Jitter for overlapping points ----
  const jitterRadius = 7;

  const groupsByKey = d3.group(data, (d) => {
    const ly = Math.log10(d.boxoffice);
    return `${d.score.toFixed(3)}-${ly.toFixed(3)}`;
  });

  for (const group of groupsByKey.values()) {
    const n = group.length;
    if (n <= 1) {
      group[0].jx = 0;
      group[0].jy = 0;
    } else {
      group.forEach((d, i) => {
        const angle = (i / n) * 2 * Math.PI;
        d.jx = Math.cos(angle) * jitterRadius;
        d.jy = Math.sin(angle) * jitterRadius;
      });
    }
  }

  // X = score (linear)
  const xExtent = d3.extent(data, (d) => d.score);
  const xPad = 0.05 * (xExtent[1] - xExtent[0] || 1);

  const x = d3
    .scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .nice()
    .range([0, innerW]);

  // Y = boxoffice (log)
  const yExtent = d3.extent(data, (d) => d.boxoffice);
  const yDomain = [yExtent[0], yExtent[1]];

  const y = d3.scaleLog().domain(yDomain).range([innerH, 0]).nice();

  // tick formatting for money on log scale
  const si = d3.format(".2s");
  const moneyTick = (v) => {
    const s = si(v).replace("G", "B");
    return `$${s}`;
  };

  const xAxis = d3.axisBottom(x).ticks(6).tickPadding(6);

  const yAxis = d3
    .axisLeft(y)
    .ticks(6, "~s")
    .tickFormat(moneyTick)
    .tickPadding(6);

  // Axes
  g.append("g")
    .attr("class", "axis x")
    .attr("transform", `translate(0,${innerH})`)
    .call(xAxis);

  g.append("g").attr("class", "axis y").call(yAxis);

  // Axis labels
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "#f6f6f9")
    .attr("font-size", 12)
    .text("Prediction score");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .attr("fill", "#f6f6f9")
    .attr("font-size", 12)
    .text("Worldwide box office (2020, log scale)");

  // Source text (kept as-is)
  g.append("text")
    .attr("x", innerW)
    .attr("y", innerH + 40)
    .attr("text-anchor", "end")
    .attr("fill", "#aab")
    .attr("font-size", 9)
    .text("Source : IMDb dataset, 2020");

  // Horizontal grid lines
  const baseGridTicks = y.ticks(4);
  let gridTicks = baseGridTicks.slice(0, -1);

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).tickValues(gridTicks).tickSize(-innerW).tickFormat(""))
    .selectAll("line")
    .attr("stroke", "#ffffff")
    .attr("stroke-opacity", 0.12);

  g.select(".grid").select(".domain").remove();

  // ---- Dots ----
  const dots = g
    .append("g")
    .attr("class", "dots")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("class", (d) =>
      d.anticipatory === true
        ? "dot dot-anticipatory"
        : d.anticipatory === false
        ? "dot dot-non-anticipatory"
        : "dot"
    )
    .attr("r", 3.5)
    .attr("cx", (d) => x(d.score) + (d.jx || 0))
    .attr("cy", (d) => y(d.boxoffice) + (d.jy || 0));

  // Click on a point to show film details
  dots.on("click", function (event, d) {
    g.selectAll(".dot").classed("selected", false);
    d3.select(this).classed("selected", true);
    renderFilmDetails(d);
  });

  // Clear selection when clicking background
  svg.on("click", function (event) {
    if (event.target && event.target.tagName.toLowerCase() === "svg") {
      g.selectAll(".dot").classed("selected", false);
      renderFilmDetails(null);
    }
  });
}
