/* Xter AI-PCB Commercial Client Build | File: workbench_abc.js | SHA256: a7b59f9d04f595a4 | Core Python & 324p Skills Strictly Excluded */
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
  const edgeHandle = document.getElementById('right-sidebar-edge-handle');
  const edgeIcon = document.getElementById('right-sidebar-edge-icon');
  if (!sidebar) return;
  globalCopilotOpen = (forceState !== null) ? Boolean(forceState) : !globalCopilotOpen;
  sidebar.classList.toggle('hidden', !globalCopilotOpen);
  document.body.classList.toggle('global-copilot-open', globalCopilotOpen);
  if (edgeHandle) {
    edgeHandle.style.right = globalCopilotOpen ? '24rem' : '0px';
    edgeHandle.title = globalCopilotOpen ? '收起右侧「🧭 维吉尔 · Virgil」领航边栏' : '展开右侧「🧭 维吉尔 · Virgil」领航边栏';
  }
  if (edgeIcon) {
    edgeIcon.className = globalCopilotOpen
      ? 'fa-solid fa-chevron-right text-[10px] text-pink-400'
      : 'fa-solid fa-chevron-left text-[10px] text-pink-400';
  }
  if (headerBtn) {
    headerBtn.className = globalCopilotOpen
      ? 'px-2.5 py-1 rounded text-[11px] font-bold bg-pink-500 text-slate-950 transition flex items-center gap-1.5 shadow'
      : 'px-2.5 py-1 rounded text-[11px] font-bold text-pink-300 hover:text-white bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 flex items-center gap-1.5 transition';
  }
  if (actBtn) {
    actBtn.classList.toggle('text-pink-400', globalCopilotOpen);
    actBtn.classList.toggle('bg-slate-900/90', globalCopilotOpen);
  }
  try {
    localStorage.setItem('ai_pcb_refinement_sidebar_open', globalCopilotOpen ? '1' : '0');
  } catch (e) {}
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
    firmware: 'gcop-target-fw',
    both: 'gcop-target-both'
  };
  Object.entries(map).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = (k === globalCopilotTarget)
      ? 'px-1.5 py-1 rounded-md bg-pink-500 text-slate-950 font-bold text-[10px] transition text-center shadow'
      : 'px-1.5 py-1 rounded-md text-slate-400 hover:text-white text-[10px] transition text-center';
  });
  renderRefinementContextualSuggestions(globalCopilotTarget);
}
function renderRefinementContextualSuggestions(target) {
  const tagsBox = document.getElementById('gcop-category-tags');
  const quickBox = document.getElementById('gcop-quick-prompts');
  const hintEl = document.getElementById('gcop-active-mode-hint');
  if (hintEl) {
    const labels = {
      auto: '智能识别模块',
      pcb: '📐 PCB 改板模式',
      firmware: '💻 C99 改码模式',
      both: '🔄 软硬件同步精修'
    };
    hintEl.textContent = labels[target] || '自适应';
  }
  if (tagsBox) {
    if (target === 'pcb') {
      tagsBox.innerHTML = `
        <button type="button" onclick="appendGlobalRefinementTag('【板框与尺寸调整】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-emerald-500/20 text-emerald-300 border border-slate-700 text-[10px] transition">📐 板框/尺寸</button>
        <button type="button" onclick="appendGlobalRefinementTag('【元件位置与布局优化】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-sky-500/20 text-sky-300 border border-slate-700 text-[10px] transition">📍 器件布局</button>
        <button type="button" onclick="appendGlobalRefinementTag('【走线间距与DRC修复】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-500/20 text-rose-300 border border-slate-700 text-[10px] transition">⚡ 走线/DRC违规</button>
        <button type="button" onclick="appendGlobalRefinementTag('【引脚增删与接口修改】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/20 text-amber-300 border border-slate-700 text-[10px] transition">📌 引脚/接口</button>
        <button type="button" onclick="appendGlobalRefinementTag('【嘉立创SMT基础库优化】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-purple-500/20 text-purple-300 border border-slate-700 text-[10px] transition">🏭 立创BOM换料</button>
      `;
    } else if (target === 'firmware') {
      tagsBox.innerHTML = `
        <button type="button" onclick="appendGlobalRefinementTag('【GCC编译报错修复】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-500/20 text-rose-300 border border-slate-700 text-[10px] transition">🔨 编译报错修复</button>
        <button type="button" onclick="appendGlobalRefinementTag('【状态机与报警阈值调整】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-sky-500/20 text-sky-300 border border-slate-700 text-[10px] transition">🔄 状态机/阈值</button>
        <button type="button" onclick="appendGlobalRefinementTag('【补全漏写引脚C99驱动】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-emerald-500/20 text-emerald-300 border border-slate-700 text-[10px] transition">📌 漏写引脚驱动</button>
        <button type="button" onclick="appendGlobalRefinementTag('【按键消抖与时序优化】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/20 text-amber-300 border border-slate-700 text-[10px] transition">⏱️ 消抖/时序</button>
        <button type="button" onclick="appendGlobalRefinementTag('【在线仿真波形修正】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-purple-500/20 text-purple-300 border border-slate-700 text-[10px] transition">🔮 仿真波形</button>
      `;
    } else {
      tagsBox.innerHTML = `
        <button type="button" onclick="appendGlobalRefinementTag('【板框与尺寸调整】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-emerald-500/20 text-emerald-300 border border-slate-700 text-[10px] transition">📐 板框/尺寸</button>
        <button type="button" onclick="appendGlobalRefinementTag('【元件位置与布局优化】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-sky-500/20 text-sky-300 border border-slate-700 text-[10px] transition">📍 器件布局</button>
        <button type="button" onclick="appendGlobalRefinementTag('【走线间距与DRC修复】', 'pcb')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-500/20 text-rose-300 border border-slate-700 text-[10px] transition">⚡ 走线/DRC</button>
        <button type="button" onclick="appendGlobalRefinementTag('【GCC编译报错修复】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-amber-500/20 text-amber-300 border border-slate-700 text-[10px] transition">🔨 编译修复</button>
        <button type="button" onclick="appendGlobalRefinementTag('【状态机与报警阈值调整】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-indigo-500/20 text-indigo-300 border border-slate-700 text-[10px] transition">🔄 状态机/阈值</button>
        <button type="button" onclick="appendGlobalRefinementTag('【补全漏写引脚C99驱动】', 'firmware')" class="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-purple-500/20 text-purple-300 border border-slate-700 text-[10px] transition">📌 引脚驱动</button>
      `;
    }
  }
  if (quickBox) {
    if (target === 'pcb') {
      quickBox.innerHTML = `
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('请将 PCB 板框尺寸调整为 65x45mm，四角倒角 R2.0mm，重新自动布局走线并刷新 3D 渲染', 'pcb')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800">📐 改板框 65×45mm 并重绘</button>
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('请结合 @drc 自动诊断并自愈当前 PCB 全部间距违规与未连接飞线', 'pcb')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800">🩺 自动自愈全部 DRC 冲突</button>
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('把蜂鸣器与报警灯移到板边 (50, 20) 附近并重新规划 45° 走线', 'pcb')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800">📍 移动蜂鸣器至板边</button>
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('将 BOM 中所有扩展库阻容器件替换为嘉立创 SMT 基础库 (Basic) 器件', 'pcb')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-800">🏭 全转嘉立创基础库</button>
      `;
    } else if (target === 'firmware') {
      quickBox.innerHTML = `
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('检查当前 @pinout 与 @gcc，补全所有未覆盖的引脚宏初始化与 20ms 消抖逻辑并重新编译', 'firmware')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800">✨ 补全 100% 引脚驱动并编译</button>
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('将温度报警阈值改为 55.0°C、低压阈值改为 3000mV，更新状态机代码并调用 GCC 重新编译', 'firmware')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800">🌡️ 调整温湿度/电压报警阈值</button>
        <button type="button" onclick="sendCompilerLogToGlobalRefinement()" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800">🔨 发送 GCC 日志修复报错</button>
        <button type="button" onclick="openMonacoDiffModal()" class="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30">🔍 查看代码并排 Diff</button>
      `;
    } else {
      quickBox.innerHTML = `
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('请将 PCB 板框尺寸调整为 65x45mm，四角倒角 R2.0mm，重新自动布局走线并刷新 3D 渲染', 'pcb')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800">📐 改板框 65×45mm 并重绘</button>
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('请结合 @drc 自动诊断并自愈当前 PCB 全部间距违规与未连接飞线', 'pcb')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800">🩺 自动修复全部 DRC 违规</button>
        <button type="button" onclick="sendGlobalCopilotQuickPrompt('检查当前 @pinout 与 @gcc，补全所有未覆盖的引脚宏初始化与 20ms 消抖逻辑并重新编译', 'firmware')" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-800">💻 补全全引脚 C99 驱动并编译</button>
        <button type="button" onclick="sendCompilerLogToGlobalRefinement()" class="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-rose-300 border border-slate-800">🔨 发送 GCC 日志修复报错</button>
      `;
    }
  }
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
    lower.includes('代码') ||
    lower.includes('阈值') ||
    lower.includes('编译')
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
    lower.includes('坐标') ||
    lower.includes('尺寸')
  ) {
    return 'pcb';
  }
  const fwPane = document.getElementById('pane-firmware');
  if (fwPane && !fwPane.classList.contains('hidden') && !coDesignSplitActive) {
    return 'firmware';
  }
  return 'pcb';
}
async function sendGlobalCopilotQuickPrompt(promptText, targetOverride = null) {
  if (targetOverride) {
    setGlobalCopilotTarget(targetOverride);
  }
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
    showToast('请先输入您的 PCB 或 C99 设计精修要求', 'warn');
    return;
  }
  const rawText = input.value.trim();
  input.value = '';
  const modulesToRun = globalCopilotTarget === 'both'
    ? ['pcb', 'firmware']
    : [resolveGlobalCopilotModule(rawText)];
  const ctxHeader = buildGlobalCopilotContextSummary();
  const activePillsArr = Object.entries(activeCopilotPills).filter(([, v]) => v).map(([k]) => `@${k}`);
  const targetBadge = modulesToRun.length > 1 ? 'PCB + C99 联动' : (modulesToRun[0] === 'firmware' ? 'C99 固件精修' : 'PCB 改板精修');
  if (box) {
    const userDiv = document.createElement('div');
    userDiv.className = 'flex flex-col items-end';
    userDiv.innerHTML = `
      <div class="max-w-[92%] rounded-2xl rounded-tr-sm px-3 py-2 bg-pink-600 text-white text-xs leading-relaxed shadow">
        <div class="text-[10px] font-mono text-pink-200 mb-0.5">${escapeHtml(activePillsArr.join(' '))} → [${escapeHtml(targetBadge)}]</div>
        ${escapeHtml(rawText)}
      </div>
    `;
    box.appendChild(userDiv);
    box.scrollTop = box.scrollHeight;
  }
  if (sendBtn) sendBtn.disabled = true;
  if (statusEl) statusEl.innerText = `正在执行 [${targetBadge}]...`;
  try {
    for (const targetModule of modulesToRun) {
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
            <span>🧭 维吉尔 (Virgil) · ${targetModule === 'firmware' ? 'C99 固件领航' : 'PCB 版图领航'}</span>
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
    }
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (statusEl) statusEl.innerText = 'Virgil Ready · 自动快照保护';
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
      const safeRel = (node.rel_path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const safeName = (node.name || '').replace(/'/g, "\\'");
      if (node.type === 'dir') {
        const isCollapsed = explorerCollapsedDirs.has(node.rel_path);
        const chevron = isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down';
        const folderIcon = isCollapsed ? 'fa-folder text-amber-400/80' : 'fa-folder-open text-amber-400';
        const childrenHtml = isCollapsed ? '' : `<div class="border-l border-slate-200 dark:border-slate-800/70 ml-2.5">${renderNodes(node.children, depth + 1)}</div>`;
        return `
          <div>
            <div onclick="toggleExplorerFolder('${safeRel}', event)" class="vscode-tree-item group flex items-center justify-between py-1 pr-1.5 rounded cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 font-semibold" style="padding-left:${indentPx}px" title="目录: ${escapeHtml(node.rel_path)} (悬浮右侧可新建子目录/文件、重命名或删除)">
              <span class="flex items-center gap-1.5 truncate">
                <i class="fa-solid ${chevron} text-[8px] text-slate-500 w-2.5 text-center"></i>
                <i class="fa-regular ${folderIcon} text-[11px]"></i>
                <span class="truncate font-mono">${escapeHtml(node.name)}</span>
              </span>
              <span class="flex items-center gap-1 shrink-0 ml-1">
                <span class="tree-row-actions inline-flex items-center gap-0.5 bg-slate-200/90 dark:bg-slate-800/95 px-1 py-0.5 rounded">
                  <button type="button" onclick="openExplorerFsModal('newfile', '${safeRel}', event)" class="px-1 hover:text-emerald-500 dark:hover:text-emerald-400 text-slate-500 dark:text-slate-300" title="在此文件夹下新建文件">
                    <i class="fa-solid fa-file-circle-plus text-[9px]"></i>
                  </button>
                  <button type="button" onclick="openExplorerFsModal('mkdir', '${safeRel}', event)" class="px-1 hover:text-sky-500 dark:hover:text-sky-400 text-slate-500 dark:text-slate-300" title="在此文件夹下新建子文件夹">
                    <i class="fa-solid fa-folder-plus text-[9px]"></i>
                  </button>
                  <button type="button" onclick="openExplorerFsModal('rename', '${safeRel}', event, 'dir', '${safeName}')" class="px-1 hover:text-amber-500 dark:hover:text-amber-400 text-slate-500 dark:text-slate-300" title="重命名或移动该文件夹">
                    <i class="fa-solid fa-pen text-[9px]"></i>
                  </button>
                  <button type="button" onclick="openExplorerFsModal('delete', '${safeRel}', event, 'dir', '${safeName}')" class="px-1 hover:text-rose-500 dark:hover:text-rose-400 text-slate-500 dark:text-slate-300" title="删除该文件夹">
                    <i class="fa-regular fa-trash-can text-[9px]"></i>
                  </button>
                </span>
                <span class="text-[9px] text-slate-500 font-mono">${node.children_count || 0}</span>
              </span>
            </div>
            ${childrenHtml}
          </div>
        `;
      } else {
        const isAct = (currentPreviewFileData && currentPreviewFileData.abs_path === node.abs_path) ||
                      (typeof currentEditingFwPath !== 'undefined' && node.abs_path === currentEditingFwPath);
        const ic = getVscodeFileIconHtml(node.name, node.kind, node.ext);
        const safePath = (node.abs_path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const sizeLabel = formatCompactSize(node.size_bytes);
        return `
          <div onclick="openExplorerFileItem('${node.kind}', '${safePath}', '${safeName}')" class="vscode-tree-item group ${isAct ? 'active' : ''} flex items-center justify-between py-1 pr-1.5 rounded cursor-pointer text-[11px]" style="padding-left:${indentPx + 8}px" title="点击预览或编辑文件: ${escapeHtml(node.rel_path)} (${sizeLabel})">
            <span class="flex items-center gap-1.5 truncate">
              ${ic}
              <span class="truncate font-mono">${escapeHtml(node.name)}</span>
            </span>
            <span class="flex items-center gap-1 shrink-0 ml-1">
              <span class="tree-row-actions inline-flex items-center gap-0.5 bg-slate-200/90 dark:bg-slate-800/95 px-1 py-0.5 rounded">
                <button type="button" onclick="openExplorerFsModal('rename', '${safeRel}', event, 'file', '${safeName}')" class="px-1 hover:text-amber-500 dark:hover:text-amber-400 text-slate-500 dark:text-slate-300" title="重命名或移动该文件">
                  <i class="fa-solid fa-pen text-[9px]"></i>
                </button>
                <button type="button" onclick="openExplorerFsModal('delete', '${safeRel}', event, 'file', '${safeName}')" class="px-1 hover:text-rose-500 dark:hover:text-rose-400 text-slate-500 dark:text-slate-300" title="删除该文件">
                  <i class="fa-regular fa-trash-can text-[9px]"></i>
                </button>
              </span>
              <span class="text-[9px] text-slate-500 font-mono">${sizeLabel}</span>
            </span>
          </div>
        `;
      }
    }).join('');
  }
  const quickBarHtml = `
    <div class="flex items-center justify-between gap-1 px-1.5 py-1 mb-1 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 text-[10px]">
      <button type="button" onclick="openExplorerFsModal('mkdir', '')" class="flex-1 py-0.5 px-1.5 rounded hover:bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center gap-1 transition" title="在当前工程内新建文件夹">
        <i class="fa-solid fa-folder-plus text-[9px]"></i> 新建文件夹
      </button>
      <span class="text-slate-300 dark:text-slate-700">|</span>
      <button type="button" onclick="openExplorerFsModal('newfile', '')" class="flex-1 py-0.5 px-1.5 rounded hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1 transition" title="在当前工程内新建文件">
        <i class="fa-solid fa-file-circle-plus text-[9px]"></i> 新建文件
      </button>
    </div>
  `;
  treeBox.innerHTML = quickBarHtml + renderNodes(fileTree.children, 0);
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
  try {
    const savedOpen = localStorage.getItem('ai_pcb_refinement_sidebar_open');
    if (savedOpen === '1') {
      toggleGlobalCopilotSidebar(true);
    }
  } catch (e) {}
});
window.openRefinementSidebar = function (target = 'auto') {
  toggleGlobalCopilotSidebar(true);
  setGlobalCopilotTarget(target);
  const inputEl = document.getElementById('global-copilot-input');
  if (inputEl) {
    setTimeout(() => inputEl.focus(), 100);
  }
};
window.focusStudioFeedbackBox = function (module = 'pcb') {
  window.openRefinementSidebar(module === 'firmware' ? 'firmware' : 'pcb');
};
window.openContextualFeedbackWindow = function () {
  toggleGlobalCopilotSidebar();
};
window.appendGlobalRefinementTag = function (tagText, targetOverride = null) {
  if (targetOverride) {
    setGlobalCopilotTarget(targetOverride);
  }
  const inputEl = document.getElementById('global-copilot-input');
  if (!inputEl) return;
  const cur = inputEl.value.trim();
  if (!cur) {
    inputEl.value = `${tagText} `;
  } else if (!cur.includes(tagText)) {
    inputEl.value = `${tagText} ${cur}`;
  }
  inputEl.focus();
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
};
window.sendCompilerLogToGlobalRefinement = async function () {
  toggleGlobalCopilotSidebar(true);
  setGlobalCopilotTarget('firmware');
  const logEl = document.getElementById('rev-fw-verify-log');
  const rawLog = (logEl ? logEl.innerText : '').trim();
  const prompt = rawLog
    ? `【GCC编译报错修复】请分析以下 ARM-GCC 编译输出日志，修复或优化当前 C99 源码并重新编译验证：\n${rawLog.slice(0, 600)}`
    : `【GCC编译报错修复】请检查当前 C99 固件源码与 bsp_pinout.h 的一致性，执行交叉编译验证并汇报 Flash/SRAM 占用`;
  await sendGlobalCopilotQuickPrompt(prompt, 'firmware');
};
window.clearGlobalRefinementHistory = async function () {
  const box = document.getElementById('global-copilot-messages');
  if (box) {
    box.innerHTML = `
      <div class="p-3 rounded-xl bg-slate-900/90 border border-pink-500/30 text-slate-200 leading-relaxed space-y-1.5">
        <div class="font-bold text-pink-300 flex items-center justify-between">
          <span><i class="fa-solid fa-compass mr-1"></i> 🧭 维吉尔 (Virgil) · 领航记录已重置</span>
          <span class="text-[10px] font-mono text-slate-400">快照保护 + Diff</span>
        </div>
        <p class="text-[11px] text-slate-300 leading-relaxed">
          历史对话已清空。我是你的理性与技艺引路人，随时可针对 <b>PCB 电路板</b> 或 <b>C99 固件程序</b> 提出新的修改要求！
        </p>
      </div>
    `;
  }
  if (typeof clearCopilotChat === 'function') {
    await clearCopilotChat('pcb');
    await clearCopilotChat('firmware');
  }
};
let efsCurrentState = {
  mode: 'mkdir', // 'mkdir' | 'newfile' | 'rename' | 'delete'
  baseRelPath: '',
  itemType: 'dir',
  itemName: ''
};
function collectAllProjectDirectories(detail) {
  const dirs = [''];
  const walk = (nodes) => {
    (nodes || []).forEach(n => {
      if (n.type === 'dir' && n.rel_path) {
        dirs.push(n.rel_path);
        walk(n.children);
      }
    });
  };
  if (detail && detail.file_tree && Array.isArray(detail.file_tree.children)) {
    walk(detail.file_tree.children);
  }
  ['hardware', 'firmware', 'firmware/App', 'firmware/Inc', 'firmware/Drivers', 'docs'].forEach(std => {
    if (!dirs.includes(std)) dirs.push(std);
  });
  return dirs;
}
window.openNewProjectModal = function () {
  window.openExplorerFsModal('mkdir', '');
};
window.openExplorerFsModal = function (mode = 'mkdir', baseRelPath = '', evt = null, itemType = 'dir', itemName = '') {
  if (evt && typeof evt.stopPropagation === 'function') {
    evt.stopPropagation();
  }
  const modal = document.getElementById('explorer-fs-modal');
  if (!modal) return;
  efsCurrentState = {
    mode: mode || 'mkdir',
    baseRelPath: baseRelPath || '',
    itemType: itemType || 'dir',
    itemName: itemName || ''
  };
  const parentSel = document.getElementById('efs-parent-dir-select');
  const pillsBox = document.getElementById('efs-quick-parent-pills');
  const allDirs = collectAllProjectDirectories(typeof activeProjectDetail !== 'undefined' ? activeProjectDetail : null);
  if (parentSel) {
    parentSel.innerHTML = allDirs.map(d => {
      const label = d ? `📁 /${d}` : '📂 / (当前工程根目录)';
      const sel = d === efsCurrentState.baseRelPath ? 'selected' : '';
      return `<option value="${escapeHtml(d)}" ${sel}>${escapeHtml(label)}</option>`;
    }).join('');
  }
  if (pillsBox) {
    const quickDirs = ['', 'hardware', 'firmware/App', 'firmware/Inc', 'firmware/Drivers', 'docs'];
    pillsBox.innerHTML = quickDirs.map(d => {
      const safeD = d.replace(/'/g, "\\'");
      const label = d ? d : '/ 根目录';
      return `<button type="button" onclick="document.getElementById('efs-parent-dir-select').value='${safeD}'; updateEfsPathPreview();" class="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-mono">${escapeHtml(label)}</button>`;
    }).join('');
  }
  window.switchExplorerFsModalMode(efsCurrentState.mode, true);
  modal.classList.remove('hidden');
};
window.switchExplorerFsModalMode = function (mode, keepState = false) {
  efsCurrentState.mode = mode;
  const iconEl = document.getElementById('efs-modal-icon');
  const titleEl = document.getElementById('efs-modal-title');
  const subEl = document.getElementById('efs-modal-subtitle');
  const modeTabs = document.getElementById('efs-mode-tabs');
  const tabMkdir = document.getElementById('efs-tab-mkdir');
  const tabNewfile = document.getElementById('efs-tab-newfile');
  const parentGroup = document.getElementById('efs-parent-dir-group');
  const nameGroup = document.getElementById('efs-name-input-group');
  const nameLabel = document.getElementById('efs-name-label');
  const nameInput = document.getElementById('efs-name-input');
  const tplGroup = document.getElementById('efs-file-templates-group');
  const delBox = document.getElementById('efs-delete-confirm-box');
  const delDesc = document.getElementById('efs-delete-target-desc');
  const submitBtn = document.getElementById('btn-efs-submit');
  const submitText = document.getElementById('btn-efs-submit-text');
  if (tabMkdir && tabNewfile) {
    tabMkdir.className = mode === 'mkdir'
      ? 'flex-1 py-1.5 px-3 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition'
      : 'flex-1 py-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition';
    tabNewfile.className = mode === 'newfile'
      ? 'flex-1 py-1.5 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition'
      : 'flex-1 py-1.5 px-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition';
  }
  if (mode === 'mkdir') {
    if (iconEl) iconEl.className = 'fa-solid fa-folder-plus text-sky-400';
    if (titleEl) titleEl.textContent = '📁 新建工程子文件夹 (New Folder)';
    if (subEl) subEl.textContent = '在当前工程目录树中创建新的文件夹（支持多级嵌套路径）';
    if (modeTabs) modeTabs.classList.remove('hidden');
    if (parentGroup) parentGroup.classList.remove('hidden');
    if (nameGroup) nameGroup.classList.remove('hidden');
    if (tplGroup) tplGroup.classList.add('hidden');
    if (delBox) delBox.classList.add('hidden');
    if (nameLabel) nameLabel.innerHTML = '新建文件夹名称（支持多级路径如 <code class="text-sky-400">Drivers/Sensor</code>）：';
    if (nameInput) {
      nameInput.value = '';
      nameInput.placeholder = '例如: Middlewares 或 Drivers/Sensor';
      setTimeout(() => nameInput.focus(), 60);
    }
    if (submitBtn) submitBtn.className = 'px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs shadow transition flex items-center gap-1.5';
    if (submitText) submitText.textContent = '立即创建文件夹';
  } else if (mode === 'newfile') {
    if (iconEl) iconEl.className = 'fa-solid fa-file-circle-plus text-emerald-400';
    if (titleEl) titleEl.textContent = '📄 新建工程文件 (New File)';
    if (subEl) subEl.textContent = '支持创建 .c / .h / .md / .json / .txt 等文件并自动生成模板';
    if (modeTabs) modeTabs.classList.remove('hidden');
    if (parentGroup) parentGroup.classList.remove('hidden');
    if (nameGroup) nameGroup.classList.remove('hidden');
    if (tplGroup) tplGroup.classList.remove('hidden');
    if (delBox) delBox.classList.add('hidden');
    if (nameLabel) nameLabel.innerHTML = '新建文件名称（含后缀，如 <code class="text-emerald-400">sensor_drv.c</code>）：';
    if (nameInput) {
      nameInput.value = '';
      nameInput.placeholder = '例如: sensor_drv.c / sensor_drv.h / notes.md';
      setTimeout(() => nameInput.focus(), 60);
    }
    if (submitBtn) submitBtn.className = 'px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow transition flex items-center gap-1.5';
    if (submitText) submitText.textContent = '立即创建文件';
  } else if (mode === 'rename') {
    if (iconEl) iconEl.className = 'fa-solid fa-pen-to-square text-amber-400';
    if (titleEl) titleEl.textContent = `✏️ 重命名或移动${efsCurrentState.itemType === 'dir' ? '文件夹' : '文件'}`;
    if (subEl) subEl.textContent = `原路径: /${efsCurrentState.baseRelPath}`;
    if (modeTabs) modeTabs.classList.add('hidden');
    if (parentGroup) parentGroup.classList.add('hidden');
    if (nameGroup) nameGroup.classList.remove('hidden');
    if (tplGroup) tplGroup.classList.add('hidden');
    if (delBox) delBox.classList.add('hidden');
    if (nameLabel) nameLabel.innerHTML = '输入新的相对路径或名称（可直接修改目录前缀以移动位置）：';
    if (nameInput) {
      nameInput.value = efsCurrentState.baseRelPath;
      setTimeout(() => {
        nameInput.focus();
        const lastSlash = nameInput.value.lastIndexOf('/');
        nameInput.setSelectionRange(lastSlash + 1, nameInput.value.length);
      }, 60);
    }
    if (submitBtn) submitBtn.className = 'px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow transition flex items-center gap-1.5';
    if (submitText) submitText.textContent = '保存修改';
  } else if (mode === 'delete') {
    if (iconEl) iconEl.className = 'fa-regular fa-trash-can text-rose-400';
    if (titleEl) titleEl.textContent = `🗑️ 删除${efsCurrentState.itemType === 'dir' ? '文件夹' : '文件'}确认`;
    if (subEl) subEl.textContent = `目标路径: /${efsCurrentState.baseRelPath}`;
    if (modeTabs) modeTabs.classList.add('hidden');
    if (parentGroup) parentGroup.classList.add('hidden');
    if (nameGroup) nameGroup.classList.add('hidden');
    if (tplGroup) tplGroup.classList.add('hidden');
    if (delBox) delBox.classList.remove('hidden');
    if (delDesc) {
      delDesc.textContent = `${efsCurrentState.itemType === 'dir' ? '📁 文件夹（含内部全部子文件）' : '📄 文件'}: /${efsCurrentState.baseRelPath}`;
    }
    if (submitBtn) submitBtn.className = 'px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs shadow transition flex items-center gap-1.5';
    if (submitText) submitText.textContent = '确认永久删除';
  }
  window.updateEfsPathPreview();
};
window.applyEfsFileQuickName = function (parentRel, fileName) {
  const parentSel = document.getElementById('efs-parent-dir-select');
  const nameInput = document.getElementById('efs-name-input');
  if (parentSel) parentSel.value = parentRel;
  if (nameInput) {
    nameInput.value = fileName;
    nameInput.focus();
  }
  window.updateEfsPathPreview();
};
window.updateEfsPathPreview = function () {
  const previewEl = document.getElementById('efs-path-preview-text');
  if (!previewEl) return;
  const parentSel = document.getElementById('efs-parent-dir-select');
  const nameInput = document.getElementById('efs-name-input');
  const mode = efsCurrentState.mode;
  if (mode === 'delete') {
    previewEl.textContent = `/${efsCurrentState.baseRelPath}`;
    return;
  }
  if (mode === 'rename') {
    const val = (nameInput ? nameInput.value : '').trim().replace(/^\/+/, '');
    previewEl.textContent = val ? `/${val}` : '/';
    return;
  }
  const parentVal = (parentSel ? parentSel.value : '').trim().replace(/^\/+|\/+$/g, '');
  const nameVal = (nameInput ? nameInput.value : '').trim().replace(/^\/+|\/+$/g, '');
  const combined = [parentVal, nameVal].filter(Boolean).join('/');
  previewEl.textContent = combined ? `/${combined}` : '/';
};
window.closeExplorerFsModal = function () {
  const modal = document.getElementById('explorer-fs-modal');
  if (modal) modal.classList.add('hidden');
};
window.submitExplorerFsModal = async function () {
  const mode = efsCurrentState.mode;
  const projectDir = (typeof activeProjectDetail !== 'undefined' && activeProjectDetail?.project_dir) ||
                     (typeof activeProjectDir !== 'undefined' ? activeProjectDir : '');
  const parentSel = document.getElementById('efs-parent-dir-select');
  const nameInput = document.getElementById('efs-name-input');
  const openAfter = document.getElementById('efs-open-after-create');
  const submitBtn = document.getElementById('btn-efs-submit');
  if (submitBtn) submitBtn.disabled = true;
  try {
    if (mode === 'mkdir' || mode === 'newfile') {
      const parentVal = (parentSel ? parentSel.value : '').trim().replace(/^\/+|\/+$/g, '');
      const nameVal = (nameInput ? nameInput.value : '').trim().replace(/^\/+|\/+$/g, '');
      if (!nameVal) {
        if (typeof showToast === 'function') showToast(mode === 'mkdir' ? '请输入要新建的文件夹名称' : '请输入要新建的文件名称', 'warn');
        if (nameInput) nameInput.focus();
        return;
      }
      const targetRel = [parentVal, nameVal].filter(Boolean).join('/');
      const res = await fetch('/api/projects/fs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_dir: projectDir,
          item_type: mode === 'mkdir' ? 'dir' : 'file',
          rel_path: targetRel
        })
      });
      const out = await res.json();
      if (!out.success) {
        if (typeof showToast === 'function') showToast(out.error || '创建失败', 'error');
        return;
      }
      if (parentVal) explorerCollapsedDirs.delete(parentVal);
      if (out.rel_path) explorerCollapsedDirs.delete(out.rel_path);
      if (out.detail) {
        activeProjectDetail = out.detail;
        if (typeof renderReviewPane === 'function') renderReviewPane();
        window.renderWorkbenchExplorerTree(out.detail);
      }
      window.closeExplorerFsModal();
      if (typeof window.focusFullExplorerTree === 'function') {
        window.focusFullExplorerTree();
      }
      if (typeof showToast === 'function') {
        showToast(mode === 'mkdir' ? `📁 已成功新建文件夹: /${out.rel_path}` : `📄 已成功新建文件: /${out.rel_path}`, 'success');
      }
      if (mode === 'newfile' && openAfter && openAfter.checked && out.abs_path) {
        await window.openExplorerFileItem(out.kind || 'text', out.abs_path, out.name);
      }
    } else if (mode === 'rename') {
      const newRel = (nameInput ? nameInput.value : '').trim().replace(/^\/+|\/+$/g, '');
      if (!newRel) {
        if (typeof showToast === 'function') showToast('请输入新的名称或相对路径', 'warn');
        return;
      }
      const res = await fetch('/api/projects/fs/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_dir: projectDir,
          old_rel_path: efsCurrentState.baseRelPath,
          new_rel_path: newRel
        })
      });
      const out = await res.json();
      if (!out.success) {
        if (typeof showToast === 'function') showToast(out.error || '重命名失败', 'error');
        return;
      }
      if (out.detail) {
        activeProjectDetail = out.detail;
        if (typeof renderReviewPane === 'function') renderReviewPane();
        window.renderWorkbenchExplorerTree(out.detail);
      }
      window.closeExplorerFsModal();
      if (typeof showToast === 'function') {
        showToast(`✏️ 已更新路径为: /${out.new_rel_path}`, 'success');
      }
    } else if (mode === 'delete') {
      const res = await fetch('/api/projects/fs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_dir: projectDir,
          rel_path: efsCurrentState.baseRelPath
        })
      });
      const out = await res.json();
      if (!out.success) {
        if (typeof showToast === 'function') showToast(out.error || '删除失败', 'error');
        return;
      }
      if (out.detail) {
        activeProjectDetail = out.detail;
        if (typeof renderReviewPane === 'function') renderReviewPane();
        window.renderWorkbenchExplorerTree(out.detail);
      }
      window.closeExplorerFsModal();
      if (typeof showToast === 'function') {
        showToast(`🗑️ 已删除: /${out.deleted_rel_path}`, 'info');
      }
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('操作异常: ' + (err.message || err), 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};
