// Hompage menu

(function () {
  const trigger = document.querySelector(".menu-trigger");
  const menu = document.getElementById("website-menu");

  if (!trigger || !menu) return;

  const items = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));
  let lastFocused = null;

  function openMenu() {
    if (!menu.hasAttribute("hidden")) return;
    lastFocused = document.activeElement;
    trigger.setAttribute("aria-expanded", "true");
    menu.removeAttribute("hidden");

    const first = items()[0];
    if (first) first.focus();
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function closeMenu() {
    if (menu.hasAttribute("hidden")) return;
    trigger.setAttribute("aria-expanded", "false");
    menu.setAttribute("hidden", "");
    document.removeEventListener("pointerdown", onDocPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);

    if (lastFocused) trigger.focus();
  }

  function toggleMenu() {
    if (menu.hasAttribute("hidden")) openMenu();
    else closeMenu();
  }

  function onDocPointerDown(e) {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) {
      closeMenu();
    }
  }

  function onKeyDown(e) {
    const key = e.key;
    const list = items();
    const currentIndex = list.indexOf(document.activeElement);

    if (key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }

    if (key === "ArrowDown") {
      e.preventDefault();
      const next = list[(currentIndex + 1) % list.length] || list[0];
      next?.focus();
    }

    if (key === "ArrowUp") {
      e.preventDefault();
      const prev =
        list[(currentIndex - 1 + list.length) % list.length] ||
        list[list.length - 1];
      prev?.focus();
    }

    if (key === "Tab") {
      setTimeout(() => {
        if (!menu.contains(document.activeElement)) closeMenu();
      }, 0);
    }
  }

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMenu();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleMenu();
    }
  });
})();

// Submenu

const submenuParent = document.querySelector(".menu .has-submenu");
const submenuBtn = document.querySelector(".menu .submenu-trigger");

if (submenuParent && submenuBtn) {
  submenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = submenuParent.classList.toggle("open");
    submenuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (e) => {
    if (!submenuParent.closest(".menu")?.contains(e.target)) {
      submenuParent.classList.remove("open");
      submenuBtn.setAttribute("aria-expanded", "false");
    }
  });
}
