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