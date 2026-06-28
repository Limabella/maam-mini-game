const HOME_SELECTOR = ".home-screen";

const syncHomeIntro = () => {
  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);

  if (!screen) {
    return;
  }

  screen.classList.toggle("home-screen--legacy", Boolean(screen.querySelector(".home-title")));
};

const bootHomeIntroEnhancer = () => {
  window.setTimeout(syncHomeIntro, 0);

  const root = document.getElementById("root");
  const observer = new MutationObserver(syncHomeIntro);

  if (root) {
    observer.observe(root, { childList: true, subtree: true });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeIntroEnhancer, { once: true });
} else {
  bootHomeIntroEnhancer();
}
