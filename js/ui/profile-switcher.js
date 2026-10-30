// seletor de perfil: botão com avatar + menu com os perfis (teclado: setas, home/end, esc)
import { h, icon, append } from '../lib/dom.js';
import { initials } from '../store/profiles.js';
import { createProfileDialog } from './profiles.js';
import { toast } from './feedback.js';

let seq = 0;

// profileSwitcher - compact=true mostra só o avatar (top bar do celular)
export function profileSwitcher(store, { compact = false } = {}) {
  const menuId = `profile-menu-${++seq}`;
  const root = h('div', { class: 'profile-switch' });
  const button = h('button', {
    class: 'profile-btn',
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    'aria-controls': menuId,
  });
  // o rótulo visível fica fora do role=menu (menu só tem group, menuitem e separator) e nomeia o grupo
  const labelId = `${menuId}-label`;
  const menu = h('div', { role: 'menu', id: menuId, 'aria-label': 'Perfis' });
  const pop = h('div', { class: 'menu glass', hidden: true },
    h('p', { class: 'menu-label', id: labelId }, 'Perfis neste navegador'),
    menu);
  root.append(button, pop);

  const items = () => [...menu.querySelectorAll('[role^="menuitem"]')];

  const open = () => {
    renderMenu();
    pop.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const current = menu.querySelector('[aria-checked="true"]') || items()[0];
    current?.focus();
    document.addEventListener('pointerdown', onOutside, true);
  };

  const close = (focusButton = true) => {
    if (pop.hidden) return;
    pop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    if (focusButton) button.focus();
  };

  const onOutside = (e) => {
    if (!root.contains(e.target)) close(false);
  };

  button.addEventListener('click', () => (pop.hidden ? open() : close()));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open();
    }
  });

  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    const moves = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      list[(moves[e.key] + list.length) % list.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  });

  // renderMenu - redesenha os itens; com o menu aberto, devolve o foco ao item equivalente
  function renderMenu() {
    const focusedKey = menu.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const active = store.activeProfile();
    const profiles = store.profiles();
    menu.replaceChildren(
      h('div', { role: 'group', 'aria-labelledby': labelId },
        profiles.map((p) => h('button', {
          class: 'menu-item',
          type: 'button',
          role: 'menuitemradio',
          tabindex: '-1',
          dataset: { key: `perfil:${p.id}` },
          'aria-checked': String(p.id === active?.id),
          onClick: () => {
            close();
            if (p.id !== active?.id) {
              store.selectProfile(p.id);
              toast(`Agora no perfil "${p.name}".`);
            }
          },
        }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(p.name)), h('span', { class: 'name', text: p.name }),
        p.id === active?.id ? icon('check') : null))),
      h('div', { class: 'menu-sep', role: 'separator' }),
      h('button', {
        class: 'menu-item', type: 'button', role: 'menuitem', tabindex: '-1', dataset: { key: 'novo' },
        onClick: () => {
          close();
          createProfileDialog(store);
        },
      }, icon('plus'), h('span', { class: 'name' }, 'Novo perfil')),
      h('a', {
        class: 'menu-item', href: '#/perfis', role: 'menuitem', tabindex: '-1', dataset: { key: 'gerenciar' },
        onClick: () => close(false),
      }, icon('users'), h('span', { class: 'name' }, 'Gerenciar perfis')));
    if (focusedKey === null || focusedKey === undefined) return;
    const target = items().find((el) => el.dataset.key === focusedKey)
      || menu.querySelector('[aria-checked="true"]') || items()[0];
    target?.focus();
  }

  function renderButton() {
    const active = store.activeProfile();
    const name = active ? active.name : 'Sem perfil';
    button.setAttribute('aria-label', `Perfil ativo: ${name}. Trocar perfil`);
    button.replaceChildren();
    append(button, [
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, active ? initials(active.name) : '?'),
      compact ? null : h('span', { class: 'who', 'aria-hidden': 'true' }, h('b', { text: name }), h('span', {}, 'Trocar perfil')),
      compact ? null : icon('chevrons-up-down'),
    ]);
  }

  renderButton();
  const unsubscribe = store.subscribe(() => {
    renderButton();
    if (!pop.hidden) renderMenu();
  });

  return { el: root, destroy: unsubscribe };
}
