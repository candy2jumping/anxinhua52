/* ============================================================
 * 安心花 · 应用内弹窗
 * 严禁使用浏览器原生 alert / prompt / confirm
 * （PWA 安装到桌面后，原生弹窗会失效或露出浏览器样式）
 * ============================================================ */

/* ---------- Toast：顶部短暂提示，2 秒自动消失 ---------- */
function appToast(msg, type) {
  const t = document.createElement('div');
  t.className = 'app-toast ' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2000);
}

/* ---------- 单字段输入 ---------- */
function appPrompt(opts) {
  const { title, label, value, placeholder, type, onConfirm } = opts;
  const m = document.createElement('div');
  m.className = 'app-modal';
  m.innerHTML = `
    <div class="app-modal-mask"></div>
    <div class="app-modal-card">
      <div class="app-modal-title">${escapeHtml(title || '')}</div>
      ${label ? `<div class="app-modal-label">${escapeHtml(label)}</div>` : ''}
      <input class="app-modal-input" type="${type || 'text'}"
             value="${value !== undefined && value !== null ? escapeHtml(String(value)) : ''}"
             placeholder="${placeholder ? escapeHtml(placeholder) : ''}">
      <div class="app-modal-actions">
        <button class="app-modal-btn cancel">取消</button>
        <button class="app-modal-btn confirm">确定</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  const input = m.querySelector('.app-modal-input');
  setTimeout(() => { input.focus(); try { input.select(); } catch (e) {} }, 60);
  const finish = (val) => { m.remove(); if (onConfirm) onConfirm(val); };
  m.querySelector('.cancel').onclick = () => finish(null);
  m.querySelector('.app-modal-mask').onclick = () => finish(null);
  m.querySelector('.confirm').onclick = () => finish(input.value);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') finish(input.value);
    if (e.key === 'Escape') finish(null);
  };
}

/* ---------- 确认框 ---------- */
function appConfirm(opts) {
  const { title, content, confirmText, cancelText, danger, onConfirm, onCancel } = opts;
  const m = document.createElement('div');
  m.className = 'app-modal';
  m.innerHTML = `
    <div class="app-modal-mask"></div>
    <div class="app-modal-card">
      <div class="app-modal-title">${escapeHtml(title || '')}</div>
      ${content ? `<div class="app-modal-content">${escapeHtml(content)}</div>` : ''}
      <div class="app-modal-actions">
        <button class="app-modal-btn cancel">${escapeHtml(cancelText || '取消')}</button>
        <button class="app-modal-btn ${danger ? 'danger' : 'confirm'}">${escapeHtml(confirmText || '确定')}</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('.cancel').onclick = () => { m.remove(); if (onCancel) onCancel(); };
  m.querySelector('.app-modal-mask').onclick = () => { m.remove(); if (onCancel) onCancel(); };
  m.querySelector('.confirm').onclick = () => { m.remove(); if (onConfirm) onConfirm(); };
}

/* ---------- 底部选择面板（选账户 / 选分类 / 选属性） ---------- */
function appSheet(opts) {
  const { title, options, onSelect } = opts;
  const m = document.createElement('div');
  m.className = 'app-modal app-modal-bottom';
  m.innerHTML = `
    <div class="app-modal-mask"></div>
    <div class="app-modal-sheet">
      <div class="app-sheet-head">${escapeHtml(title || '请选择')}</div>
      <div class="app-sheet-list">
        ${(options || []).map((o, i) => `
          <div class="app-sheet-item" data-i="${i}">
            ${o.emoji ? `<span class="si-em">${o.emoji}</span>` : ''}
            <span class="si-label">${escapeHtml(o.label)}</span>
            ${o.hint ? `<span class="si-hint">${escapeHtml(o.hint)}</span>` : ''}
          </div>`).join('')}
      </div>
      <button class="app-sheet-cancel">取消</button>
    </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('.app-modal-mask').onclick = close;
  m.querySelector('.app-sheet-cancel').onclick = close;
  m.querySelectorAll('.app-sheet-item').forEach((el) => {
    el.onclick = () => {
      const opt = options[parseInt(el.dataset.i)];
      close();
      if (onSelect) onSelect(opt ? opt.value : null, opt);
    };
  });
}

/* ---------- 多字段表单（账户 / 分类 / 转账编辑） ----------
 * fields: [{ name, label, value, type: 'text'|'number'|'date'|'choice', options: [{value,label}] }]
 */
function appForm(opts) {
  const { title, fields, confirmText, onConfirm } = opts;
  const m = document.createElement('div');
  m.className = 'app-modal';
  const fieldHtml = (fields || []).map((f, fi) => {
    if (f.type === 'choice') {
      return `
        <div class="form-row" data-name="${escapeHtml(f.name)}" data-type="choice">
          <label>${escapeHtml(f.label || '')}</label>
          <div class="choice-group">
            ${(f.options || []).map((o) => `
              <button type="button" class="choice-pill${String(o.value) === String(f.value) ? ' on' : ''}"
                      data-value="${escapeHtml(String(o.value))}">${escapeHtml(o.label)}</button>`).join('')}
          </div>
        </div>`;
    }
    return `
      <div class="form-row" data-name="${escapeHtml(f.name)}" data-type="${f.type || 'text'}">
        <label>${escapeHtml(f.label || '')}</label>
        <input type="${f.type === 'number' || f.type === 'date' ? f.type : 'text'}"
               value="${f.value !== undefined && f.value !== null ? escapeHtml(String(f.value)) : ''}"
               placeholder="${f.placeholder ? escapeHtml(f.placeholder) : ''}"
               ${f.type === 'number' ? 'inputmode="decimal" step="0.01"' : ''}>
      </div>`;
  }).join('');

  m.innerHTML = `
    <div class="app-modal-mask"></div>
    <div class="app-modal-card">
      <div class="app-modal-title">${escapeHtml(title || '')}</div>
      ${fieldHtml}
      <div class="app-modal-actions">
        <button class="app-modal-btn cancel">取消</button>
        <button class="app-modal-btn confirm">${escapeHtml(confirmText || '保存')}</button>
      </div>
    </div>`;
  document.body.appendChild(m);

  /* choice 组点击切换 */
  m.querySelectorAll('.choice-group').forEach((g) => {
    g.querySelectorAll('.choice-pill').forEach((p) => {
      p.onclick = () => {
        g.querySelectorAll('.choice-pill').forEach((x) => x.classList.remove('on'));
        p.classList.add('on');
      };
    });
  });

  const firstInput = m.querySelector('.app-modal-input, input');
  if (firstInput) setTimeout(() => firstInput.focus(), 60);

  m.querySelector('.cancel').onclick = () => { m.remove(); if (onConfirm) onConfirm(null); };
  m.querySelector('.app-modal-mask').onclick = () => { m.remove(); if (onConfirm) onConfirm(null); };
  m.querySelector('.confirm').onclick = () => {
    const result = {};
    m.querySelectorAll('.form-row').forEach((row) => {
      const name = row.dataset.name;
      const type = row.dataset.type;
      if (type === 'choice') {
        const on = row.querySelector('.choice-pill.on');
        result[name] = on ? on.dataset.value : null;
      } else {
        const input = row.querySelector('input');
        result[name] = input ? input.value : '';
      }
    });
    m.remove();
    if (onConfirm) onConfirm(result);
  };
}

/* ---------- 工具 ---------- */
function escapeHtml(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.UIX = { appToast, appPrompt, appConfirm, appSheet, appForm, escapeHtml };
