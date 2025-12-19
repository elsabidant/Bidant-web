"use strict";

// ---- Clean data ----

// Remove json markdown
function stripCodeFence(cell) {
  if (!cell) return null;
  let s = String(cell).trim();
  if (!s) return null;

  if (s.startsWith("```")) {
    const lines = s.split("\n");
    // Remove first line (``` or ```json)
    lines.shift();
    // Remove last line if it's another ```
    if (lines.length && lines[lines.length - 1].trim().startsWith("```")) {
      lines.pop();
    }
    s = lines.join("\n").trim();
  }
  return s || null;
}

// Parse a JSON-encoded list ans returns an array or null if parsing fails
function parseJsonList(cell) {
  const cleaned = stripCodeFence(cell);
  if (!cleaned) return null;
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

// scape HTML special characters to safely inject text into innerHTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Format the evaluation outcomes */
function formatOutcome(raw) {
  if (raw == null) return "n/a";

  let val = raw;

  if (typeof val === "string") {
    const s = val.trim();
    const upper = s.toUpperCase();

    if (upper === "NA" || upper === "OUTCOME=NA") {
      return "n/a";
    }

    const match = s.match(/-?\d+(\.\d+)?/);
    if (match) {
      val = +match[0];
    } else {
      return "n/a";
    }
  }

  if (typeof val !== "number" || !Number.isFinite(val)) {
    return "n/a";
  }

  // In this dataset: positive = "True", zero = "False"
  const sym = val > 0 ? "True" : "False";
  return `${sym} (${val})`;
}

// Parse a list of outcomes from past_outcomes + present_outcomes columns
function parseOutcomeList(cell) {
  if (cell == null) return [];

  let s = String(cell).trim();
  if (!s) return [];

  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }

  // Remove brackets and then split on commas, semicolons or spaces
  s = s.replace(/[\[\]]/g, " ");
  const rawTokens = s.split(/[,\s;]+/).filter((t) => t.length > 0);

  return rawTokens.map((tok) => {
    const upper = tok.toUpperCase();
    if (upper === "NA" || upper === "OUTCOME=NA") {
      return null;
    }
    const m = tok.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    const num = +m[0];
    return Number.isFinite(num) ? num : null;
  });
}

// ---- Film details panel ----

// Detail panel for a selected film
function renderFilmDetails(film) {
  const container = document.getElementById("film-details");
  if (!container) return;

  // No film selected -> hide panel and remove any content
  if (!film) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  container.style.display = "block";

  const yearLabel = Number.isFinite(film.year) ? ` (${film.year})` : "";
  const grossLabel = Number.isFinite(film.gross)
    ? new Intl.NumberFormat("en-US").format(film.gross) + " $"
    : "Unknown";

  const anticipLabel =
    film.anticipatory === true
      ? "Anticipatory film"
      : film.anticipatory === false
      ? "Non-anticipatory film"
      : null;

  const claimsArr = film.claimsArr || [];
  const pastOutArr = film.pastOutcomes || [];
  const presentOutArr = film.presentOutcomes || [];

  const maxClaims = 5;
  const nClaims = Math.min(maxClaims, claimsArr.length);

  const claimBlocks = [];

  // Build up to maxClaims claim blocks with past/present outcomes
  for (let i = 0; i < nClaims; i++) {
    const claim = claimsArr[i];
    const text =
      claim && claim.claim_text ? escapeHtml(claim.claim_text) : "(no text)";

    const pastOut = i < pastOutArr.length ? pastOutArr[i] : null;
    const presentOut = i < presentOutArr.length ? presentOutArr[i] : null;

    claimBlocks.push(`
      <div class="film-claim">
        <div class="film-claim-header">Claim ${i + 1}</div>
        <div class="film-claim-text">"${text}"</div>
        <div class="film-claim-outcomes">
          <div>At release : <strong>${formatOutcome(pastOut)}</strong></div>
          <div>Now : <strong>${formatOutcome(presentOut)}</strong></div>
        </div>
      </div>
    `);
  }

  let moreMsg = "";
  if (claimsArr.length > maxClaims) {
    moreMsg = `<p class="film-claims-more">(+ ${
      claimsArr.length - maxClaims
    } more claims in the dataset)</p>`;
  }

  // Inject final HTML into the panel
  container.innerHTML = `
    <h3>${escapeHtml(film.title)}${yearLabel}</h3>
    <p class="film-meta">
      Prediction score : <strong>${film.score.toFixed(2)}</strong><br/>
      Worldwide gross (2020$) : <strong>${grossLabel}</strong><br/>
      ${anticipLabel ? `<span class="film-anticip">${anticipLabel}</span>` : ""}
    </p>
    <div class="film-claims-wrapper">
      ${
        claimBlocks.length
          ? claimBlocks.join("")
          : "<p><em>No structured claims available.</em></p>"
      }
      ${moreMsg}
    </div>
  `;
}

// ---- Data loading & scatterplot ----

(async function () {
  const raw = await d3.csv("/static/data/annotated_film_score.csv");

  // Map raw rows into structured film objects
  const films = raw
    .map((d) => {
      const year = d.year ? +d.year : NaN;
      const score = d.prediction_score != null ? +d.prediction_score : NaN;
      const gross = d.worldwide_gross_income_2020
        ? +d.worldwide_gross_income_2020
        : NaN;

      const claimsArr = parseJsonList(d.claims_json) || [];
      const pastOutcomes = parseOutcomeList(d.past_outcomes);
      const presentOutcomes = parseOutcomeList(d.present_outcomes);

      const anticipRaw = d.anticipatory;
      const anticip =
        anticipRaw === "1" || anticipRaw === 1
          ? true
          : anticipRaw === "0" || anticipRaw === 0
          ? false
          : null;

      return {
        title: d.title || d.imdb || "Unknown title",
        year,
        score,
        gross,
        anticipatory: anticip,
        claimsArr,
        pastOutcomes,
        presentOutcomes,
      };
    })
    // Keep only films that have both year and prediction score
    .filter((f) => Number.isFinite(f.year) && Number.isFinite(f.score));

  if (!films.length) {
    console.warn("No usable films (year + prediction_score).");
    renderFilmDetails(null);
    return;
  }

  drawScatter(films);
})();

// Draw scatterplot of films (year vs prediction_score)
function drawScatter(data) {
  const svg = d3.select("#film-scatter");
  if (svg.empty()) {
    console.warn("#film-scatter not found.");
    return;
  }

  // Hide details panel initially (no film selected)
  renderFilmDetails(null);

  // Layout settings
  const margin = { top: 12, right: 28, bottom: 40, left: 50 };
  const width = 820;
  const height = 260;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Group films by identical (year, score) pairs
  const groupsByKey = d3.group(data, (d) => `${d.year}-${d.score.toFixed(3)}`);
  const jitterRadius = 5;

  // Assign a small offset (jx, jy) around the central point when several films share the same position
  for (const group of groupsByKey.values()) {
    const n = group.length;
    if (n === 1) {
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

  const xExtent = d3.extent(data, (d) => d.year);
  const xPad = 0.5;

  const x = d3
    .scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .nice()
    .range([0, innerW]);

  const yExtent = d3.extent(data, (d) => d.score);
  const yPad = 0.05 * (yExtent[1] - yExtent[0] || 1);

  const y = d3
    .scaleLinear()
    .domain([yExtent[0] - yPad, yExtent[1] + yPad])
    .nice()
    .range([innerH, 0]);

  const xAxis = d3
    .axisBottom(x)
    .ticks(6)
    .tickFormat(d3.format("d"))
    .tickPadding(6);

  const yAxis = d3.axisLeft(y).ticks(5).tickPadding(6);

  // Axes
  g.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(xAxis);

  g.append("g").attr("class", "axis y-axis").call(yAxis);

  // Axis labels
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 35)
    .attr("text-anchor", "middle")
    .attr("fill", "#f6f6f9")
    .attr("font-size", 12)
    .text("Release year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -40)
    .attr("text-anchor", "middle")
    .attr("fill", "#f6f6f9")
    .attr("font-size", 12)
    .text("Prediction score");

  // Source
  g.append("text")
    .attr("x", innerW)
    .attr("y", innerH + 40)
    .attr("text-anchor", "end")
    .attr("fill", "#aab")
    .attr("font-size", 9)
    .text("Source : IMDb dataset, 2020");

  //Horizontal grid lines
  const baseGridTicks = y.ticks(4);
  let gridTicks = baseGridTicks.slice(0, -1);

  const refTick = 1.0;
  if (
    refTick >= y.domain()[0] &&
    refTick <= y.domain()[1] &&
    !gridTicks.includes(refTick)
  ) {
    gridTicks = [...gridTicks, refTick].sort((a, b) => a - b);
  }

  const yGridAxis = d3
    .axisLeft(y)
    .tickValues(gridTicks)
    .tickSize(-innerW)
    .tickFormat("");

  const grid = g.append("g").attr("class", "grid");
  grid.call(yGridAxis);
  grid.selectAll("line").attr("stroke-opacity", 0.12);
  grid.select(".domain").remove();

  // Points
  const dots = g
    .selectAll("circle.dot")
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
    .attr("cx", (d) => x(d.year) + (d.jx || 0))
    .attr("cy", (d) => y(d.score) + (d.jy || 0));

  // Click on a point -> highlight it and show details panel
  dots.on("click", function (event, d) {
    dots.classed("selected", false);
    d3.select(this).classed("selected", true);
    renderFilmDetails(d);
    event.stopPropagation();
  });

  // Click on empty SVG area -> deselect and hide details
  svg.on("click", function () {
    dots.classed("selected", false);
    renderFilmDetails(null);
  });
}
