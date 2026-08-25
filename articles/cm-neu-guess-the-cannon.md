---
layout: default
is_article: true
title: "Can you guess the cannon? Or cat?"
description: "Test your cannon cat guessing skills"
heading: "Can you guess it right? It's up to you."
subheading: "A one-shot attempt to get your guess right."
date: 2025-07-18
---
<section class="guess-game" aria-labelledby="guess-title">
  <h1 id="guess-title">Guess the Number</h1>
  <p class="guess-help">Pick a number from 1 to 100. Submit once to see if you guessed right.</p>

  <div class="guess-grid">
    <div class="guess-left">
      <div class="guess-cat-box">
        <div class="guess-cat" aria-hidden="true">🐱</div>
        <div id="bubble" class="guess-bubble" aria-live="polite" hidden>?</div>
      </div>
    </div>

    <div class="guess-right">
      <label for="guessInput">Enter your guess (1-100)</label>
      <input id="guessInput" type="number" min="1" max="100" autocomplete="off">
      <button id="submitBtn" class="guess-btn" type="button">Submit</button>
      <button id="againBtn" class="guess-btn" type="button" hidden>Try Again</button>
      <div id="result" class="guess-result" aria-live="polite"></div>

      <div class="guess-score">
        <div id="wins" class="guess-win">Wins: 0</div>
        <div id="losses" class="guess-loss">Losses: 0</div>
      </div>
    </div>
  </div>
</section>

<style>
  .guess-game {
    max-width: 980px;
    margin: 0 auto;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
  }

  .guess-game h1 {
    margin: 0 0 8px;
    font: 700 38px/1.05 Georgia, "Times New Roman", serif;
  }

  .guess-help {
    margin: 0 0 18px;
    font-size: 16px;
  }

  .guess-grid {
    display: flex;
    gap: 22px;
    align-items: flex-start;
    justify-content: center;
  }

  .guess-left,
  .guess-right {
    flex: 1;
    min-width: 220px;
  }

  .guess-left {
    display: flex;
    justify-content: center;
  }

  .guess-cat-box {
    position: relative;
    width: 220px;
    height: 220px;
    border-radius: 12px;
    background: #fff6cf;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .guess-cat {
    font-size: 96px;
    line-height: 1;
  }

  .guess-bubble {
    position: absolute;
    right: -20px;
    top: 10px;
    min-width: 90px;
    padding: 10px 14px;
    border: 2px solid #000;
    border-radius: 12px;
    background: #fff;
    text-align: center;
    font-weight: 700;
  }

  .guess-right {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .guess-right label {
    font-weight: 700;
  }

  #guessInput {
    width: 170px;
    padding: 10px;
    border: 1px solid #bbb;
    border-radius: 8px;
    font-size: 18px;
    text-align: center;
  }

  .guess-btn {
    padding: 8px 14px;
    border: 1px solid #777;
    border-radius: 6px;
    background: #fff;
    font-size: 16px;
    cursor: pointer;
  }

  .guess-result {
    min-height: 26px;
    margin-top: 4px;
    font-weight: 700;
  }

  .guess-score {
    margin-top: 2px;
    display: flex;
    gap: 14px;
  }

  .guess-win {
    color: #2e7d32;
    font-weight: 700;
  }

  .guess-loss {
    color: #c62828;
    font-weight: 700;
  }

  @media (max-width: 760px) {
    .guess-game h1 {
      font-size: 32px;
    }

    .guess-help {
      font-size: 15px;
    }

    .guess-grid {
      flex-direction: column;
      align-items: center;
    }

    .guess-bubble {
      position: static;
      margin-top: 12px;
    }

    .guess-cat {
      font-size: 72px;
    }
  }
</style>

<script>
  (function () {
    function randint(a, b) {
      return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    const bubble = document.getElementById("bubble");
    const input = document.getElementById("guessInput");
    const submitBtn = document.getElementById("submitBtn");
    const againBtn = document.getElementById("againBtn");
    const result = document.getElementById("result");
    const winsEl = document.getElementById("wins");
    const lossesEl = document.getElementById("losses");

    let target = randint(1, 100);
    let wins = 0;
    let losses = 0;

    function reveal() {
      bubble.hidden = false;
      bubble.textContent = "I was thinking of " + target;
      againBtn.hidden = false;
    }

    function submitGuess() {
      const value = Number(input.value);
      if (!value || value < 1 || value > 100) {
        result.textContent = "Please enter a number from 1 to 100.";
        result.style.color = "#111";
        return;
      }

      reveal();
      if (value === target) {
        wins += 1;
        winsEl.textContent = "Wins: " + wins;
        result.textContent = "Correct!";
        result.style.color = "#2e7d32";
      } else {
        losses += 1;
        lossesEl.textContent = "Losses: " + losses;
        result.textContent = "Wrong. Try again.";
        result.style.color = "#c62828";
      }
    }

    function resetRound() {
      target = randint(1, 100);
      bubble.hidden = true;
      bubble.textContent = "?";
      againBtn.hidden = true;
      result.textContent = "";
      input.value = "";
      input.focus();
    }

    submitBtn.addEventListener("click", submitGuess);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") submitGuess();
    });
    againBtn.addEventListener("click", resetRound);
  })();
</script>
