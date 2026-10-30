// helpers de dom — todo texto entra por textContent, nunca por innerHTML

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = 'assets/icons.svg';

// h - cria um elemento: h('button', { class: 'btn', onClick: fn, 'aria-label': 'x' }, 'texto', filho)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

// append - adiciona filhos ignorando null/false e convertendo texto
export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// icon - ícone do sprite lucide, decorativo por padrão
export function icon(name, cls = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', ('icon ' + cls).trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${ICONS}#i-${name}`);
  svg.append(use);
  return svg;
}

// progressBar - barra com o valor exposto para leitores de tela
export function progressBar(done, total, label) {
  const ratio = total ? done / total : 0;
  return h('div', {
    class: 'bar',
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': total,
    'aria-valuenow': done,
    'aria-valuetext': `${done} de ${total}`,
  }, h('span', { style: `transform:scaleX(${ratio})` }));
}

// skeletonLine - barra cinza no tamanho real do texto que vai entrar (altura em px ou valor css)
export function skeletonLine(width, height = 14) {
  const hgt = typeof height === 'number' ? `${height}px` : height;
  return h('span', { class: 'skeleton', style: `width:${width};height:${hgt}`, 'aria-hidden': 'true' });
}
