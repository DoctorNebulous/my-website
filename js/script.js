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
  const SPLIT_DELAY = 90;
  const SPLIT_FORCE = 3;
  const SNAP_DISTANCE = 140;
  const GLUON_STRENGTH = 0.0025;

  function makeCore(x, y, vx = 0, vy = 0) {
    return {
      x,
      y,
      vx,
      vy,
      state: "stable",
      timer: 0,
      parts: []
    };
  }

  function resetSimulation() {
    cores = [
      makeCore(canvas.width / 2, canvas.height / 2)
    ];

    light = [];
    status.innerText = "Atlas reset.";
    draw();
  }

  function splitCore(core) {
    core.state = "split";
    core.timer = 0;

    const angle = Math.random() * Math.PI * 2;

    core.parts = [
      {
        x: core.x,
        y: core.y,
        vx: core.vx + Math.cos(angle) * SPLIT_FORCE,
        vy: core.vy + Math.sin(angle) * SPLIT_FORCE,
        value: -1
      },
      {
        x: core.x,
        y: core.y,
        vx: core.vx - Math.cos(angle) * SPLIT_FORCE,
        vy: core.vy - Math.sin(angle) * SPLIT_FORCE,
        value: 1
      }
    ];

    releaseLight(core.x, core.y, 4);
  }

  function mergeCore(core) {
    core.state = "stable";
    core.timer = 0;
    core.parts = [];

    releaseLight(core.x, core.y, 8);
  }

  function snapGluon(core) {
    const a = core.parts[0];
    const b = core.parts[1];

    core.state = "snapped";
    releaseLight((a.x + b.x) / 2, (a.y + b.y) / 2, 18);
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
      core.x += core.vx;
      core.y += core.vy;

      // residual movement slowly fades
      core.vx *= 0.995;
      core.vy *= 0.995;

      if (core.x < 10 || core.x > canvas.width - 10) core.vx *= -1;
      if (core.y < 10 || core.y > canvas.height - 10) core.vy *= -1;

      if (core.timer > SPLIT_DELAY) {
        splitCore(core);
      }
    }

    if (core.state === "split") {
      const a = core.parts[0];
      const b = core.parts[1];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      const nx = dx / distance;
      const ny = dy / distance;

      const pull = distance * GLUON_STRENGTH;

      a.vx += nx * pull;
      a.vy += ny * pull;

      b.vx -= nx * pull;
      b.vy -= ny * pull;

      a.x += a.vx;
      a.y += a.vy;

      b.x += b.vx;
      b.y += b.vy;

      [a, b].forEach(part => {
        if (part.x < 8 || part.x > canvas.width - 8) part.vx *= -1;
        if (part.y < 8 || part.y > canvas.height - 8) part.vy *= -1;
      });

      if (distance > SNAP_DISTANCE) {
        snapGluon(core);
        return;
      }

      if (distance < 8 && core.timer > 20) {
        core.x = (a.x + b.x) / 2;
        core.y = (a.y + b.y) / 2;

        // leftover merge momentum becomes 0 movement
        core.vx = (a.vx + b.vx) / 2;
        core.vy = (a.vy + b.vy) / 2;

        mergeCore(core);
      }
    }
  }

  function updateLight() {
    light.forEach(photon => {
      photon.x += photon.vx;
      photon.y += photon.vy;
      photon.life--;

      if (photon.x < 0 || photon.x > canvas.width) photon.vx *= -1;
      if (photon.y < 0 || photon.y > canvas.height) photon.vy *= -1;

      // rare light collapse into new 0
      if (photon.life < 20 && Math.random() < 0.002) {
        cores.push(
          makeCore(
            photon.x,
            photon.y,
            photon.vx * 0.2,
            photon.vy * 0.2
          )
        );

        photon.life = 0;
      }
    });

    light = light.filter(photon => photon.life > 0);
  }

  function update() {
    cores.forEach(updateCore);
    cores = cores.filter(core => core.state !== "snapped");

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
      const a = core.parts[0];
      const b = core.parts[1];

      ctx.beginPath();
      ctx.strokeStyle = "rgba(248,250,252,0.25)";
      ctx.lineWidth = Math.min(6, 1 + distanceBetween(a, b) / 35);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.lineWidth = 1;

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
    }
  }

  function drawLight(photon) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(250, 204, 21, 0.85)";
    ctx.arc(photon.x, photon.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function distanceBetween(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
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