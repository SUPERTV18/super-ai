(function () {
  const root = document.documentElement;
  const toggleBtn = document.getElementById("themeToggle");

  function getTheme() {
    return root.getAttribute("data-theme") || "light";
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("superAI_theme", theme);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
    });
  }
})();
