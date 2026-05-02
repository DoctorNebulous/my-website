// Load saved theme immediately (safe)
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-mode");
}

// Wait for full DOM
document.addEventListener("DOMContentLoaded", () => {

  // Load shared header
  fetch("components/header.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("header-placeholder").innerHTML = data;

      // Theme toggle AFTER header loads
      const toggle = document.getElementById("themeToggle");

      if (toggle) {
        toggle.addEventListener("click", () => {
          document.body.classList.toggle("light-mode");

          if (document.body.classList.contains("light-mode")) {
            localStorage.setItem("theme", "light");
          } else {
            localStorage.setItem("theme", "dark");
          }
        });
      }
    });

  // Button logic (safe on pages that have it)
  const button = document.getElementById("testBtn");
  const statusText = document.getElementById("statusText");

  if (button && statusText) {
    let clickCount = 0;

    button.addEventListener("click", () => {
      clickCount++;
      statusText.innerText = "Button Clicked " + clickCount + " times.";
    });
  }

  fetch("components/footer.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("footer-placeholder").innerHTML = data;
    })

});

const canvas = document.getElementById("gameScreen");

if (canvas) {
  const ctx = canvas.getContext("2d");
  const status = document.getElementById("simStatus");
  const startBtn = document.getElementById("startSim");
  const pauseBtn = document.getElementById("pauseSim");
  const resetBtn = document.getElementById("resetSim");

  let running = false;
  let cores = [];
  let light = [];

  const LIGHT_SPEED = 5;

  function resetSimulation() {
    cores = [
      {
        x: canvas.width / 2,
        y: canvas.height / 2,
        state: "stable",
        timer: 0,
        parts: []
      }
    ];

    light = [];
    status.innerText = "Atlas reset.";
    draw();
  }

  function splitCore(core) {
    core.state = "split";
    core.timer = 0;

    core.parts = [
      {
        x: core.x,
        y: core.y,
        vx: -3,
        vy: 0,
        value: -1
      },
      {
        x: core.x,
        y: core.y,
        vx: 3,
        vy: 0,
        value: 1
      }
    ];

    releaseLight(core.x, core.y, 6);
  }

  function mergeCore(core) {
    core.state = "stable";
    core.timer = 0;
    core.parts = [];

    releaseLight(core.x, core.y, 10);
  }

  function releaseLight(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;

      light.push({
        x,
        y,
        vx: Math.cos(angle) * LIGHT_SPEED,
        vy: Math.sin(angle) * LIGHT_SPEED,
        life: 600,
        energy: 1
      });
    }
  }

  function updateCore(core) {
    core.timer++;

    if (core.state === "stable") {
      if (core.timer > 80) {
        splitCore(core);
      }
    }

    if (core.state === "split") {
      const left = core.parts[0];
      const right = core.parts[1];

      // Move apart first
      left.x += left.vx;
      left.y += left.vy;
      right.x += right.vx;
      right.y += right.vy;

      // Pull back toward center
      const pullStrength = 0.08;

      left.vx += (core.x - left.x) * pullStrength;
      left.vy += (core.y - left.y) * pullStrength;

      right.vx += (core.x - right.x) * pullStrength;
      right.vy += (core.y - right.y) * pullStrength;

      // Dampen so they don't slingshot forever
      left.vx *= 0.92;
      left.vy *= 0.92;
      right.vx *= 0.92;
      right.vy *= 0.92;

      const dx = left.x - right.x;
      const dy = left.y - right.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 8 && core.timer > 20) {
        mergeCore(core);
      }
    }
  }

  function updateLight() {
    light.forEach(photon => {
      photon.x += photon.vx;
      photon.y += photon.vy;
      photon.life--;

      // bounce off screen edges for now
      if (photon.x < 0 || photon.x > canvas.width) photon.vx *= -1;
      if (photon.y < 0 || photon.y > canvas.height) photon.vy *= -1;
    });

    // old light fades out
    light = light.filter(photon => photon.life > 0);

    // rare collapse: old light becomes new 0
    light.forEach(photon => {
      if (photon.life < 10 && Math.random() < 0.003) {
        cores.push({
          x: photon.x,
          y: photon.y,
          state: "stable",
          timer: 0,
          parts: []
        });

        photon.life = 0;
      }
    });
  }

  function update() {
    cores.forEach(updateCore);
    updateLight();
  }

  function drawCore(core) {
    if (core.state === "stable") {
      ctx.beginPath();
      ctx.fillStyle = "#f8fafc";
      ctx.arc(core.x, core.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#020617";
      ctx.font = "13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("0", core.x, core.y);
    }

    if (core.state === "split") {
      core.parts.forEach(part => {
        ctx.beginPath();

        ctx.fillStyle = part.value > 0 ? "#38bdf8" : "#f43f5e";

        ctx.arc(part.x, part.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#020617";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(part.value, part.x, part.y);
      });

      // connection line / trapped tension
      const a = core.parts[0];
      const b = core.parts[1];

      ctx.beginPath();
      ctx.strokeStyle = "rgba(248,250,252,0.35)";
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  function drawLight(photon) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
    ctx.arc(photon.x, photon.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    light.forEach(drawLight);
    cores.forEach(drawCore);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText("0 cores: " + cores.length, 14, 24);
    ctx.fillText("light: " + light.length, 14, 44);
  }

  function loop() {
    if (running) {
      update();
      draw();
      requestAnimationFrame(loop);
    }
  }

  startBtn.addEventListener("click", () => {
    if (!running) {
      running = true;
      status.innerText = "Atlas is running.";
      loop();
    }
  });

  pauseBtn.addEventListener("click", () => {
    running = false;
    status.innerText = "Atlas paused.";
  });

  resetBtn.addEventListener("click", () => {
    running = false;
    resetSimulation();
  });

  resetSimulation();
}