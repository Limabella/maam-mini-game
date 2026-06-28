const HOME_SELECTOR = ".home-screen";
const JOIN_OPENED_ATTR = "data-join-opened";

const getButtonByText = (screen: Element, label: string) =>
  Array.from(screen.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === label,
  );

const syncHomeIntro = () => {
  const screen = document.querySelector<HTMLElement>(HOME_SELECTOR);

  if (!screen) {
    return;
  }

  screen.classList.toggle("home-screen--legacy", Boolean(screen.querySelector(".home-title")));

  if (!screen.querySelector(".home-code-input") && !screen.hasAttribute(JOIN_OPENED_ATTR)) {
    const joinButton = getButtonByText(screen, "방 입장");
    screen.setAttribute(JOIN_OPENED_ATTR, "true");
    joinButton?.click();
  }
};

const submitJoinCode = (screen: Element) => {
  const input = screen.querySelector<HTMLInputElement>(".home-code-input");

  if (!input) {
    syncHomeIntro();
    return;
  }

  if (input.value.trim().length === 4) {
    input.closest("form")?.requestSubmit();
    return;
  }

  input.focus();
};

const createRoomFromLegacyMenu = () => {
  window.setTimeout(() => {
    const liveOption = document.querySelector<HTMLButtonElement>(".home-screen .game-option.is-live:not(:disabled)");
    liveOption?.click();
  }, 30);
};

const bootHomeIntroEnhancer = () => {
  window.setTimeout(syncHomeIntro, 0);

  const root = document.getElementById("root");
  const observer = new MutationObserver(syncHomeIntro);

  if (root) {
    observer.observe(root, { childList: true, subtree: true });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button");
    const screen = target.closest(HOME_SELECTOR);

    if (!button || !screen) {
      return;
    }

    const label = button.textContent?.trim();

    if (label === "게임 생성") {
      createRoomFromLegacyMenu();
    }

    if (label === "방 입장") {
      window.setTimeout(() => submitJoinCode(screen), 0);
    }
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeIntroEnhancer, { once: true });
} else {
  bootHomeIntroEnhancer();
}
