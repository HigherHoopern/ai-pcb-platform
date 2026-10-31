/**
 * XterAI-PCB IDE — VS Code 软硬件协同工作台终极扩展模块 (Scheme A + B + C)
 *
 * 方案 A (P2 收官):
 *   - 右侧全局可折叠 AI Copilot 统一侧边栏 (#vscode-copilot-sidebar)
 *   - @ 跨模态上下文挂载胶囊 (@pinout / @drc / @gcc / @bom / @skill)
 *   - VS Code Monaco Side-by-Side Diff Viewer 模态框 (#vscode-diff-modal)
 *
 * 方案 B (软硬件跨屏双向点击高亮联动 / Cross-Probing):
 *   - 硬件 -> 固件: 点击引脚表/覆盖率胶囊/仿真波形引脚，自动在 C99 编辑器中滚动并高亮全部 PIN_<NET>_* 宏引用行
 *   - 固件 -> 硬件: 在 C99 编辑器中点击或移动光标到 PIN_<NET>_* 或引脚号时，自动反向高亮硬件侧对应引脚行与横幅
 *
 * 方案 C (嵌入式 C99 状态机在线仿真与虚拟传感器调试器 🔮 SIMULATOR):
 *   - 底部面板第 5 标签页 (#btm-tab-simulator / #btm-pane-simulator)
 *   - 虚拟传感器激励推杆 (ADC mV / Temp °C / VBAT mV / KEY_MUTE)
 *   - 12-Tick SSOT 引脚逻辑分析仪时序波形 + Virtual UART (115200 8N1) 实时输出
 */

let globalCopilotOpen = false;
let globalCopilotTarget = 'auto'; // 'auto' | 'pcb' | 'firmware'
let activeCopilotPills = {
  pinout: true,
  drc: true,
  gcc: true,
  bom: false,
  skill: false
};
let monacoDiffEditorInstance = null;
let monacoCrossProbeDecorations = [];
let simDebounceTimer = null;

// 覆盖底部面板切换器，支持第 5 个标签页：simulator (🔮 SIMULATOR · C99 状态机在线仿真)
function switchBottomPanelTab(tabName) {
  currentBottomPanelTab = tabName;
  ['problems', 'output', 'terminal', 'memory', 'simulator'].forEach(t => {
    const btn = document.getElementById(`btm-tab-${t}`);
    const pane = document.getElementById(`btm-pane-${t}`);
    if (pane) pane.classList.toggle('hidden', t !== tabName);
    if (btn) {
      if (t === 'simulator') {
        btn.className = t === tabName
          ? 'pb-1 border-b-2 border-purple-400 text-purple-300 flex items-center gap-1.5 transition font-extrabold'
          : 'pb-1 border-b-2 border-transparent text-purple-300/80 hover:text-purple-200 flex items-center gap-1.5 transition';
      } else {
        btn.className = t === tabName
          ? 'pb-1 border-b-2 border-sky-400 text-sky-400 flex items-center gap-1.5 transition'
          : 'pb-1 border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition';
      }
    }
  });
}

// ============================================================================
// 方案 A1：右侧全局 AI Copilot 统一侧边栏 (Secondary Side Bar) 与 @ 上下文胶囊
// ============================================================================
function toggleGlobalCopilotSidebar(forceState = null) {
  const sidebar = document.getElementById('vscode-copilot-sidebar');
  const headerBtn = document.getElementById('btn-header-copilot');
  const actBtn = document.getElementById('act-btn-copilot');
  if (!sidebar) return;

  globalCopilotOpen = (forceState !== null) ? Boolean(forceState) : !globalCopilotOpen;
  sidebar.classList.toggle('hidden', !globalCopilotOpen);
  document.body.classList.toggle('global-copilot-open', globalCopilotOpen);

  if (headerBtn) {
    headerBtn.className = globalCopilotOpen
      ? 'px-2.5 py-1 rounded-lg bg-pink-500 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow'
      : 'px-2.5 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-xs font-bold transition flex items-center gap-1.5';
  }
  if (actBtn) {
    actBtn.classList.toggle('text-pink-400', globalCopilotOpen);
    actBtn.classList.toggle('bg-slate-900/90', globalCopilotOpen);
  }

  setTimeout(() => {
    if (typeof layoutMonacoEditorIfVisible === 'function') {
      layoutMonacoEditorIfVisible();
    }
  }, 60);
}

function setGlobalCopilotTarget(target) {
  globalCopilotTarget = target || 'auto';
  const map = {
    auto: 'gcop-target-auto',
    pcb: 'gcop-target-pcb',
    firmware: 'gcop-target-fw'
  };
  Object.entries(map).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = (k === globalCopilotTarget)
      ? 'px-2 py-0.5 rounded-md bg-pink-500 text-slate-950 font-bold text-[10px] transition'
      : 'px-2 py-0.5 rounded-md text-slate-400 hover:text-white text-[10px] transition';
  });
}

function toggleCopilotContextPill(pillName) {
  if (!(pillName in activeCopilotPills)) return;
  activeCopilotPills[pillName] = !activeCopilotPills[pillName];
  const btn = document.getElementById(`gcop-pill-${pillName}`);
  if (btn) {
    btn.className = activeCopilotPills[pillName]
      ? 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-pink-500/20 text-pink-300 border border-pink-500/40 transition'
      : 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-700 transition';
  }
  const cnt = Object.values(activeCopilotPills).filter(Boolean).length;
  const cntEl = document.getElementById('gcop-active-pills-count');
  if (cntEl) cntEl.innerText = `${cnt} 已挂载`;
}

function buildGlobalCopilotContextSummary() {
  const tags = [];
  if (activeCopilotPills.pinout) {
    const pins = (activeProjectDetail?.pinout || []).map(p => `${p.pin}:${p.net_name}`).join(', ');
    tags.push(`[@pinout: ${pins || 'SSOT synced'}]`);
  }
  if (activeCopilotPills.drc) {
    const v = activeProjectDetail?.hardware?.drc?.violations_count || 0;
    const u = activeProjectDetail?.hardware?.drc?.unconnected_count || 0;
    tags.push(`[@drc: ${v} violations, ${u} unconnected]`);
  }
  if (activeCopilotPills.gcc) {
    const cov = activeProjectDetail?.firmware?.pin_coverage?.coverage_pct ?? 100;
    tags.push(`[@gcc: ${(typeof latestGccDiagnostics !== 'undefined' ? latestGccDiagnostics.length : 0)} warnings/errors, PinCoverage=${cov}%]`);
  }
  if (activeCopilotPills.bom) {
    const bomCnt = (activeProjectDetail?.hardware?.bom_rows || []).length;
    tags.push(`[@bom: ${bomCnt} items]`);
  }
  if (activeCopilotPills.skill) {
    tags.push(`[@skill: active engineering skills injected]`);
  }
  return tags.join(' ');
}

function resolveGlobalCopilotModule(promptText) {
  if (globalCopilotTarget === 'pcb' || globalCopilotTarget === 'firmware') {
    return globalCopilotTarget;
  }
  const lower = (promptText || '').toLowerCase();
  if (
    lower.includes('c99') ||
    lower.includes('gcc') ||
    lower.includes('main.c') ||
    lower.includes('函数') ||
    lower.includes('状态机') ||
    lower.includes('消抖') ||
    lower.includes('初始化') ||
    lower.includes('驱动') ||
    lower.includes('代码')
  ) {
    return 'firmware';
  }
  if (
    lower.includes('pcb') ||
    lower.includes('drc') ||
    lower.includes('走线') ||
    lower.includes('板框') ||
    lower.includes('打样') ||
    lower.includes('立创') ||
    lower.includes('bom') ||
    lower.includes('位置') ||
    lower.includes('坐标')
  ) {
    return 'pcb';
  }
  const fwPane = document.getElementById('pane-firmware');
  if (fwPane && !fwPane.classList.contains('hidden') && !coDesignSplitActive) {
    return 'firmware';
  }
  return 'pcb';
}

async function sendGlobalCopilotQuickPrompt(promptText) {
  const input = document.getElementById('global-copilot-input');
  if (input) input.value = promptText;
  await sendGlobalCopilotMessage();
}

async function sendGlobalCopilotMessage() {
  const input = document.getElementById('global-copilot-input');
  const sendBtn = document.getElementById('btn-global-copilot-send');
  const statusEl = document.getElementById('global-copilot-status');
  const box = document.getElementById('global-copilot-messages');
  if (!input || !input.value.trim()) {
    showToast('请输入全局 Copilot 指令', 'warn');
    return;
  }

  const rawText = input.value.trim();
  input.value = '';
  const targetModule = resolveGlobalCopilotModule(rawText);
  const ctxHeader = buildGlobalCopilotContextSummary();
  const activePillsArr = Object.entries(activeCopilotPills).filter(([, v]) => v).map(([k]) => `@${k}`);

  if (box) {
    const userDiv = document.createElement('div');
    userDiv.className = 'flex flex-col items-end';
    userDiv.innerHTML = `
      <div class="max-w-[92%] rounded-2xl rounded-tr-sm px-3 py-2 bg-pink-600 text-white text-xs leading-relaxed shadow">
        <div class="text-[10px] font-mono text-pink-200 mb-0.5">${escapeHtml(activePillsArr.join(' '))} → [${targetModule.toUpperCase()}]</div>
        ${escapeHtml(rawText)}
      </div>
    `;
    box.appendChild(userDiv);
    box.scrollTop = box.scrollHeight;
  }

  if (sendBtn) sendBtn.disabled = true;
  if (statusEl) statusEl.innerText = `正在调度 ${targetModule.toUpperCase()} Agent 执行...`;

  try {
    const moduleInput = document.getElementById(targetModule === 'firmware' ? 'fw-copilot-input' : 'pcb-copilot-input');
    if (moduleInput) {
      moduleInput.value = ctxHeader ? `${rawText}\n${ctxHeader}` : rawText;
    }
    await sendCopilotMessage(targetModule);

    const hist = copilotHistory[targetModule] || [];
    const lastReply = hist[hist.length - 1];
    if (box && lastReply && lastReply.role !== 'user') {
      const aiDiv = document.createElement('div');
      aiDiv.className = 'p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs space-y-1.5';
      const actionsHtml = (lastReply.actions_taken || [])
        .map(a => `<div class="text-[11px] text-emerald-400 font-medium">${escapeHtml(a)}</div>`)
        .join('');
      aiDiv.innerHTML = `
        <div class="flex items-center justify-between text-[10px] font-mono text-pink-300">
          <span>🤖 ${targetModule === 'firmware' ? 'C99 Firmware Agent' : 'PCB Layout Agent'}</span>
          <span>${escapeHtml(lastReply.timestamp || '')}</span>
        </div>
        ${actionsHtml ? `<div class="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 space-y-0.5">${actionsHtml}</div>` : ''}
        <div class="whitespace-pre-wrap">${formatSimpleMarkdown(lastReply.content || '')}</div>
        <div class="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800">
          <button type="button" onclick="openMonacoDiffModal('${lastReply.snapshot_id || ''}')" class="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
            <i class="fa-solid fa-code-compare"></i> 并排 Diff 审查
          </button>
          ${lastReply.snapshot_id ? `<button type="button" onclick="rollbackCopilotSnapshot('${lastReply.snapshot_id}', '${targetModule}')" class="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono"><i class="fa-solid fa-rotate-left"></i> 撤销回滚</button>` : ''}
        </div>
      `;
      box.appendChild(aiDiv);
      box.scrollTop = box.scrollHeight;
    }
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (statusEl) statusEl.innerText = 'Ready · 自动快照保护';
  }
}

// ============================================================================
// 方案 A2：VS Code Monaco Side-by-Side Diff Viewer 模态框
// ============================================================================
function openMonacoDiffModal(customSnapshotId = '') {
  const modal = document.getElementById('vscode-diff-modal');
  const diffContainer = document.getElementById('monaco-diff-container');
  const fallbackPre = document.getElementById('fallback-diff-pre');
  const subTitle = document.getElementById('diff-modal-subtitle');
  if (!modal) return;

  modal.classList.remove('hidden');
  if (customSnapshotId) {
    window.lastCopilotSnapshotId = customSnapshotId;
  }

  const currentCode = (typeof getActiveFirmwareEditorContent === 'function' ? getActiveFirmwareEditorContent() : '') || '// 当前编辑器内容为空';
  const originalCode = window.lastOriginalCodeBeforeDiff || activeProjectDetail?.bsp_header_code || currentCode;
  const fileName = (currentEditingFwPath || 'main.c').split('/').pop();

  if (subTitle) {
    subTitle.innerText = `文件: ${fileName} ${window.lastCopilotSnapshotId ? `· 快照 ID: ${window.lastCopilotSnapshotId}` : ''} · 左侧: 修改前基线 (Original) | 右侧: 当前代码 (Modified)`;
  }

  if (window.monaco && diffContainer) {
    diffContainer.classList.remove('hidden');
    if (fallbackPre) fallbackPre.classList.add('hidden');
    const isDark = document.documentElement.classList.contains('dark');
    if (!monacoDiffEditorInstance) {
      monacoDiffEditorInstance = window.monaco.editor.createDiffEditor(diffContainer, {
        theme: isDark ? 'vs-dark' : 'vs',
        fontSize: 12,
        readOnly: false,
        renderSideBySide: true,
        automaticLayout: true
      });
    }
    const origModel = window.monaco.editor.createModel(originalCode, 'c');
    const modModel = window.monaco.editor.createModel(currentCode, 'c');
    monacoDiffEditorInstance.setModel({
      original: origModel,
      modified: modModel
    });
  } else if (fallbackPre) {
    if (diffContainer) diffContainer.classList.add('hidden');
    fallbackPre.classList.remove('hidden');
    const diffTxt = window.lastCopilotDiffText || `--- a/${fileName} (Original)\n+++ b/${fileName} (Modified)\n\n${currentCode}`;
    fallbackPre.innerHTML = typeof formatDiffHtml === 'function' ? formatDiffHtml(diffTxt) : escapeHtml(diffTxt);
  }
}

function closeMonacoDiffModal() {
  const modal = document.getElementById('vscode-diff-modal');
  if (modal) modal.classList.add('hidden');
}

async function rollbackFromDiffModal() {
  const snapId = window.lastCopilotSnapshotId;
  const mod = window.lastCopilotModule || 'firmware';
  if (!snapId) {
    if (window.lastOriginalCodeBeforeDiff) {
      const viewer = document.getElementById('rev-fw-code-viewer');
      if (viewer) {
        viewer.value = window.lastOriginalCodeBeforeDiff;
        updateFirmwareLineNumbers();
      }
      if (typeof syncMonacoEditorContent === 'function') {
        syncMonacoEditorContent(window.lastOriginalCodeBeforeDiff);
      }
      closeMonacoDiffModal();
      showToast('已恢复编辑器代码至修改前基线！', 'success');
      return;
    }
    showToast('当前暂无可回滚的历史快照', 'warn');
    return;
  }
  closeMonacoDiffModal();
  await rollbackCopilotSnapshot(snapId, mod);
}

// ============================================================================
// 方案 B：软硬件跨屏双向点击高亮联动 (Cross-Probing: Hardware Pin <-> C99 Macro)
// ============================================================================
function crossProbeFromHardwarePin(pinName, netName) {
  if (!pinName && !netName) return;
  const cleanPin = (pinName || '').trim().toUpperCase();
  const cleanNet = (netName || '').trim();
  const macroStem = cleanNet.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();

  // 1. 高亮页面上所有匹配该引脚的 Pin 行与覆盖率胶囊
  document.querySelectorAll('.cross-probe-pin-row, .cross-probe-pin-chip').forEach(el => {
    const p = (el.getAttribute('data-pin') || '').toUpperCase();
    const n = (el.getAttribute('data-net') || '');
    const matched = (cleanPin && p === cleanPin) || (cleanNet && n === cleanNet);
    el.classList.toggle('cross-probe-highlight', Boolean(matched));
  });

  // 2. 在 C99 源码中搜索匹配 PIN_<NET>_* 或引脚号的物理行号
  const code = (typeof getActiveFirmwareEditorContent === 'function' ? getActiveFirmwareEditorContent() : '') || '';
  const lines = code.split('\n');
  const matchedLines = [];
  lines.forEach((lineText, idx) => {
    const upperLine = lineText.toUpperCase();
    if (
      (macroStem && upperLine.includes(`PIN_${macroStem}`)) ||
      (cleanNet && upperLine.includes(cleanNet.toUpperCase())) ||
      (cleanPin && upperLine.includes(cleanPin))
    ) {
      matchedLines.push(idx + 1);
    }
  });

  const firstLine = matchedLines[0] || 1;

  // 3. 更新跨屏双向联动提示横幅 (#fw-cross-probe-banner)
  const banner = document.getElementById('fw-cross-probe-banner');
  const bannerText = document.getElementById('fw-cross-probe-text');
  if (banner && bannerText) {
    banner.classList.remove('hidden');
    if (matchedLines.length > 0) {
      bannerText.innerHTML = `硬件引脚 <strong>${escapeHtml(cleanPin)} (${escapeHtml(cleanNet)})</strong> ⇄ 宏 <code class="text-emerald-300">PIN_${escapeHtml(macroStem)}_*</code> · 共匹配 <strong>${matchedLines.length}</strong> 处代码 (已跳转至 Ln ${firstLine}: [${matchedLines.slice(0, 6).join(', ')}])`;
    } else {
      bannerText.innerHTML = `硬件引脚 <strong>${escapeHtml(cleanPin)} (${escapeHtml(cleanNet)})</strong> 尚未在当前文件中引用 <code class="text-amber-300">PIN_${escapeHtml(macroStem)}_*</code>`;
    }
  }

  // 4. 如果当前既不在固件页也未开启分屏，自动开启软硬件同屏分屏
  const fwPane = document.getElementById('pane-firmware');
  if (fwPane && fwPane.classList.contains('hidden') && !coDesignSplitActive) {
    toggleCoDesignSplitView();
  }

  // 5. 在原生编辑器与 Monaco 编辑器中同时滚动并高亮匹配行
  const viewer = document.getElementById('rev-fw-code-viewer');
  if (viewer && matchedLines.length > 0) {
    let charStart = 0;
    for (let i = 0; i < firstLine - 1; i++) {
      charStart += lines[i].length + 1;
    }
    const charEnd = charStart + (lines[firstLine - 1]?.length || 0);
    viewer.focus();
    viewer.setSelectionRange(charStart, charEnd);
    const lineHeight = 20;
    viewer.scrollTop = Math.max(0, (firstLine - 4) * lineHeight);
    updateFirmwareCursorLine();
  }

  if (monacoEditorInstance && window.monaco && matchedLines.length > 0) {
    monacoEditorInstance.revealLineInCenter(firstLine);
    monacoEditorInstance.setPosition({ lineNumber: firstLine, column: 1 });
    const newDecs = matchedLines.map(ln => ({
      range: new window.monaco.Range(ln, 1, ln, 1),
      options: {
        isWholeLine: true,
        className: 'monaco-cross-probe-line'
      }
    }));
    monacoCrossProbeDecorations = monacoEditorInstance.deltaDecorations(monacoCrossProbeDecorations, newDecs);
  }
}

function crossProbeFromCodeCursor() {
  const viewer = document.getElementById('rev-fw-code-viewer');
  let currentLineText = '';
  let lineNo = 1;

  if (monacoEditorEnabled && monacoEditorInstance) {
    const pos = monacoEditorInstance.getPosition();
    if (pos) {
      lineNo = pos.lineNumber;
      const model = monacoEditorInstance.getModel();
      if (model) currentLineText = model.getLineContent(lineNo) || '';
    }
  } else if (viewer) {
    const pos = viewer.selectionStart || 0;
    const before = (viewer.value || '').slice(0, pos).split('\n');
    lineNo = before.length || 1;
    const allLines = (viewer.value || '').split('\n');
    currentLineText = allLines[lineNo - 1] || '';
  }

  if (!currentLineText || !activeProjectDetail?.pinout) return;
  const upperLine = currentLineText.toUpperCase();

  let matchedPinObj = null;
  for (const p of (activeProjectDetail.pinout || [])) {
    const pinStr = (p.pin || '').toUpperCase();
    const netStr = (p.net_name || '');
    const stem = netStr.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
    if (
      (stem && upperLine.includes(`PIN_${stem}`)) ||
      (netStr && upperLine.includes(netStr.toUpperCase())) ||
      (pinStr && new RegExp(`\\b${pinStr}\\b`).test(upperLine))
    ) {
      matchedPinObj = p;
      break;
    }
  }

  if (!matchedPinObj) return;

  const pinName = matchedPinObj.pin || '';
  const netName = matchedPinObj.net_name || '';
  const funcName = matchedPinObj.function || 'GPIO';

  document.querySelectorAll('.cross-probe-pin-row, .cross-probe-pin-chip').forEach(el => {
    const p = (el.getAttribute('data-pin') || '').toUpperCase();
    const n = (el.getAttribute('data-net') || '');
    const isHit = (p === pinName.toUpperCase()) || (n === netName);
    el.classList.toggle('cross-probe-highlight', Boolean(isHit));
  });

  const banner = document.getElementById('fw-cross-probe-banner');
  const bannerText = document.getElementById('fw-cross-probe-text');
  if (banner && bannerText) {
    banner.classList.remove('hidden');
    bannerText.innerHTML = `C99 光标 (Ln ${lineNo}) ⇄ 硬件引脚 <strong>${escapeHtml(pinName)}</strong> · 网络 <strong>${escapeHtml(netName)}</strong> (${escapeHtml(funcName)})`;
  }
}

// ============================================================================
// 方案 C：嵌入式 C99 状态机在线仿真与虚拟传感器调试器 (🔮 SIMULATOR)
// ============================================================================
function applySimPreset(mode) {
  const adcEl = document.getElementById('sim-adc-input');
  const tempEl = document.getElementById('sim-temp-input');
  const vbatEl = document.getElementById('sim-vbat-input');
  const btnEl = document.getElementById('sim-btn-mute');

  if (mode === 'normal') {
    if (adcEl) adcEl.value = 850;
    if (tempEl) tempEl.value = 26;
    if (vbatEl) vbatEl.value = 3850;
    if (btnEl) btnEl.checked = false;
  } else if (mode === 'alarm') {
    if (adcEl) adcEl.value = 2650;
    if (tempEl) tempEl.value = 62;
    if (vbatEl) vbatEl.value = 3750;
    if (btnEl) btnEl.checked = false;
  } else if (mode === 'muted') {
    if (adcEl) adcEl.value = 2700;
    if (tempEl) tempEl.value = 64;
    if (vbatEl) vbatEl.value = 3700;
    if (btnEl) btnEl.checked = true;
  }

  const adcVal = document.getElementById('sim-adc-val');
  const tempVal = document.getElementById('sim-temp-val');
  const vbatVal = document.getElementById('sim-vbat-val');
  if (adcVal && adcEl) adcVal.textContent = `${adcEl.value} mV`;
  if (tempVal && tempEl) tempVal.textContent = `${tempEl.value}.0 °C`;
  if (vbatVal && vbatEl) vbatVal.textContent = `${vbatEl.value} mV`;

  runFirmwareOnlineSimulation();
}

async function runFirmwareOnlineSimulation() {
  if (simDebounceTimer) clearTimeout(simDebounceTimer);
  simDebounceTimer = setTimeout(async () => {
    const adcMv = parseInt(document.getElementById('sim-adc-input')?.value || '850', 10);
    const tempC = parseFloat(document.getElementById('sim-temp-input')?.value || '26');
    const vbatMv = parseInt(document.getElementById('sim-vbat-input')?.value || '3850', 10);
    const btnPressed = Boolean(document.getElementById('sim-btn-mute')?.checked);

    try {
      const res = await fetch('/api/firmware/simulate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          project_dir: activeProjectDir,
          adc_mv: adcMv,
          temp_c: tempC,
          vbat_mv: vbatMv,
          button_pressed: btnPressed,
          ticks: 12
        })
      });
      const d = await res.json();
      if (d.success) {
        renderSimulationResult(d.simulation || d);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    }
  }, 60);
}

function renderSimulationResult(sim) {
  const badge = document.getElementById('sim-fsm-state-badge');
  const waveBox = document.getElementById('sim-waveforms-box');
  const uartPre = document.getElementById('sim-uart-pre');
  const engBadge = document.getElementById('sim-engine-badge');

  const isHostCompiled = Boolean(sim.host_sandbox?.compiled || sim.host_c99_verified);
  if (engBadge) {
    engBadge.textContent = isHostCompiled
      ? `⚡ Host C99 (${sim.host_sandbox?.compiler || 'cc'} · ${sim.host_sandbox?.elapsed_ms || 0}ms)`
      : '⚡ SSOT FSM Engine';
  }

  if (badge) {
    const st = sim.fsm?.state || sim.final_state || 'STATE_NORMAL';
    const labelCn = sim.fsm?.label || sim.final_state_cn || '';
    badge.textContent = labelCn ? `${st} · ${labelCn}` : st;
    if (st.includes('ALARM_LATCHED')) {
      badge.className = 'px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold animate-pulse';
    } else if (st.includes('WARNING') || st.includes('MUTED') || st.includes('LOW')) {
      badge.className = 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold';
    } else {
      badge.className = 'px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold';
    }
  }

  if (waveBox) {
    const waves = sim.pin_waveforms || [];
    waveBox.innerHTML = waves.map(w => {
      const waveAscii = w.waveform || w.ascii_wave || '____________';
      const levelStr = w.level || w.level_summary || '';
      return `
      <div onclick="crossProbeFromHardwarePin('${escapeHtml(w.pin)}', '${escapeHtml(w.net_name)}')" class="px-2 py-1 rounded bg-slate-950/90 hover:bg-slate-800/80 border border-slate-800/80 flex items-center justify-between gap-2 cursor-pointer transition" title="点击跨屏定位 C99 代码中的 ${escapeHtml(w.macro)}">
        <div class="flex items-center gap-1.5 truncate">
          <span class="px-1.5 py-0.2 rounded bg-slate-900 text-amber-300 font-bold text-[10px]">${escapeHtml(w.pin)}</span>
          <span class="text-sky-300 font-bold truncate">${escapeHtml(w.net_name)}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="tracking-widest text-emerald-400 font-bold text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">${escapeHtml(waveAscii)}</span>
          <span class="text-[10px] text-slate-400 w-28 text-right truncate">${escapeHtml(levelStr)}</span>
        </div>
      </div>
    `;
    }).join('');
  }

  if (uartPre) {
    const uartText = sim.host_sandbox?.uart_log || (sim.uart_lines || []).join('\n');
    uartPre.textContent = uartText;
    uartPre.scrollTop = uartPre.scrollHeight;
  }
}

// 扩展命令面板目录，加入方案 A / B / C 快捷命令
if (typeof buildCommandPaletteCatalog === 'function') {
  const _origBuildCommandPaletteCatalog = buildCommandPaletteCatalog;
  buildCommandPaletteCatalog = function () {
    const baseItems = _origBuildCommandPaletteCatalog();
    const extraCmds = [
      { type: 'cmd', icon: 'fa-robot text-pink-400', title: '> Copilot: Toggle Right-Side Global AI Copilot Sidebar (开启/收起右侧全局 AI 助手)', hint: 'Scheme A', action: () => toggleGlobalCopilotSidebar() },
      { type: 'cmd', icon: 'fa-code-compare text-indigo-400', title: '> Diff: Open VS Code Side-by-Side Diff Viewer (打开 Monaco 并排代码变更审查器)', hint: 'Scheme A', action: () => openMonacoDiffModal() },
      { type: 'cmd', icon: 'fa-wave-square text-purple-400', title: '> Simulator: Open C99 FSM Online Simulator & Logic Analyzer (打开 C99 状态机在线仿真)', hint: 'Scheme C', action: () => { toggleBottomPanel('simulator'); runFirmwareOnlineSimulation(); } }
    ];
    return [...extraCmds, ...baseItems];
  };
}

// ============================================================================
// UI/UX 重构增强：支持 PCB 4 合 1 零滚动子标签 ('3d' | '2d_pcb' | '2d_sch' | 'bom')
// 以及按流向智能折叠底部诊断面板，释放 +45% 垂直可视空间
// ============================================================================
window.switchPcbCanvasView = function (viewMode = '3d') {
  currentPcbCanvasView = viewMode;
  const pane3d = document.getElementById('pcb-canvas-pane-3d');
  const pane2d = document.getElementById('pcb-canvas-pane-2d');
  const paneSch = document.getElementById('pcb-canvas-pane-sch');
  const paneBom = document.getElementById('pcb-canvas-pane-bom');

  const btn3d = document.getElementById('btn-pcb-canvas-3d');
  const btn2d = document.getElementById('btn-pcb-canvas-2d');
  const btnSch = document.getElementById('btn-pcb-canvas-sch');
  const btnBom = document.getElementById('btn-pcb-canvas-bom');

  if (pane3d) pane3d.classList.toggle('hidden', viewMode !== '3d');
  if (pane2d) pane2d.classList.toggle('hidden', viewMode !== '2d_pcb');
  if (paneSch) paneSch.classList.toggle('hidden', viewMode !== '2d_sch');
  if (paneBom) paneBom.classList.toggle('hidden', viewMode !== 'bom');

  const activeCls = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 shadow transition flex items-center gap-1.5';
  const inactiveCls = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1.5';

  if (btn3d) btn3d.className = viewMode === '3d' ? activeCls : inactiveCls;
  if (btn2d) btn2d.className = viewMode === '2d_pcb' ? activeCls : inactiveCls;
  if (btnSch) btnSch.className = viewMode === '2d_sch' ? activeCls : inactiveCls;
  if (btnBom) btnBom.className = viewMode === 'bom' ? activeCls : inactiveCls;

  if ((viewMode === '2d_pcb' || viewMode === '2d_sch') && typeof refresh2dSvgViews === 'function') {
    refresh2dSvgViews();
  }
};

if (typeof switchTab === 'function') {
  const _origSwitchTab = switchTab;
  window.switchTab = function (tabId) {
    _origSwitchTab(tabId);
    const cleanTitles = {
      dashboard: '① 项目工作台 (Project Workspace)',
      intake: '② 规格与引脚定义 (SSOT PinMux)',
      pcb: '③ PCB 硬件工坊 (KiCad / 嘉立创 JLC)',
      firmware: '④ C99 固件工坊 (Embedded C99 IDE)',
      agents: '⚡ 全自动协同流水线 (5-Stage Pipeline)',
      distiller: '🧩 Skill 知识蒸馏市场 (Extensions)',
      config: '⚙️ 引擎与模型配置 (Settings)'
    };
    const topTitleEl = document.getElementById('top-view-title');
    if (topTitleEl && cleanTitles[tabId]) {
      topTitleEl.textContent = cleanTitles[tabId];
    }
    // 在非代码/非画布模块默认收起底部诊断台，最大化首屏垂直面积
    const btmPanel = document.getElementById('vscode-bottom-panel');
    if (btmPanel && ['dashboard', 'intake', 'distiller', 'config'].includes(tabId)) {
      btmPanel.classList.add('hidden');
      bottomPanelVisible = false;
    }
    // 切换到固件工坊且 Monaco 已激活时自动触发 layout 自适应全宽
    if (tabId === 'firmware' && typeof monacoFwEditor !== 'undefined' && monacoFwEditor) {
      setTimeout(() => monacoFwEditor.layout(), 60);
    }
  };
}

