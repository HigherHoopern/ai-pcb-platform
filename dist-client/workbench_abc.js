/* Xter AI-PCB Commercial Client Build | File: workbench_abc.js | SHA256: 8e7f0ead3ce40b69 | Core Python & 324p Skills Strictly Excluded */
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
function crossProbeFromHardwarePin(pinName, netName) {
  if (!pinName && !netName) return;
  const cleanPin = (pinName || '').trim().toUpperCase();
  const cleanNet = (netName || '').trim();
  const macroStem = cleanNet.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
  document.querySelectorAll('.cross-probe-pin-row, .cross-probe-pin-chip').forEach(el => {
    const p = (el.getAttribute('data-pin') || '').toUpperCase();
    const n = (el.getAttribute('data-net') || '');
    const matched = (cleanPin && p === cleanPin) || (cleanNet && n === cleanNet);
    el.classList.toggle('cross-probe-highlight', Boolean(matched));
  });
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
  const fwPane = document.getElementById('pane-firmware');
  if (fwPane && fwPane.classList.contains('hidden') && !coDesignSplitActive) {
    toggleCoDesignSplitView();
  }
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
    const btmPanel = document.getElementById('vscode-bottom-panel');
    if (btmPanel && ['dashboard', 'intake', 'distiller', 'config'].includes(tabId)) {
      btmPanel.classList.add('hidden');
      bottomPanelVisible = false;
    }
    if (tabId === 'firmware' && typeof monacoFwEditor !== 'undefined' && monacoFwEditor) {
      setTimeout(() => monacoFwEditor.layout(), 60);
    }
  };
}
function showSidebarCollapsedTooltip(btn) {
  const sb = document.getElementById('app-sidebar');
  const tip = document.getElementById('sidebar-hover-tooltip');
  if (!sb || !tip || !btn) return;
  if (!sb.classList.contains('sidebar-collapsed')) {
    tip.classList.remove('tooltip-visible');
    return;
  }
  const rawTitle = btn.getAttribute('title');
  if (rawTitle) {
    btn.dataset.nativeTitle = rawTitle;
    btn.removeAttribute('title');
  }
  const labelEl = btn.querySelector('.sidebar-label');
  const badgeEl = btn.querySelector('.sidebar-step-badge');
  const titleText = btn.dataset.tipTitle || (labelEl ? labelEl.textContent.trim() : '') || btn.dataset.nativeTitle || '功能详情';
  const badgeText = btn.dataset.tipBadge || (badgeEl ? badgeEl.textContent.trim() : '');
  const descText = btn.dataset.tipDesc || btn.dataset.nativeTitle || '';
  const titleNode = document.getElementById('sidebar-tip-title');
  const badgeNode = document.getElementById('sidebar-tip-badge');
  const descNode = document.getElementById('sidebar-tip-desc');
  if (titleNode) titleNode.textContent = titleText;
  if (badgeNode) {
    badgeNode.textContent = badgeText;
    badgeNode.classList.toggle('hidden', !badgeText);
  }
  if (descNode) {
    descNode.textContent = descText;
    descNode.classList.toggle('hidden', !descText || descText === titleText);
  }
  const rect = btn.getBoundingClientRect();
  const leftPos = Math.round(rect.right + 12);
  const centerY = Math.min(Math.max(Math.round(rect.top + rect.height / 2), 36), window.innerHeight - 36);
  tip.style.left = `${leftPos}px`;
  tip.style.top = `${centerY}px`;
  tip.setAttribute('aria-hidden', 'false');
  tip.classList.add('tooltip-visible');
}
function hideSidebarCollapsedTooltip(btn) {
  const tip = document.getElementById('sidebar-hover-tooltip');
  if (tip) {
    tip.classList.remove('tooltip-visible');
    tip.setAttribute('aria-hidden', 'true');
  }
  if (btn && btn.dataset && btn.dataset.nativeTitle && !btn.getAttribute('title')) {
    btn.setAttribute('title', btn.dataset.nativeTitle);
  }
}
function initSidebarCollapsedTooltips() {
  const sb = document.getElementById('app-sidebar');
  if (!sb) return;
  const buttons = sb.querySelectorAll('button');
  buttons.forEach(btn => {
    if (btn.dataset.tipBound === '1') return;
    btn.dataset.tipBound = '1';
    btn.addEventListener('mouseenter', () => showSidebarCollapsedTooltip(btn));
    btn.addEventListener('mouseleave', () => hideSidebarCollapsedTooltip(btn));
    btn.addEventListener('focus', () => showSidebarCollapsedTooltip(btn));
    btn.addEventListener('blur', () => hideSidebarCollapsedTooltip(btn));
    btn.addEventListener('click', () => {
      if (btn.id === 'sidebar-collapse-btn') {
        setTimeout(() => hideSidebarCollapsedTooltip(btn), 80);
      }
    });
  });
  sb.addEventListener('scroll', () => hideSidebarCollapsedTooltip(), { passive: true });
}
if (typeof toggleSidebar === 'function') {
  const _origToggleSidebar = toggleSidebar;
  window.toggleSidebar = function () {
    hideSidebarCollapsedTooltip();
    _origToggleSidebar();
    const sb = document.getElementById('app-sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (sb && collapseBtn) {
      const isCollapsed = sb.classList.contains('sidebar-collapsed');
      collapseBtn.dataset.tipTitle = isCollapsed ? '展开侧边栏导航' : '收起侧边栏导航';
    }
    if (typeof monacoFwEditor !== 'undefined' && monacoFwEditor) {
      setTimeout(() => monacoFwEditor.layout(), 270);
    }
  };
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebarCollapsedTooltips);
} else {
  initSidebarCollapsedTooltips();
}
let explorerCollapsedDirs = new Set();
let explorerAllCollapsed = false;
let currentPreviewFileData = null;
let currentCsvShowSource = false;
function getVscodeFileIconHtml(name, kind, ext) {
  const low = (name || '').toLowerCase();
  if (low === 'spec.json') return '<i class="fa-solid fa-sliders text-amber-400 w-3.5 text-center"></i>';
  if (low === 'pinout.json') return '<i class="fa-solid fa-network-wired text-amber-400 w-3.5 text-center"></i>';
  if (ext === '.kicad_pcb') return '<i class="fa-solid fa-compass-drafting text-emerald-400 w-3.5 text-center"></i>';
  if (ext === '.kicad_sch') return '<i class="fa-solid fa-microchip text-teal-400 w-3.5 text-center"></i>';
  if (ext === '.c') return '<i class="fa-solid fa-c text-sky-400 w-3.5 text-center font-extrabold"></i>';
  if (ext === '.h') return '<i class="fa-solid fa-h text-purple-400 w-3.5 text-center font-extrabold"></i>';
  if (low === 'makefile' || ext === '.ld' || ext === '.s') return '<i class="fa-solid fa-gears text-amber-300 w-3.5 text-center"></i>';
  if (ext === '.csv') return '<i class="fa-solid fa-table-list text-emerald-300 w-3.5 text-center"></i>';
  if (ext === '.svg' || ext === '.png' || ext === '.jpg') return '<i class="fa-regular fa-image text-pink-400 w-3.5 text-center"></i>';
  if (ext === '.md') return '<i class="fa-brands fa-markdown text-indigo-400 w-3.5 text-center"></i>';
  if (ext === '.json') return '<i class="fa-solid fa-code text-amber-300 w-3.5 text-center"></i>';
  if (ext === '.elf' || ext === '.hex' || ext === '.bin') return '<i class="fa-solid fa-memory text-rose-400 w-3.5 text-center"></i>';
  if (ext === '.zip') return '<i class="fa-solid fa-file-zipper text-purple-400 w-3.5 text-center"></i>';
  return '<i class="fa-regular fa-file-lines text-slate-400 w-3.5 text-center"></i>';
}
function formatCompactSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
window.toggleExplorerFolder = function (relPath, evt) {
  if (evt) evt.stopPropagation();
  if (explorerCollapsedDirs.has(relPath)) {
    explorerCollapsedDirs.delete(relPath);
  } else {
    explorerCollapsedDirs.add(relPath);
  }
  if (typeof window.collapseAllSidebarModules === 'function') {
    window.collapseAllSidebarModules();
  }
  const tree = document.getElementById('vscode-explorer-tree');
  if (tree) {
    tree.classList.remove('hidden', 'max-h-60');
    tree.classList.add('max-h-none');
  }
  if (typeof activeProjectDetail !== 'undefined' && activeProjectDetail) {
    window.renderWorkbenchExplorerTree(activeProjectDetail);
  }
};
window.toggleAllExplorerFolders = function () {
  explorerAllCollapsed = !explorerAllCollapsed;
  if (!explorerAllCollapsed) {
    explorerCollapsedDirs.clear();
    if (typeof window.collapseAllSidebarModules === 'function') {
      window.collapseAllSidebarModules();
    }
    const tree = document.getElementById('vscode-explorer-tree');
    if (tree) {
      tree.classList.remove('hidden', 'max-h-60');
      tree.classList.add('max-h-none');
    }
  } else if (typeof activeProjectDetail !== 'undefined' && activeProjectDetail?.file_tree) {
    const collectDirs = (nodes) => {
      (nodes || []).forEach(n => {
        if (n.type === 'dir') {
          explorerCollapsedDirs.add(n.rel_path);
          collectDirs(n.children);
        }
      });
    };
    collectDirs(activeProjectDetail.file_tree.children);
  }
  if (typeof activeProjectDetail !== 'undefined' && activeProjectDetail) {
    window.renderWorkbenchExplorerTree(activeProjectDetail);
  }
};
window.renderWorkbenchExplorerTree = function (detail) {
  const treeBox = document.getElementById('vscode-explorer-tree');
  if (!treeBox || !detail) return;
  const projSel = document.getElementById('sidebar-project-select');
  if (projSel) {
    const projs = (typeof projectsCache !== 'undefined' && Array.isArray(projectsCache) && projectsCache.length > 0)
      ? projectsCache
      : [{ project_dir: detail.project_dir, project_name: detail.project_name || 'Workspace' }];
    projSel.innerHTML = projs.map(p => {
      const sel = p.project_dir === detail.project_dir ? 'selected' : '';
      return `<option value="${escapeHtml(p.project_dir)}" ${sel}>📂 ${escapeHtml(p.project_name || p.folder_name)}</option>`;
    }).join('');
  }
  const fileTree = detail.file_tree;
  if (!fileTree || !Array.isArray(fileTree.children) || fileTree.children.length === 0) {
    treeBox.innerHTML = '<div class="text-[11px] text-slate-500 px-2 py-1.5">暂无工程文件</div>';
    return;
  }
  function renderNodes(nodes, depth) {
    return (nodes || []).map(node => {
      const indentPx = depth * 11 + 4;
      if (node.type === 'dir') {
        const isCollapsed = explorerCollapsedDirs.has(node.rel_path);
        const chevron = isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down';
        const folderIcon = isCollapsed ? 'fa-folder text-amber-400/80' : 'fa-folder-open text-amber-400';
        const safeRel = (node.rel_path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const childrenHtml = isCollapsed ? '' : `<div class="border-l border-slate-200 dark:border-slate-800/70 ml-2.5">${renderNodes(node.children, depth + 1)}</div>`;
        return `
          <div>
            <div onclick="toggleExplorerFolder('${safeRel}', event)" class="vscode-tree-item flex items-center justify-between py-1 pr-2 rounded cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 font-semibold" style="padding-left:${indentPx}px" title="点击展开/收起目录: ${escapeHtml(node.rel_path)}">
              <span class="flex items-center gap-1.5 truncate">
                <i class="fa-solid ${chevron} text-[8px] text-slate-500 w-2.5 text-center"></i>
                <i class="fa-regular ${folderIcon} text-[11px]"></i>
                <span class="truncate font-mono">${escapeHtml(node.name)}</span>
              </span>
              <span class="text-[9px] text-slate-500 font-mono">${node.children_count || 0}</span>
            </div>
            ${childrenHtml}
          </div>
        `;
      } else {
        const isAct = (currentPreviewFileData && currentPreviewFileData.abs_path === node.abs_path) ||
                      (typeof currentEditingFwPath !== 'undefined' && node.abs_path === currentEditingFwPath);
        const ic = getVscodeFileIconHtml(node.name, node.kind, node.ext);
        const safePath = (node.abs_path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const safeName = (node.name || '').replace(/'/g, "\\'");
        const sizeLabel = formatCompactSize(node.size_bytes);
        return `
          <div onclick="openExplorerFileItem('${node.kind}', '${safePath}', '${safeName}')" class="vscode-tree-item ${isAct ? 'active' : ''} flex items-center justify-between py-1 pr-2 rounded cursor-pointer text-[11px]" style="padding-left:${indentPx + 8}px" title="点击预览或编辑文件: ${escapeHtml(node.rel_path)} (${sizeLabel})">
            <span class="flex items-center gap-1.5 truncate">
              ${ic}
              <span class="truncate font-mono">${escapeHtml(node.name)}</span>
            </span>
            <span class="text-[9px] text-slate-500 font-mono shrink-0 ml-1">${sizeLabel}</span>
          </div>
        `;
      }
    }).join('');
  }
  treeBox.innerHTML = renderNodes(fileTree.children, 0);
};
window.openExplorerFileItem = async function (kind, absPath, fileName) {
  if (!absPath) return;
  try {
    const projectDir = (typeof activeProjectDetail !== 'undefined' && activeProjectDetail?.project_dir) || '';
    const url = `/api/projects/file-preview?path=${encodeURIComponent(absPath)}&project_dir=${encodeURIComponent(projectDir)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) {
      if (typeof showToast === 'function') showToast(data.error || '无法预览该文件', 'error');
      return;
    }
    currentPreviewFileData = data;
    currentCsvShowSource = false;
    renderVscodeFilePreviewModal(data);
    if (typeof activeProjectDetail !== 'undefined' && activeProjectDetail) {
      window.renderWorkbenchExplorerTree(activeProjectDetail);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('加载文件预览失败: ' + err.message, 'error');
  }
};
function renderVscodeFilePreviewModal(data) {
  const modal = document.getElementById('vscode-file-preview-modal');
  if (!modal) return;
  const iconEl = document.getElementById('fprev-icon');
  const titleEl = document.getElementById('fprev-title');
  const metaEl = document.getElementById('fprev-meta-badge');
  const dirtyEl = document.getElementById('fprev-dirty-badge');
  const relEl = document.getElementById('fprev-relpath');
  const footerEl = document.getElementById('fprev-footer-info');
  const dlBtn = document.getElementById('btn-fprev-download');
  const saveBtn = document.getElementById('btn-fprev-save');
  const csvToggleBtn = document.getElementById('btn-fprev-csv-toggle');
  const studioBtnText = document.getElementById('btn-fprev-open-studio-text');
  if (iconEl) iconEl.innerHTML = getVscodeFileIconHtml(data.name, data.kind, data.ext);
  if (titleEl) titleEl.textContent = data.name;
  if (metaEl) metaEl.textContent = `${formatCompactSize(data.size_bytes)}${data.line_count ? ' · ' + data.line_count + ' 行' : ''}`;
  if (dirtyEl) dirtyEl.classList.add('hidden');
  if (relEl) relEl.textContent = `${activeProjectDetail?.project_name || 'workspace'} › ${data.rel_path}`;
  if (footerEl) footerEl.textContent = `${data.rel_path} · 最后修改: ${data.mtime || '-'} · ${data.editable ? '可直接编辑并保存' : '只读预览'}`;
  if (dlBtn) {
    dlBtn.href = `/api/projects/download?path=${encodeURIComponent(data.abs_path)}`;
    dlBtn.setAttribute('download', data.name);
  }
  if (saveBtn) {
    saveBtn.classList.toggle('hidden', !data.editable);
  }
  if (csvToggleBtn) {
    csvToggleBtn.classList.toggle('hidden', data.preview_mode !== 'csv');
  }
  if (studioBtnText) {
    if (data.kind === 'ssot_spec' || data.kind === 'ssot_pinout') {
      studioBtnText.textContent = '在 ② 规格与引脚 (SSOT) 中打开';
    } else if (data.kind === 'fw_source') {
      studioBtnText.textContent = '在 ④ C99 固件工坊编辑器中打开';
    } else if (['pcb_board', 'sch_sheet', 'csv_table', 'svg_vector', 'image', 'gerber'].includes(data.kind)) {
      studioBtnText.textContent = '在 ③ PCB 硬件工坊中打开';
    } else {
      studioBtnText.textContent = '定位到所属工坊';
    }
  }
  const codePane = document.getElementById('fprev-code-pane');
  const csvPane = document.getElementById('fprev-csv-pane');
  const imgPane = document.getElementById('fprev-image-pane');
  const editor = document.getElementById('fprev-code-editor');
  const lineNums = document.getElementById('fprev-line-numbers');
  const imgEl = document.getElementById('fprev-image-el');
  if (data.preview_mode === 'image') {
    codePane.classList.add('hidden');
    csvPane.classList.add('hidden');
    imgPane.classList.remove('hidden');
    if (imgEl) {
      imgEl.src = `/api/projects/download?path=${encodeURIComponent(data.abs_path)}&t=${Date.now()}`;
    }
  } else if (data.preview_mode === 'csv' && data.csv_table && !currentCsvShowSource) {
    codePane.classList.add('hidden');
    imgPane.classList.add('hidden');
    csvPane.classList.remove('hidden');
    const thead = document.getElementById('fprev-csv-thead');
    const tbody = document.getElementById('fprev-csv-tbody');
    if (thead) {
      thead.innerHTML = `<tr>${(data.csv_table.headers || []).map(h => `<th class="py-2 px-2.5 border-b border-slate-800">${escapeHtml(h)}</th>`).join('')}</tr>`;
    }
    if (tbody) {
      tbody.innerHTML = (data.csv_table.rows || []).map(row => `
        <tr class="hover:bg-slate-900/60">
          ${row.map(cell => `<td class="py-1.5 px-2.5 text-slate-200">${escapeHtml(cell)}</td>`).join('')}
        </tr>
      `).join('');
    }
  } else {
    csvPane.classList.add('hidden');
    imgPane.classList.add('hidden');
    codePane.classList.remove('hidden');
    if (editor) {
      editor.value = data.content || '';
      editor.readOnly = !data.editable;
      editor.scrollTop = 0;
    }
    if (lineNums) {
      const cnt = Math.max(1, (data.content || '').split('\n').length);
      lineNums.textContent = Array.from({ length: cnt }, (_, i) => i + 1).join('\n');
      lineNums.scrollTop = 0;
    }
  }
  modal.classList.remove('hidden');
}
window.toggleCsvPreviewMode = function () {
  if (!currentPreviewFileData) return;
  currentCsvShowSource = !currentCsvShowSource;
  renderVscodeFilePreviewModal(currentPreviewFileData);
};
window.onFprevEditorInput = function () {
  const editor = document.getElementById('fprev-code-editor');
  const lineNums = document.getElementById('fprev-line-numbers');
  const dirtyEl = document.getElementById('fprev-dirty-badge');
  if (dirtyEl) dirtyEl.classList.remove('hidden');
  if (editor && lineNums) {
    const cnt = Math.max(1, editor.value.split('\n').length);
    lineNums.textContent = Array.from({ length: cnt }, (_, i) => i + 1).join('\n');
  }
};
window.savePreviewedFileContent = async function () {
  if (!currentPreviewFileData || !currentPreviewFileData.editable) return;
  const editor = document.getElementById('fprev-code-editor');
  if (!editor) return;
  try {
    const res = await fetch('/api/projects/file-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_dir: activeProjectDetail?.project_dir || '',
        path: currentPreviewFileData.abs_path,
        content: editor.value
      })
    });
    const out = await res.json();
    if (out.success) {
      currentPreviewFileData.content = editor.value;
      const dirtyEl = document.getElementById('fprev-dirty-badge');
      if (dirtyEl) dirtyEl.classList.add('hidden');
      if (out.detail) {
        activeProjectDetail = out.detail;
        if (typeof renderReviewPane === 'function') renderReviewPane();
      }
      if (typeof showToast === 'function') showToast(`已保存文件: ${currentPreviewFileData.name}`);
    } else {
      if (typeof showToast === 'function') showToast(out.error || '保存失败', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('保存失败: ' + err.message, 'error');
  }
};
window.openPreviewedFileInStudio = async function () {
  if (!currentPreviewFileData) return;
  const d = currentPreviewFileData;
  closeVscodeFilePreviewModal();
  if (d.kind === 'ssot_spec' || d.kind === 'ssot_pinout') {
    switchTab('intake');
  } else if (d.kind === 'fw_source') {
    if (!coDesignSplitActive) switchTab('firmware');
    if (typeof viewFirmwareSource === 'function') {
      await viewFirmwareSource(d.abs_path, d.name);
    }
  } else if (d.kind === 'pcb_board') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('3d');
  } else if (d.kind === 'sch_sheet' || (d.kind === 'svg_vector' && d.name.includes('sch'))) {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('2d_sch');
  } else if (d.kind === 'svg_vector') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('2d_pcb');
  } else if (d.kind === 'csv_table') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('bom');
  } else {
    switchTab('pcb');
  }
};
window.closeVscodeFilePreviewModal = function () {
  const modal = document.getElementById('vscode-file-preview-modal');
  if (modal) modal.classList.add('hidden');
};
const ALL_SIDEBAR_SECTIONS = ['core-flow', 'ai-eco', 'user-guide', 'local-bridge'];
window.setSidebarSectionCollapsed = function (sectionId, collapsed) {
  const secEl = document.getElementById(`sidebar-sec-${sectionId}`);
  const chevEl = document.getElementById(`sidebar-chevron-${sectionId}`);
  if (!secEl) return;
  secEl.classList.toggle('hidden', Boolean(collapsed));
  if (chevEl) {
    chevEl.classList.toggle('fa-chevron-down', !collapsed);
    chevEl.classList.toggle('fa-chevron-right', Boolean(collapsed));
  }
  try {
    localStorage.setItem(`ai_pcb_sidebar_sec_${sectionId}`, collapsed ? 'collapsed' : 'expanded');
  } catch (e) {}
};
window.collapseAllSidebarModules = function () {
  ALL_SIDEBAR_SECTIONS.forEach(secId => {
    window.setSidebarSectionCollapsed(secId, true);
  });
};
window.focusFullExplorerTree = function () {
  const tree = document.getElementById('vscode-explorer-tree');
  const icon = document.getElementById('explorer-chevron-icon');
  const sb = document.getElementById('app-sidebar');
  window.collapseAllSidebarModules();
  if (tree) {
    tree.classList.remove('hidden', 'max-h-60');
    tree.classList.add('max-h-none');
  }
  if (icon) {
    icon.className = 'fa-solid fa-chevron-down text-[9px] text-sky-400';
  }
  explorerCollapsedDirs.clear();
  explorerAllCollapsed = false;
  if (typeof activeProjectDetail !== 'undefined' && activeProjectDetail) {
    window.renderWorkbenchExplorerTree(activeProjectDetail);
  }
  if (sb) {
    sb.scrollTop = 0;
  }
};
window.toggleExplorerTreeCollapse = function () {
  const tree = document.getElementById('vscode-explorer-tree');
  const icon = document.getElementById('explorer-chevron-icon');
  if (!tree) return;
  const isTreeHidden = tree.classList.contains('hidden');
  const hasOtherModuleExpanded = ALL_SIDEBAR_SECTIONS.some(secId => {
    const el = document.getElementById(`sidebar-sec-${secId}`);
    return el && !el.classList.contains('hidden');
  });
  const hasCollapsedSubdirs = explorerCollapsedDirs.size > 0;
  if (isTreeHidden || hasOtherModuleExpanded || hasCollapsedSubdirs) {
    window.focusFullExplorerTree();
  } else {
    tree.classList.add('hidden');
    if (icon) {
      icon.className = 'fa-solid fa-chevron-right text-[9px] text-slate-400';
    }
    window.setSidebarSectionCollapsed('core-flow', false);
  }
};
window.toggleSidebarSection = function (sectionId) {
  const secEl = document.getElementById(`sidebar-sec-${sectionId}`);
  if (!secEl) return;
  const willCollapse = !secEl.classList.contains('hidden');
  window.setSidebarSectionCollapsed(sectionId, willCollapse);
  if (!willCollapse) {
    const tree = document.getElementById('vscode-explorer-tree');
    const icon = document.getElementById('explorer-chevron-icon');
    if (tree && !tree.classList.contains('hidden')) {
      tree.classList.add('hidden');
      if (icon) {
        icon.className = 'fa-solid fa-chevron-right text-[9px] text-slate-400';
      }
    }
  }
};
function restoreSidebarSectionsState() {
  ALL_SIDEBAR_SECTIONS.forEach(sectionId => {
    try {
      const saved = localStorage.getItem(`ai_pcb_sidebar_sec_${sectionId}`);
      if (saved === 'collapsed') {
        window.setSidebarSectionCollapsed(sectionId, true);
      }
    } catch (e) {}
  });
}
window.openUserGuideSection = function (sectionKey = 'all') {
  if (typeof switchTab === 'function') {
    switchTab('guide');
  }
  ['tab-guide', 'tab-guide-pcb', 'tab-guide-c99'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      el.classList.add('text-slate-400');
    }
  });
  const activeSidebarId = sectionKey === 'pcb'
    ? 'tab-guide-pcb'
    : sectionKey === 'c99'
      ? 'tab-guide-c99'
      : 'tab-guide';
  const activeSidebarBtn = document.getElementById(activeSidebarId);
  if (activeSidebarBtn) {
    activeSidebarBtn.classList.add('active');
    activeSidebarBtn.classList.remove('text-slate-400');
  }
  filterGuideSections('all', sectionKey);
  if (sectionKey === 'pcb' || sectionKey === 'c99' || sectionKey === 'flowchart') {
    const targetId = sectionKey === 'pcb'
      ? 'guide-sec-pcb'
      : sectionKey === 'c99'
        ? 'guide-sec-c99'
        : 'guide-sec-flowchart';
    setTimeout(() => {
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetEl.classList.add('cross-probe-highlight');
        setTimeout(() => targetEl.classList.remove('cross-probe-highlight'), 2400);
      }
    }, 80);
  } else {
    const scrollArea = document.getElementById('app-main-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
  }
};
window.filterGuideSections = function (mode = 'all', activePillOverride = null) {
  const pillKey = activePillOverride || mode;
  const pills = ['all', 'flowchart', 'pcb', 'c99', 'quickstart'];
  pills.forEach(k => {
    const btn = document.getElementById(`guide-pill-${k}`);
    if (!btn) return;
    if (k === pillKey) {
      btn.className = 'px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs shadow transition flex items-center gap-1.5';
    } else {
      btn.className = 'px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition flex items-center gap-1.5';
    }
  });
  const sections = {
    flowchart: document.getElementById('guide-sec-flowchart'),
    pcb: document.getElementById('guide-sec-pcb'),
    c99: document.getElementById('guide-sec-c99'),
    quickstart: document.getElementById('guide-sec-quickstart')
  };
  Object.entries(sections).forEach(([k, el]) => {
    if (!el) return;
    if (mode === 'all') {
      el.classList.remove('hidden');
    } else {
      el.classList.toggle('hidden', k !== mode);
    }
  });
};
document.addEventListener('DOMContentLoaded', () => {
  restoreSidebarSectionsState();
});
