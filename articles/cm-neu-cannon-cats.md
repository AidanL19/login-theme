---
layout: default
is_article: true
title: "Learn about Cannon Cats"
description: "Cats love cannons. Learn all about it."
heading: "Cannons - Where Cats Love to Live"
subheading: "A look at the underworld of cats living in cannons."
date: 2025-07-19
---

<section class="cats-game" aria-labelledby="cats-title">
  <h1 id="cats-title">Cats</h1>
  <p class="cats-help">Place one cat per row so no two cats share a row, column, diagonal, or color region.</p>

  <div class="cats-board-wrap">
    <div id="board" class="cats-board" aria-label="cats board"></div>
  </div>

  <div class="cats-controls">
    <button id="resetBtn" type="button">Reset</button>
    <button id="newBtn" type="button">New Game</button>
  </div>

  <div id="msg" class="cats-message" aria-live="polite"></div>
</section>

<style>
  .cats-game {
    --cats-board-size: 560px;
    --cats-cell-size: 48px;
    max-width: 640px;
    margin: 0 auto;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
  }

  .cats-game h1 {
    margin: 0 0 8px;
    font: 700 38px/1.05 Georgia, "Times New Roman", serif;
  }

  .cats-help {
    margin: 0 0 16px;
    font-size: 16px;
  }

  .cats-board-wrap {
    width: 100%;
    max-width: var(--cats-board-size);
  }

  .cats-board {
    width: 100%;
    display: grid;
    border: 4px solid #000;
    box-sizing: border-box;
  }

  .cats-cell {
    width: var(--cats-cell-size);
    height: var(--cats-cell-size);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(0, 0, 0, 0.12);
    box-sizing: border-box;
    cursor: pointer;
    font-size: calc(var(--cats-cell-size) * 0.7);
    user-select: none;
  }

  .cats-cell.fixed {
    cursor: default;
  }

  .cats-cell.conflict {
    outline: 3px solid rgba(220, 30, 30, 0.85);
  }

  .cats-icon,
  .cats-forbid {
    pointer-events: none;
  }

  .cats-forbid {
    font-size: calc(var(--cats-cell-size) * 0.6);
    font-weight: 800;
  }

  .cats-controls {
    margin-top: 14px;
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .cats-controls button {
    padding: 8px 14px;
    border: 1px solid #777;
    border-radius: 6px;
    background: #fff;
    font-size: 16px;
    cursor: pointer;
  }

  .cats-message {
    min-height: 28px;
    margin-top: 12px;
    text-align: center;
    font: 700 22px/1.2 Georgia, "Times New Roman", serif;
  }

  @media (max-width: 768px) {
    .cats-game h1 {
      font-size: 32px;
    }

    .cats-help {
      font-size: 15px;
    }
  }
</style>

<script>
  (function () {
    function randint(a, b) {
      return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    function shuffle(arr) {
      const next = arr.slice();
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    }

    function solveNQueensOne(size) {
      const cols = new Set();
      const d1 = new Set();
      const d2 = new Set();
      const solution = [];
      let found = false;

      function backtrack(row) {
        if (found) return;
        if (row === size) {
          found = true;
          return;
        }

        for (let col = 0; col < size; col += 1) {
          if (cols.has(col) || d1.has(row - col) || d2.has(row + col)) continue;
          cols.add(col);
          d1.add(row - col);
          d2.add(row + col);
          solution[row] = col;
          backtrack(row + 1);
          if (found) return;
          cols.delete(col);
          d1.delete(row - col);
          d2.delete(row + col);
        }
      }

      backtrack(0);
      return found ? solution : null;
    }

    function buildRegions(size, solution) {
      const regionId = new Array(size).fill(0).map(function () {
        return new Array(size).fill(-1);
      });
      const colors = [];

      for (let i = 0; i < size; i += 1) {
        const hue = Math.floor((360 * i) / size);
        colors.push("hsl(" + hue + "deg 80% 65%)");
      }

      const queue = [];
      for (let row = 0; row < size; row += 1) {
        const col = solution[row];
        regionId[row][col] = row;
        queue.push([row, col, row]);
      }

      while (queue.length) {
        const idx = Math.floor(Math.random() * queue.length);
        const current = queue.splice(idx, 1)[0];
        const row = current[0];
        const col = current[1];
        const id = current[2];
        const neighbors = shuffle([
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1]
        ]);

        for (let i = 0; i < neighbors.length; i += 1) {
          const nr = neighbors[i][0];
          const nc = neighbors[i][1];
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          if (regionId[nr][nc] !== -1) continue;
          regionId[nr][nc] = id;
          queue.push([nr, nc, id]);
        }
      }

      return { regionId: regionId, colors: colors };
    }

    const boardEl = document.getElementById("board");
    const msgEl = document.getElementById("msg");
    const resetBtn = document.getElementById("resetBtn");
    const newBtn = document.getElementById("newBtn");
    const gameRoot = document.querySelector(".cats-game");
    const boardWrap = gameRoot.querySelector(".cats-board-wrap");

    let size;
    let regions;
    let startCats;
    let placedCats;
    let forbidden;

    function computeCellSize() {
      const available = Math.min(560, boardWrap.clientWidth || 560, Math.floor(window.innerWidth * 0.92));
      const boardSize = Math.max(240, available);
      const cellSize = Math.floor(boardSize / size);
      gameRoot.style.setProperty("--cats-board-size", boardSize + "px");
      gameRoot.style.setProperty("--cats-cell-size", cellSize + "px");
      boardEl.style.gridTemplateColumns = "repeat(" + size + ", " + cellSize + "px)";
      boardEl.style.gridTemplateRows = "repeat(" + size + ", " + cellSize + "px)";
    }

    function makeNewGame() {
      size = randint(8, 12);
      const solution = solveNQueensOne(size);
      if (!solution) {
        msgEl.textContent = "Could not generate a puzzle.";
        return;
      }
      regions = buildRegions(size, solution);
      computeCellSize();

      const clues = Math.max(1, Math.floor(size / 4));
      const clueRows = shuffle(Array.from({ length: size }, function (_, i) { return i; })).slice(0, clues);
      startCats = new Set();
      clueRows.forEach(function (row) {
        startCats.add(row + "," + solution[row]);
      });

      placedCats = new Set(startCats);
      forbidden = new Set();
      boardEl.innerHTML = "";

      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const key = row + "," + col;
          const cell = document.createElement("div");
          cell.className = "cats-cell";
          cell.dataset.r = String(row);
          cell.dataset.c = String(col);
          cell.style.background = regions.colors[regions.regionId[row][col]];

          if (startCats.has(key)) {
            cell.classList.add("fixed");
            cell.innerHTML = '<span class="cats-icon">🐱</span>';
            cell.setAttribute("aria-label", "fixed cat");
          }

          cell.addEventListener("click", onCellClick);
          boardEl.appendChild(cell);
        }
      }

      validateAndRender();
      msgEl.textContent = "";
    }

    function onCellClick(event) {
      const cell = event.currentTarget;
      if (cell.classList.contains("fixed")) return;
      const row = Number(cell.dataset.r);
      const col = Number(cell.dataset.c);
      const key = row + "," + col;

      if (placedCats.has(key)) {
        placedCats.delete(key);
      } else if (forbidden.has(key)) {
        forbidden.delete(key);
        placedCats.add(key);
      } else {
        forbidden.add(key);
      }

      validateAndRender();
    }

    function validateAndRender() {
      const cells = Array.from(boardEl.children);
      cells.forEach(function (cell) {
        cell.classList.remove("conflict");
      });

      const cats = Array.from(placedCats).map(function (entry) {
        return entry.split(",").map(Number);
      });
      const conflicts = new Set();

      for (let i = 0; i < cats.length; i += 1) {
        for (let j = i + 1; j < cats.length; j += 1) {
          const r1 = cats[i][0];
          const c1 = cats[i][1];
          const r2 = cats[j][0];
          const c2 = cats[j][1];
          const conflict =
            r1 === r2 ||
            c1 === c2 ||
            Math.abs(r1 - r2) === Math.abs(c1 - c2) ||
            regions.regionId[r1][c1] === regions.regionId[r2][c2];
          if (conflict) {
            conflicts.add(r1 + "," + c1);
            conflicts.add(r2 + "," + c2);
          }
        }
      }

      cells.forEach(function (cell) {
        const key = cell.dataset.r + "," + cell.dataset.c;
        if (conflicts.has(key)) {
          cell.classList.add("conflict");
        }
        if (cell.classList.contains("fixed")) return;
        if (placedCats.has(key)) {
          cell.innerHTML = '<span class="cats-icon">🐱</span>';
        } else if (forbidden.has(key)) {
          cell.innerHTML = '<span class="cats-forbid">X</span>';
        } else {
          cell.innerHTML = "";
        }
      });

      let win = false;
      if (cats.length === size && conflicts.size === 0) {
        const rows = new Set(cats.map(function (item) { return item[0]; }));
        if (rows.size === size) win = true;
      }
      msgEl.textContent = win ? "You win!" : "";
    }

    function resetGame() {
      placedCats = new Set(startCats);
      forbidden = new Set();
      validateAndRender();
      msgEl.textContent = "";
    }

    newBtn.addEventListener("click", makeNewGame);
    resetBtn.addEventListener("click", resetGame);
    window.addEventListener("resize", function () {
      if (!size) return;
      computeCellSize();
    });

    makeNewGame();
  })();
</script>
