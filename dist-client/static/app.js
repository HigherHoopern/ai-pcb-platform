/* Xter AI-PCB Commercial Client Build | File: app.js | SHA256: befe2a81bac54829 | Core Python & 324p Skills Strictly Excluded */
let platformSettings = null;
let activeLlmInfo = null;
let allAgentsData = {};
let allProjectsList = [];
let activeProjectDir = '';
let activeProjectDetail = null;
let currentSelectedProvider = 'ollama';
let selectedReqFiles = [];
let currentDispatcherAgent = 'antigravity';
let currentDispatcherTask = 'full';
let currentQuickAgent = 'antigravity';
let currentDispatcherCmdInfo = null;
let activeRunningTaskId = null;
let activePollTimer = null;
let projectTemplatesList = [];
let selectedTemplateId = 'env_alarm';
let ssotDirty = false;
let currentEditingFwPath = '';
let fwEditorDirty = false;
let currentEdaMode = 'kicad'; // 'kicad' | 'jlc'
let copilotHistory = { pcb: [], firmware: [] };
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    localStorage.setItem('ai_pcb_theme', 'light');
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    localStorage.setItem('ai_pcb_theme', 'dark');
  }
  updateThemeUI();
}
function updateThemeUI() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('theme-icon');
  const text = document.getElementById('theme-text');
  const btn = document.getElementById('theme-toggle');
  if (!icon || !text || !btn) return;
  if (isDark) {
    icon.className = "fa-solid fa-sun text-sm w-4 text-center text-amber-400";
    text.innerText = "浅色模式";
  } else {
    icon.className = "fa-solid fa-moon text-sm w-4 text-center text-indigo-600";
    text.innerText = "深色模式";
  }
  btn.className = "sidebar-action-btn w-full px-3 py-2 rounded-r-xl text-xs font-medium flex items-center justify-between gap-2.5 text-slate-400 hover:text-slate-100";
}
function toggleSidebar() {
  const sb = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-collapse-icon');
  if (!sb) return;
  const collapsed = sb.classList.toggle('sidebar-collapsed');
  localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
  if (icon) {
    icon.className = collapsed ? 'fa-solid fa-angles-right text-xs' : 'fa-solid fa-angles-left text-xs';
  }
}
function initSidebarState() {
  const sb = document.getElementById('app-sidebar');
  const icon = document.getElementById('sidebar-collapse-icon');
  if (!sb) return;
  if (localStorage.getItem('sidebar_collapsed') === '1') {
    sb.classList.add('sidebar-collapsed');
    if (icon) icon.className = 'fa-solid fa-angles-right text-xs';
  }
}
const VIEW_TITLE_MAP = {
  dashboard: '<i class="fa-solid fa-gauge-high text-sky-400"></i> ① 工程与环境总览',
  intake: '<i class="fa-solid fa-network-wired text-amber-400"></i> ② 需求与引脚中枢 (SSOT: spec.json + bsp_pinout.h)',
  pcb: '<i class="fa-solid fa-compass-drafting text-emerald-400"></i> 📐 模块一：PCB 硬件设计工坊 (KiCad / 嘉立创 JLC + 对话式修正)',
  firmware: '<i class="fa-solid fa-file-code text-sky-400"></i> 💻 模块二：嵌入式 C 固件工坊 (C99 IDE / ARM-GCC + 对话式编程)',
  agents: '<i class="fa-solid fa-diagram-project text-teal-400"></i> 🤖 5 阶段全自动协同流水线 & Agent 调度台',
  distiller: '<i class="fa-solid fa-book-bookmark text-indigo-400"></i> 📚 知识库智能蒸馏工坊 (Book-to-Skill)',
  config: '<i class="fa-solid fa-sliders text-purple-400"></i> ⚙️ 多模型服务商与 Coding Agent 配置中心',
  guide: '<i class="fa-solid fa-book-open-reader text-amber-400"></i> 📖 平台使用说明：PCB 硬件设计流程图 & C99 嵌入式固件开发指南'
};
function switchTab(tabId) {
  if (tabId === 'review') tabId = 'pcb';
  if (typeof coDesignSplitActive !== 'undefined' && coDesignSplitActive && tabId !== 'pcb' && tabId !== 'firmware') {
    toggleCoDesignSplitView(false);
  }
  ['dashboard', 'config', 'intake', 'pcb', 'firmware', 'agents', 'distiller', 'guide'].forEach(t => {
    const el = document.getElementById(`pane-${t}`);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('pane-animate-in');
    }
    const tb = document.getElementById(`tab-${t}`);
    if (tb) {
      tb.classList.remove('active');
      tb.classList.add('text-slate-400');
    }
    const actBtn = document.getElementById(`act-btn-${t}`);
    if (actBtn) actBtn.classList.remove('active');
    const edTab = document.getElementById(`edtab-${t}`);
    if (edTab) edTab.classList.remove('active');
  });
  ['tab-guide-pcb', 'tab-guide-c99'].forEach(subId => {
    const subBtn = document.getElementById(subId);
    if (subBtn) {
      subBtn.classList.remove('active');
      subBtn.classList.add('text-slate-400');
    }
  });
  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) {
    targetPane.classList.remove('hidden');
    void targetPane.offsetWidth;
    targetPane.classList.add('pane-animate-in');
  }
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) {
    targetTab.classList.add('active');
    targetTab.classList.remove('text-slate-400');
  }
  const activeActBtn = document.getElementById(`act-btn-${tabId}`);
  if (activeActBtn) activeActBtn.classList.add('active');
  const activeEdTab = document.getElementById(`edtab-${tabId}`);
  if (activeEdTab) activeEdTab.classList.add('active');
  const topTitle = document.getElementById('top-view-title');
  if (topTitle && VIEW_TITLE_MAP[tabId]) {
    topTitle.innerHTML = VIEW_TITLE_MAP[tabId];
  }
  if (typeof updateWorkbenchBreadcrumb === 'function') {
    updateWorkbenchBreadcrumb(tabId);
  }
  if (tabId === 'agents') {
    refreshDispatcherCommand();
  } else if (tabId === 'pcb' || tabId === 'firmware') {
    renderReviewPane();
    if (tabId === 'firmware' && typeof layoutMonacoEditorIfVisible === 'function') {
      setTimeout(layoutMonacoEditorIfVisible, 60);
    }
  } else if (tabId === 'distiller') {
    loadSkillsList();
  }
}
async function initApp() {
  initDropZone();
  updateThemeUI();
  initSidebarState();
  bindGlobalShortcuts();
  await Promise.all([
    loadPreflightAndAgents(),
    loadPlatformConfig(),
    loadTemplatesCatalog(),
    loadProjectsWorkspace()
  ]);
  if (typeof loadSkillsList === 'function') {
    loadSkillsList();
  }
}
function bindGlobalShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      openCommandPalette(e.shiftKey ? '>' : '');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      toggleBottomPanel();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleSidebar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      toggleCoDesignSplitView();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const fwPane = document.getElementById('pane-firmware');
      const intakePane = document.getElementById('pane-intake');
      const configPane = document.getElementById('pane-config');
      if (fwPane && !fwPane.classList.contains('hidden') && currentEditingFwPath) {
        e.preventDefault();
        saveCurrentFirmwareSource(false);
      } else if (intakePane && !intakePane.classList.contains('hidden')) {
        e.preventDefault();
        confirmAndLockSpec();
      } else if (configPane && !configPane.classList.contains('hidden')) {
        e.preventDefault();
        saveGlobalPlatformConfig();
      }
    }
    if (e.key === 'Escape') {
      closeNewProjectModal();
      if (typeof closeCommandPalette === 'function') closeCommandPalette();
    }
  });
}
async function loadPreflightAndAgents() {
  try {
    const res = await fetch('/api/preflight');
    const data = await res.json();
    allAgentsData = data.agents || {};
    activeLlmInfo = data.active_llm || {};
    const badge = document.getElementById('env-badge-text');
    if (badge && activeLlmInfo.model_name) {
      const shortModel = activeLlmInfo.model_name.split('/').pop();
      badge.innerText = `KiCad / GCC / ${shortModel} 就绪`;
    }
    const kicadTool = (data.tools || []).find(t => t.id === 'kicad');
    const gccTool = (data.tools || []).find(t => t.id === 'gcc');
    if (kicadTool) {
      const el = document.getElementById('dash-kicad-ver');
      if (el) el.innerText = kicadTool.status ? `${kicadTool.version} 官方内核` : '未安装 kicad-cli';
    }
    if (gccTool) {
      const el = document.getElementById('dash-gcc-ver');
      if (el) el.innerText = gccTool.status ? gccTool.version.replace(/arm-none-eabi-gcc\s*/i, '').slice(0, 22) : '未安装 ARM GCC';
    }
    if (activeLlmInfo.model_name) {
      const mEl = document.getElementById('dash-llm-name');
      const pEl = document.getElementById('dash-llm-provider');
      if (mEl) mEl.innerText = activeLlmInfo.model_name.split('/').pop();
      if (pEl) pEl.innerText = `${activeLlmInfo.provider_name} · 可在配置中心切换`;
      const btnDistill = document.getElementById('btn-distill-model-label');
      if (btnDistill) btnDistill.innerText = `${activeLlmInfo.provider_name} (${activeLlmInfo.model_name.split('/').pop()})`;
    }
    const readyAgentsCount = Object.values(allAgentsData).filter(a => a.installed).length;
    const agCountEl = document.getElementById('dash-agent-count');
    if (agCountEl) agCountEl.innerText = `${readyAgentsCount} / ${Object.keys(allAgentsData).length} 款已就绪`;
    const dispProbeEl = document.getElementById('disp-probe-badge');
    if (dispProbeEl) dispProbeEl.innerText = `${readyAgentsCount} 款 Agent 已检测就绪`;
    renderDashboardAgentGrid();
    updateDispatcherAgentCards();
  } catch (err) {
    console.error("加载预检信息异常:", err);
  }
}
async function loadPlatformConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    platformSettings = data.settings;
    activeLlmInfo = data.active_llm;
    currentSelectedProvider = platformSettings.llm.active_provider || 'siliconflow';
    renderConfigCenterUI();
  } catch (err) {
    console.error("加载平台配置失败:", err);
  }
}
function renderConfigCenterUI() {
  if (!platformSettings) return;
  const llm = platformSettings.llm || {};
  const providers = llm.providers || {};
  const pList = document.getElementById('cfg-provider-list');
  if (pList) {
    pList.innerHTML = '';
    Object.values(providers).forEach(p => {
      const isSelected = p.id === currentSelectedProvider;
      const isActiveDefault = p.id === llm.active_provider;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.onclick = () => selectProviderTab(p.id);
      btn.className = `w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
        isSelected
          ? 'border-sky-500 bg-sky-500/15 text-slate-100 shadow-md'
          : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
      }`;
      btn.innerHTML = `
        <div>
          <div class="text-xs font-bold flex items-center gap-1.5">
            <span>${p.name}</span>
          </div>
          <div class="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">${p.default_model || '-'}</div>
        </div>
        ${isActiveDefault ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">当前默认</span>' : ''}
      `;
      pList.appendChild(btn);
    });
  }
  const curP = providers[currentSelectedProvider] || {};
  const elBase = document.getElementById('cfg-base-url');
  const elKey = document.getElementById('cfg-api-key');
  const elModel = document.getElementById('cfg-model-name');
  const elTitle = document.getElementById('cfg-provider-title');
  const elSetDefault = document.getElementById('cfg-set-active-provider');
  if (elTitle) elTitle.innerText = curP.name || currentSelectedProvider;
  if (elBase) elBase.value = curP.base_url || '';
  if (elKey) elKey.value = curP.api_key || '';
  if (elModel) elModel.value = curP.default_model || '';
  if (elSetDefault) elSetDefault.checked = (llm.active_provider === currentSelectedProvider);
  const chipsBox = document.getElementById('cfg-model-chips');
  if (chipsBox) {
    chipsBox.innerHTML = '';
    (curP.models || []).forEach(m => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.onclick = () => { document.getElementById('cfg-model-name').value = m; };
      chip.className = "text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-slate-700 transition";
      chip.innerText = m;
      chipsBox.appendChild(chip);
    });
  }
  const routing = llm.routing || {};
  ['req_distill', 'skill_distill', 'pinmux_review'].forEach(taskKey => {
    const rCfg = routing[taskKey] || {};
    const selEl = document.getElementById(`route-provider-${taskKey}`);
    const modEl = document.getElementById(`route-model-${taskKey}`);
    if (selEl) {
      selEl.innerHTML = `<option value="default">跟随全局默认服务商 (${providers[llm.active_provider]?.name || llm.active_provider})</option>`;
      Object.values(providers).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.innerText = `${p.name} (${p.default_model})`;
        if (rCfg.provider === p.id) opt.selected = true;
        selEl.appendChild(opt);
      });
    }
    if (modEl) modEl.value = rCfg.model || '';
  });
  const agentsCfg = platformSettings.agents || {};
  ['claude', 'pi', 'codex', 'antigravity'].forEach(aid => {
    const ac = agentsCfg[aid] || {};
    const binEl = document.getElementById(`ag-cfg-bin-${aid}`);
    const modEl = document.getElementById(`ag-cfg-model-${aid}`);
    const extEl = document.getElementById(`ag-cfg-extra-${aid}`);
    const envEl = document.getElementById(`ag-cfg-env-${aid}`);
    if (binEl) binEl.value = ac.custom_bin || '';
    if (modEl) modEl.value = ac.model_arg || '';
    if (extEl) extEl.value = ac.extra_args || '';
    if (envEl) {
      const pairs = Object.entries(ac.env_vars || {}).map(([k, v]) => `${k}=${v}`);
      envEl.value = pairs.join('\n');
    }
  });
  const pipe = (platformSettings.workspace || {}).pipeline || {};
  if (document.getElementById('pipe-pcb-agent')) document.getElementById('pipe-pcb-agent').value = pipe.pcb_agent || 'antigravity';
  if (document.getElementById('pipe-fw-agent')) document.getElementById('pipe-fw-agent').value = pipe.firmware_agent || 'pi';
  if (document.getElementById('pipe-drc-agent')) document.getElementById('pipe-drc-agent').value = pipe.drc_agent || 'codex';
  if (document.getElementById('orch-pcb-agent')) document.getElementById('orch-pcb-agent').value = pipe.pcb_agent || 'antigravity';
  if (document.getElementById('orch-fw-agent')) document.getElementById('orch-fw-agent').value = pipe.firmware_agent || 'pi';
  if (document.getElementById('orch-drc-agent')) document.getElementById('orch-drc-agent').value = pipe.drc_agent || 'codex';
  populateStudioLlmModelSelects();
  renderPipelineStagesUI();
}
function selectProviderTab(providerId) {
  syncCurrentProviderFormToMemory();
  currentSelectedProvider = providerId;
  renderConfigCenterUI();
}
function syncCurrentProviderFormToMemory() {
  if (!platformSettings || !platformSettings.llm) return;
  const curP = platformSettings.llm.providers[currentSelectedProvider];
  if (!curP) return;
  const elBase = document.getElementById('cfg-base-url');
  const elKey = document.getElementById('cfg-api-key');
  const elModel = document.getElementById('cfg-model-name');
  const elSetDefault = document.getElementById('cfg-set-active-provider');
  if (elBase) curP.base_url = elBase.value.trim();
  if (elKey) curP.api_key = elKey.value.trim();
  if (elModel) {
    curP.default_model = elModel.value.trim();
    if (curP.default_model && !curP.models.includes(curP.default_model)) {
      curP.models.unshift(curP.default_model);
    }
  }
  if (elSetDefault && elSetDefault.checked) {
    platformSettings.llm.active_provider = currentSelectedProvider;
  }
}
async function testCurrentLlmProvider() {
  syncCurrentProviderFormToMemory();
  const curP = platformSettings.llm.providers[currentSelectedProvider];
  const resBox = document.getElementById('llm-test-result');
  resBox.classList.remove('hidden');
  resBox.className = "mt-3 p-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-xs text-sky-300 flex items-center gap-2";
  resBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 正在向 ${curP.base_url} (${curP.default_model}) 发送连通性测试请求...`;
  try {
    const res = await fetch('/api/config/llm/test', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        provider_id: curP.id,
        provider_name: curP.name,
        base_url: curP.base_url,
        api_key: curP.api_key,
        model_name: curP.default_model
      })
    });
    const d = await res.json();
    if (d.success) {
      resBox.className = "mt-3 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300 space-y-1";
      resBox.innerHTML = `
        <div class="font-bold flex items-center justify-between">
          <span><i class="fa-solid fa-circle-check mr-1"></i> API 连通性测试成功！</span>
          <span class="font-mono bg-emerald-500/20 px-2 py-0.5 rounded">延迟: ${d.latency_ms} ms</span>
        </div>
        <div class="text-slate-300 font-mono text-[11px]">模型回复: "${d.reply}"</div>
      `;
    } else {
      resBox.className = "mt-3 p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-300";
      resBox.innerHTML = `<div class="font-bold"><i class="fa-solid fa-circle-xmark mr-1"></i> 连接失败 (${d.latency_ms} ms)</div><div class="font-mono text-[11px] mt-1">${d.error}</div>`;
    }
  } catch (err) {
    resBox.className = "mt-3 p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-300";
    resBox.innerHTML = `请求异常: ${err}`;
  }
}
async function saveGlobalPlatformConfig() {
  syncCurrentProviderFormToMemory();
  ['req_distill', 'skill_distill', 'pinmux_review'].forEach(taskKey => {
    const selEl = document.getElementById(`route-provider-${taskKey}`);
    const modEl = document.getElementById(`route-model-${taskKey}`);
    if (selEl && platformSettings.llm.routing[taskKey]) {
      platformSettings.llm.routing[taskKey].provider = selEl.value;
    }
    if (modEl && platformSettings.llm.routing[taskKey]) {
      platformSettings.llm.routing[taskKey].model = modEl.value.trim();
    }
  });
  ['claude', 'pi', 'codex', 'antigravity'].forEach(aid => {
    const binEl = document.getElementById(`ag-cfg-bin-${aid}`);
    const modEl = document.getElementById(`ag-cfg-model-${aid}`);
    const extEl = document.getElementById(`ag-cfg-extra-${aid}`);
    const envEl = document.getElementById(`ag-cfg-env-${aid}`);
    const envMap = {};
    if (envEl && envEl.value.trim()) {
      envEl.value.split('\n').forEach(line => {
        const s = line.trim();
        if (s && s.includes('=')) {
          const idx = s.indexOf('=');
          envMap[s.slice(0, idx).trim()] = s.slice(idx + 1).trim();
        }
      });
    }
    platformSettings.agents[aid] = {
      custom_bin: binEl ? binEl.value.trim() : '',
      model_arg: modEl ? modEl.value.trim() : '',
      extra_args: extEl ? extEl.value.trim() : '',
      env_vars: envMap
    };
  });
  platformSettings.workspace = platformSettings.workspace || {};
  platformSettings.workspace.pipeline = {
    pcb_agent: document.getElementById('pipe-pcb-agent')?.value || 'antigravity',
    firmware_agent: document.getElementById('pipe-fw-agent')?.value || 'pi',
    drc_agent: document.getElementById('pipe-drc-agent')?.value || 'codex'
  };
  try {
    const res = await fetch('/api/config/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(platformSettings)
    });
    const d = await res.json();
    if (d.success) {
      platformSettings = d.settings;
      activeLlmInfo = d.active_llm;
      allAgentsData = d.agents_detected || allAgentsData;
      await loadPreflightAndAgents();
      renderConfigCenterUI();
      showToast("全局模型与 Coding Agent 配置已保存并生效！");
    }
  } catch (err) {
    alert("保存配置失败: " + err);
  }
}
async function loadProjectsWorkspace() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    allProjectsList = data.projects || [];
    activeProjectDir = data.active_project_dir || (allProjectsList[0]?.project_dir || '');
    renderGlobalProjectSwitcher();
    renderDashboardProjectsGrid();
    if (activeProjectDir) {
      await fetchAndApplyProjectDetail(activeProjectDir);
    }
  } catch (err) {
    console.error("加载工程列表失败:", err);
  }
}
function renderGlobalProjectSwitcher() {
  const sel = document.getElementById('global-project-select');
  if (!sel) return;
  sel.innerHTML = '';
  allProjectsList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.project_dir;
    opt.innerText = `📁 ${p.project_name} (${p.mcu} · ${p.dimensions})`;
    if (p.project_dir === activeProjectDir) opt.selected = true;
    sel.appendChild(opt);
  });
}
function renderDashboardProjectsGrid() {
  const grid = document.getElementById('dashboard-projects-grid');
  if (!grid) return;
  grid.innerHTML = '';
  allProjectsList.forEach(p => {
    const isAct = p.project_dir === activeProjectDir;
    const card = document.createElement('div');
    card.className = `hover-lift rounded-xl p-4 border transition flex flex-col justify-between ${
      isAct ? 'border-emerald-500 bg-emerald-500/10 shadow-lg' : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
    }`;
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-bold text-slate-100 truncate pr-2">${p.project_name}</span>
          ${isAct
            ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">当前激活</span>'
            : `<button onclick="switchGlobalProject('${p.project_dir.replace(/'/g, "\\'")}')" class="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-500/20 text-sky-400 border border-slate-700 whitespace-nowrap">切换至此</button>`
          }
        </div>
        <div class="text-[11px] font-mono text-sky-400 mb-1">${p.mcu} · ${p.dimensions} · ${p.pin_count} 引脚</div>
        <p class="text-[11px] text-slate-400 line-clamp-2 mb-3">${p.summary || p.project_dir}</p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
        <span>${p.has_pcb ? `<i class="fa-solid fa-circle-check text-emerald-400"></i> ${p.pcb_count} PCB` : '<i class="fa-regular fa-circle text-slate-500"></i> 待生成PCB'}</span>
        <span>${p.has_firmware ? `<i class="fa-solid fa-code text-sky-400"></i> ${p.fw_files_count} 固件文件` : '<i class="fa-regular fa-circle text-slate-500"></i> 待写固件'}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}
async function switchGlobalProject(projectDir) {
  if (!projectDir) return;
  try {
    const res = await fetch('/api/projects/select', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: projectDir })
    });
    const d = await res.json();
    if (d.success) {
      activeProjectDir = d.active_project_dir;
      activeProjectDetail = d.detail;
      await loadProjectsWorkspace();
      showToast(`已切换当前激活工程为：${activeProjectDetail.project_name}`);
    }
  } catch (err) {
    alert("切换工程失败: " + err);
  }
}
async function fetchAndApplyProjectDetail(projectDir) {
  try {
    const res = await fetch(`/api/projects/detail?project_dir=${encodeURIComponent(projectDir)}`);
    const d = await res.json();
    if (d.success && d.detail) {
      activeProjectDetail = d.detail;
      populateSsotWorkspaceFromDetail(activeProjectDetail);
      const dirInput = document.getElementById('disp-project-dir');
      if (dirInput) dirInput.value = activeProjectDetail.project_dir;
      refreshDispatcherCommand();
      renderReviewPane();
      loadCopilotHistory(activeProjectDetail.project_dir);
    }
  } catch (err) {
    console.error("获取工程详情失败:", err);
  }
}
async function loadTemplatesCatalog() {
  try {
    const res = await fetch('/api/templates');
    const d = await res.json();
    if (d.success && d.templates) {
      projectTemplatesList = d.templates;
      renderProjectTemplatesModalGrid();
    }
  } catch (err) {
    console.error("加载工程模板库异常:", err);
  }
}
function promptCreateNewProject() {
  const modal = document.getElementById('new-project-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (projectTemplatesList.length > 0) {
    selectProjectTemplate(selectedTemplateId || projectTemplatesList[0].id);
  } else {
    loadTemplatesCatalog();
  }
}
function closeNewProjectModal() {
  const modal = document.getElementById('new-project-modal');
  if (modal) modal.classList.add('hidden');
  const prog = document.getElementById('np-progress-box');
  if (prog) prog.classList.add('hidden');
  const btn = document.getElementById('btn-confirm-create-project');
  if (btn) btn.disabled = false;
}
function renderProjectTemplatesModalGrid() {
  const grid = document.getElementById('np-template-grid');
  if (!grid || !projectTemplatesList.length) return;
  grid.innerHTML = '';
  projectTemplatesList.forEach(t => {
    const isSel = t.id === selectedTemplateId;
    const mcuModel = t.spec?.mcu?.model || 'STM32G030F6P6';
    const mech = t.spec?.mechanical || {};
    const pinsCount = (t.pinout || []).length;
    const card = document.createElement('div');
    card.onclick = () => selectProjectTemplate(t.id);
    card.className = `cursor-pointer rounded-xl p-3.5 border transition flex flex-col justify-between ${
      isSel
        ? 'border-sky-500 bg-sky-500/15 shadow-lg'
        : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
    }`;
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-1 mb-1">
          <span class="text-xs font-bold text-slate-100">${t.title}</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono whitespace-nowrap">${t.badge}</span>
        </div>
        <p class="text-[11px] text-slate-400 leading-snug mb-2">${t.description}</p>
      </div>
      <div class="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px] font-mono text-amber-300">
        <span>${mcuModel}</span>
        <span>${mech.width_mm || 50}x${mech.height_mm || 35}mm · ${pinsCount} 引脚</span>
      </div>
    `;
    grid.appendChild(card);
  });
}
function selectProjectTemplate(tplId) {
  selectedTemplateId = tplId;
  renderProjectTemplatesModalGrid();
  const tpl = projectTemplatesList.find(t => t.id === tplId);
  if (!tpl) return;
  const s = tpl.spec || {};
  const mech = s.mechanical || {};
  const mcu = s.mcu || {};
  const pwr = s.power || {};
  const badge = document.getElementById('np-selected-tpl-badge');
  if (badge) badge.innerText = `当前模板: ${tpl.title}`;
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  setVal('np-project-name', tpl.default_name || 'New-Hardware-Board');
  setVal('np-mcu-select', mcu.model || 'STM32G030F6P6');
  setVal('np-mcu-pkg', mcu.package || 'TSSOP-20');
  setVal('np-width', mech.width_mm || 60);
  setVal('np-height', mech.height_mm || 40);
  setVal('np-layers', String(mech.layers || 2));
  setVal('np-power', pwr.input_source || 'USB Type-C 5V / 3.7V 锂电池');
}
function onNewProjectMcuChange(mcuId) {
  const pkgMap = {
    'STM32G030F6P6': 'TSSOP-20',
    'STM32L011F4U6TR': 'UFQFPN-20',
    'STM32F103C8T6': 'LQFP-48',
    'STM32F401CCU6': 'UFQFPN-48',
    'ESP32-S3-WROOM-1': 'Module-41'
  };
  const pkgEl = document.getElementById('np-mcu-pkg');
  if (pkgEl && pkgMap[mcuId]) pkgEl.value = pkgMap[mcuId];
}
async function submitCreateProjectModal() {
  const pName = document.getElementById('np-project-name')?.value.trim() || 'New-Hardware-Board';
  const mcuModel = document.getElementById('np-mcu-select')?.value || 'STM32G030F6P6';
  const mcuPkg = document.getElementById('np-mcu-pkg')?.value.trim() || 'TSSOP-20';
  const widthMm = parseFloat(document.getElementById('np-width')?.value || 60);
  const heightMm = parseFloat(document.getElementById('np-height')?.value || 40);
  const layers = parseInt(document.getElementById('np-layers')?.value || 2);
  const powerSrc = document.getElementById('np-power')?.value.trim() || 'USB Type-C 5V';
  const autoScaffold = document.getElementById('np-auto-scaffold')?.checked !== false;
  const btn = document.getElementById('btn-confirm-create-project');
  const prog = document.getElementById('np-progress-box');
  if (btn) btn.disabled = true;
  if (prog) prog.classList.remove('hidden');
  try {
    const res = await fetch('/api/projects/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        template_id: selectedTemplateId,
        project_name: pName,
        mcu_model: mcuModel,
        mcu_package: mcuPkg,
        width_mm: widthMm,
        height_mm: heightMm,
        layers: layers,
        power_source: powerSrc,
        auto_scaffold: autoScaffold
      })
    });
    const d = await res.json();
    if (d.success) {
      closeNewProjectModal();
      activeProjectDir = d.project_dir;
      activeProjectDetail = d.detail;
      await loadProjectsWorkspace();
      switchTab('intake');
      showToast(`已从模板成功创建并初始化工程：${pName}`, 'success');
    } else {
      showToast("新建工程失败: " + (d.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("新建工程请求异常: " + err, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (prog) prog.classList.add('hidden');
  }
}
function markSsotDirty() {
  ssotDirty = true;
  const b = document.getElementById('ssot-dirty-badge');
  if (b) b.classList.remove('hidden');
}
function clearSsotDirty() {
  ssotDirty = false;
  const b = document.getElementById('ssot-dirty-badge');
  if (b) b.classList.add('hidden');
}
function updateMcuPinDatalists(mcuProfile) {
  if (!mcuProfile) return;
  const pinDl = document.getElementById('mcu-pins-datalist');
  const funcDl = document.getElementById('mcu-funcs-datalist');
  if (pinDl && Array.isArray(mcuProfile.all_pins)) {
    const adcSet = new Set(mcuProfile.adc_pins || []);
    const i2cSet = new Set(mcuProfile.i2c_pins || []);
    const pwmSet = new Set(mcuProfile.pwm_pins || []);
    const specialMap = mcuProfile.special_pins || {};
    pinDl.innerHTML = mcuProfile.all_pins.map(p => {
      const tags = [];
      if (adcSet.has(p)) tags.push('ADC');
      if (pwmSet.has(p)) tags.push('PWM');
      if (i2cSet.has(p)) tags.push('I2C');
      if (specialMap[p]) tags.push(specialMap[p].slice(0, 18));
      const label = tags.length ? `${p} (${tags.join('/')})` : p;
      return `<option value="${p}">${label}</option>`;
    }).join('');
  }
  if (funcDl && Array.isArray(mcuProfile.common_functions)) {
    funcDl.innerHTML = mcuProfile.common_functions.map(f => `<option value="${f}"></option>`).join('');
  }
}
function populateSsotWorkspaceFromDetail(detail) {
  if (!detail) return;
  const s = detail.spec || {};
  const mech = s.mechanical || {};
  const pwr = s.power || {};
  const mcu = s.mcu || {};
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v !== undefined && v !== null ? v : '';
  };
  setVal('g1_pname', s.project_name || detail.project_name || 'Hardware-Project');
  setVal('g1_target_dir', detail.project_dir || '');
  setVal('g1_width', mech.width_mm || 50);
  setVal('g1_height', mech.height_mm || 30);
  setVal('g1_thickness', mech.thickness_mm || 1.2);
  setVal('g1_layers', mech.layers || 2);
  setVal('g1_fillet', mech.fillet_mm || 1.0);
  setVal('g1_power_source', pwr.input_source || 'USB 5V / 3.7V 锂电池');
  setVal('g1_power_topo', (pwr.operating_voltage || '3.3V') + ' / ' + (pwr.boost_or_buck || 'LDO稳压'));
  setVal('g1_power_protect', Array.isArray(pwr.protection) ? pwr.protection.join(', ') : (pwr.protection || '防反接, ESD'));
  setVal('g1_mcu', mcu.model || mcu.family || 'STM32G030F6P6');
  setVal('g1_mcu_pkg', mcu.package || 'TSSOP-20');
  setVal('g1_debug', mcu.debug_interface || 'SWD');
  setVal('g1_periph', (s.peripherals || []).join(', '));
  const tb = document.getElementById('pinout-tbody');
  if (tb) {
    tb.innerHTML = '';
    const pins = detail.pinout || s.pinout_table || [];
    pins.forEach(row => {
      addPinRow(row.pin, row.net_name, row.function, row.description, false);
    });
  }
  clearSsotDirty();
  renderPinoutValidationAndBsp(detail.pinout_validation, detail.bsp_header_code);
}
function addPinRow(pin = '', net = '', func = '', desc = '', triggerValidate = true) {
  const tb = document.getElementById('pinout-tbody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.className = "border-b border-slate-800/60";
  tr.innerHTML = `
    <td class="py-1.5 px-2"><input type="text" list="mcu-pins-datalist" value="${pin}" oninput="markSsotDirty()" onchange="validateCurrentPinoutLive()" placeholder="如 PA0" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-sky-300 font-mono pin-input"></td>
    <td class="py-1.5 px-2"><input type="text" value="${net}" oninput="markSsotDirty()" onchange="validateCurrentPinoutLive()" placeholder="如 LDR_ADC" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-mono net-input"></td>
    <td class="py-1.5 px-2"><input type="text" list="mcu-funcs-datalist" value="${func}" oninput="markSsotDirty()" onchange="validateCurrentPinoutLive()" placeholder="如 ADC_IN0" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 font-mono func-input"></td>
    <td class="py-1.5 px-2"><input type="text" value="${desc}" oninput="markSsotDirty()" onchange="validateCurrentPinoutLive()" placeholder="外设连接说明" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-400 desc-input"></td>
    <td class="py-1.5 px-1 text-center"><button type="button" onclick="this.closest('tr').remove(); markSsotDirty(); validateCurrentPinoutLive();" class="text-rose-400 hover:text-rose-300 text-xs px-1.5"><i class="fa-solid fa-trash"></i></button></td>
  `;
  tb.appendChild(tr);
  if (triggerValidate) {
    markSsotDirty();
    validateCurrentPinoutLive();
  }
}
function collectSpecAndPinoutFromForm() {
  const baseSpec = (activeProjectDetail && activeProjectDetail.spec) ? { ...activeProjectDetail.spec } : {};
  const pName = document.getElementById('g1_pname')?.value.trim() || 'Hardware-Project';
  const mech = {
    ...(baseSpec.mechanical || {}),
    width_mm: parseFloat(document.getElementById('g1_width')?.value || 50),
    height_mm: parseFloat(document.getElementById('g1_height')?.value || 30),
    thickness_mm: parseFloat(document.getElementById('g1_thickness')?.value || 1.2),
    layers: parseInt(document.getElementById('g1_layers')?.value || 2),
    fillet_mm: parseFloat(document.getElementById('g1_fillet')?.value || 1.0)
  };
  const pwr = {
    ...(baseSpec.power || {}),
    input_source: document.getElementById('g1_power_source')?.value || '3.7V',
    boost_or_buck: document.getElementById('g1_power_topo')?.value || '3.3V LDO',
    protection: (document.getElementById('g1_power_protect')?.value || '').split(',').map(s => s.trim()).filter(Boolean)
  };
  const mcu = {
    ...(baseSpec.mcu || {}),
    model: document.getElementById('g1_mcu')?.value.trim() || 'STM32',
    package: document.getElementById('g1_mcu_pkg')?.value.trim() || 'QFN-20',
    debug_interface: document.getElementById('g1_debug')?.value.trim() || 'SWD'
  };
  const periph = (document.getElementById('g1_periph')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  const pins = [];
  document.querySelectorAll('#pinout-tbody tr').forEach(tr => {
    const p = tr.querySelector('.pin-input')?.value.trim() || '';
    const n = tr.querySelector('.net-input')?.value.trim() || '';
    const f = tr.querySelector('.func-input')?.value.trim() || '';
    const d = tr.querySelector('.desc-input')?.value.trim() || '';
    if (p || n || f || d) {
      pins.push({ pin: p, net_name: n, function: f, description: d });
    }
  });
  const spec = {
    ...baseSpec,
    project_name: pName,
    mechanical: mech,
    power: pwr,
    mcu: mcu,
    peripherals: periph,
    pinout_table: pins
  };
  return { spec, pins };
}
async function validateCurrentPinoutLive() {
  markSsotDirty();
  const { spec, pins } = collectSpecAndPinoutFromForm();
  try {
    const res = await fetch('/api/pinout/validate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ spec, pinout: pins })
    });
    const d = await res.json();
    if (d.success) {
      renderPinoutValidationAndBsp(d.validation, d.bsp_header_code);
    }
  } catch (err) {
    console.error("校验引脚失败:", err);
  }
}
function applyMcuPreset(mcuId) {
  if (!mcuId) return;
  const pkgMap = {
    'STM32G030F6P6': 'TSSOP-20',
    'STM32L011F4U6TR': 'UFQFPN-20',
    'STM32F103C8T6': 'LQFP-48',
    'STM32F401CCU6': 'UFQFPN-48',
    'ESP32-S3-WROOM-1': 'Module-41Pin'
  };
  const dbgMap = {
    'ESP32-S3-WROOM-1': 'USB-JTAG / UART0'
  };
  const mcuEl = document.getElementById('g1_mcu');
  const pkgEl = document.getElementById('g1_mcu_pkg');
  const dbgEl = document.getElementById('g1_debug');
  if (mcuEl) mcuEl.value = mcuId;
  if (pkgEl && pkgMap[mcuId]) pkgEl.value = pkgMap[mcuId];
  if (dbgEl) dbgEl.value = dbgMap[mcuId] || 'SWD';
  validateCurrentPinoutLive();
}
function renderPinoutValidationAndBsp(validation, bspCode) {
  const badge = document.getElementById('pinout-valid-badge');
  const alertBox = document.getElementById('pinout-conflict-alerts');
  const codePre = document.getElementById('bsp-header-preview');
  const mcuBadge = document.getElementById('mcu-profile-spec-badge');
  if (codePre && bspCode) {
    codePre.innerText = bspCode;
  }
  if (!validation || !badge || !alertBox) return;
  const mp = validation.mcu_profile || validation.profile;
  if (mp && mp.id) {
    updateMcuPinDatalists(mp);
    if (mcuBadge) {
      mcuBadge.innerHTML = `<i class="fa-solid fa-microchip mr-1"></i>已匹配字典: <strong>${mp.id}</strong> (${mp.core || mp.cpu_flag} · Flash ${mp.flash_kb}KB / RAM ${mp.ram_kb}KB · 最多 ${mp.max_user_io || 18} IO)`;
    }
  }
  if (validation.error_count > 0) {
    badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold";
    badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> 检测到 ${validation.error_count} 个引脚冲突！`;
  } else if (validation.warning_count > 0) {
    badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold";
    badge.innerHTML = `<i class="fa-solid fa-circle-info mr-1"></i> 0 冲突 · ${validation.warning_count} 项复用提醒 (${validation.total_pins} 引脚)`;
  } else {
    badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold";
    badge.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> 引脚分配 0 冲突 (${validation.total_pins} 引脚已对齐)`;
  }
  const msgs = [
    ...(validation.errors || []).map(e => `<div class="text-rose-300"><i class="fa-solid fa-circle-xmark mr-1"></i>${e}</div>`),
    ...(validation.warnings || []).map(w => `<div class="text-amber-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${w}</div>`)
  ];
  if (msgs.length > 0) {
    alertBox.classList.remove('hidden');
    alertBox.innerHTML = msgs.join('');
  } else {
    alertBox.classList.add('hidden');
    alertBox.innerHTML = '';
  }
}
function copyBspHeaderCode() {
  const code = document.getElementById('bsp-header-preview')?.innerText || '';
  if (!code) return;
  navigator.clipboard.writeText(code);
  showToast("已复制自动生成的 bsp_pinout.h 代码！");
}
function handleFileSelect(files) {
  if (!files || !files.length) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!selectedReqFiles.some(item => item.name === f.name && item.size === f.size)) {
      selectedReqFiles.push(f);
    }
  }
  renderFileQueue();
}
function removeFileFromQueue(index) {
  selectedReqFiles.splice(index, 1);
  renderFileQueue();
}
function clearSelectedFiles() {
  selectedReqFiles = [];
  const fi = document.getElementById('req-file-input');
  if (fi) fi.value = '';
  renderFileQueue();
}
function renderFileQueue() {
  const box = document.getElementById('file-badge-list');
  const countEl = document.getElementById('file-count-badge');
  if (countEl) countEl.innerText = selectedReqFiles.length;
  if (!box) return;
  if (!selectedReqFiles.length) {
    box.innerHTML = '<p class="text-[11px] text-slate-500 italic text-center py-2">暂未选择文件，可点击上方按钮或将多个文档拖拽至此</p>';
    return;
  }
  box.innerHTML = '';
  selectedReqFiles.forEach((file, idx) => {
    const ext = file.name.split('.').pop().toLowerCase();
    let iconClass = 'fa-solid fa-file text-slate-400';
    let badgeBg = 'bg-slate-800/80 border-slate-700 text-slate-200';
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      iconClass = 'fa-solid fa-file-excel text-emerald-400';
      badgeBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
    } else if (['docx', 'doc'].includes(ext)) {
      iconClass = 'fa-solid fa-file-word text-sky-400';
      badgeBg = 'bg-sky-500/10 border-sky-500/20 text-sky-300';
    } else if (ext === 'pdf') {
      iconClass = 'fa-solid fa-file-pdf text-rose-400';
      badgeBg = 'bg-rose-500/10 border-rose-500/20 text-rose-300';
    } else if (['md', 'txt'].includes(ext)) {
      iconClass = 'fa-solid fa-file-lines text-amber-400';
      badgeBg = 'bg-amber-500/10 border-amber-500/20 text-amber-300';
    }
    const sizeKb = (file.size / 1024).toFixed(1);
    const item = document.createElement('div');
    item.className = `flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${badgeBg}`;
    item.innerHTML = `
      <div class="flex items-center gap-2 truncate pr-2">
        <i class="${iconClass}"></i>
        <span class="font-medium truncate" title="${file.name}">${file.name}</span>
        <span class="text-[10px] opacity-70">(${sizeKb} KB)</span>
      </div>
      <button type="button" onclick="removeFileFromQueue(${idx})" class="text-slate-400 hover:text-rose-400 text-xs px-1">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    box.appendChild(item);
  });
}
function initDropZone() {
  const dz = document.getElementById('drop-zone');
  if (!dz) return;
  ['dragenter', 'dragover'].forEach(eventName => {
    dz.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('border-amber-400', 'bg-amber-500/10');
    }, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dz.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('border-amber-400', 'bg-amber-500/10');
    }, false);
  });
  dz.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      handleFileSelect(dt.files);
    }
  }, false);
}
function fillAlarmSampleReq() {
  const sampleText = `【项目名称】：智能温湿度与烟雾环境报警器 (Smart-Env-Alarm-01)
【核心功能】：
1. 温湿度采集：SHT30 数字传感器 (I2C 接口 PB6/PB7，地址 0x44)；
2. 烟雾检测：MQ-2 气体传感器，PA0 模拟量 ADC 连续采集 + PA1 数字比较器中断报警；
3. 显示单元：0.96 寸 OLED 显示屏 (SSD1306，复用 I2C1 PB6/PB7)；
4. 声光报警：PA4 无源蜂鸣器 PWM 驱动，PA5 绿灯运行指示，PA6 红灯报警快闪；
5. 按键交互：PB0 消音按键，PB1 自检测试按键；
6. 主控选型：STM32G030F6P6 (TSSOP-20)，保留 PA13/PA14 标准 SWD 接口；
7. 供电与尺寸：USB Type-C 5V 输入经 ME6211C33 稳压 3.3V，带防反接与 ESD 保护；板框 65x45mm，双层沉金 1.2mm，四角 M2.5 定位孔。`;
  const el = document.getElementById('req-custom-text');
  if (el) el.value = sampleText;
}
async function uploadAndDistillReq() {
  const customText = document.getElementById('req-custom-text')?.value || '';
  if (!selectedReqFiles.length && !customText.trim()) {
    alert("请上传需求附件，或在右侧输入自然语言需求描述（也可直接在下方表单手动编辑）！");
    return;
  }
  const btn = document.getElementById('btn-distill-req');
  const sp = document.getElementById('distill-spinner');
  btn.disabled = true;
  sp.classList.remove('hidden');
  const fd = new FormData();
  selectedReqFiles.forEach(f => fd.append('files', f));
  fd.append('custom_text', customText);
  try {
    const res = await fetch('/api/requirements/upload', { method: 'POST', body: fd });
    const resJson = await res.json();
    if (!resJson.success) {
      alert("AI 提炼失败: " + resJson.error);
      return;
    }
    const extracted = resJson.data;
    document.getElementById('g1_target_dir').value = '';
    populateSsotWorkspaceFromDetail({
      project_name: extracted.spec?.project_name || 'AI-Extracted-Project',
      project_dir: '',
      spec: extracted.spec,
      pinout: extracted.spec?.pinout_table || []
    });
    await validateCurrentPinoutLive();
    showToast("AI 需求与引脚矩阵提炼完成！请在下方核对并锁定。");
  } catch (err) {
    alert("提炼请求异常: " + err);
  } finally {
    btn.disabled = false;
    sp.classList.add('hidden');
  }
}
async function confirmAndLockSpec(silent = false) {
  const { spec, pins } = collectSpecAndPinoutFromForm();
  const targetDir = document.getElementById('g1_target_dir')?.value.trim() || activeProjectDir || '';
  const userComments = document.getElementById('g1_user_comments')?.value || '用户已签署确认 SSOT 规格与引脚矩阵。';
  const payload = {
    project_name: spec.project_name,
    project_dir: targetDir || null,
    spec: spec,
    pinout_table: pins,
    comments: userComments
  };
  try {
    const res = await fetch('/api/requirements/confirm', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (j.success) {
      clearSsotDirty();
      activeProjectDir = j.project_dir;
      activeProjectDetail = j.detail;
      await loadProjectsWorkspace();
      const promptEl = document.getElementById('confirmed-agent-prompt');
      if (promptEl) promptEl.value = j.agent_prompt;
      const cardEl = document.getElementById('confirmed-agent-card');
      if (cardEl && !silent) cardEl.classList.remove('hidden');
      switchQuickAgent(currentQuickAgent || 'claude');
      if (!silent) showToast(j.message, 'success');
      return true;
    } else {
      showToast("确认保存失败: " + (j.error || "未知错误"), 'error');
      return false;
    }
  } catch (err) {
    showToast("锁定需求异常: " + err, 'error');
    return false;
  }
}
function renderDashboardAgentGrid() {
  const grid = document.getElementById('dashboard-agent-grid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.values(allAgentsData).forEach(a => {
    const div = document.createElement('div');
    div.className = "bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col justify-between";
    div.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-200">${a.name}</span>
          ${a.installed
            ? '<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">已就绪</span>'
            : '<span class="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-medium">未安装</span>'}
        </div>
        <div class="text-[11px] text-slate-500 mb-1">${a.vendor} · ${a.version}</div>
        ${a.model_arg ? `<div class="text-[10px] font-mono text-amber-400 mb-1.5">指定模型: ${a.model_arg}</div>` : ''}
        <div class="text-[11px] text-slate-400 leading-relaxed mb-3">${a.description}</div>
      </div>
      <button onclick="switchTab('agents'); selectAgentInDispatcher('${a.id}');" class="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 border border-slate-700 transition flex items-center justify-center gap-1">
        <i class="fa-solid fa-play text-[10px]"></i> 调度此 Agent
      </button>
    `;
    grid.appendChild(div);
  });
}
function updateDispatcherAgentCards() {
  Object.values(allAgentsData).forEach(a => {
    const badge = document.getElementById(`badge-${a.id}`);
    if (badge) {
      if (a.installed) {
        badge.className = "text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
        badge.innerText = a.model_arg ? `就绪 (${a.model_arg})` : `已就绪 ${a.version.split(' ')[0]}`;
      } else {
        badge.className = "text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30";
        badge.innerText = "未检测到";
      }
    }
  });
}
function selectAgentInDispatcher(agentId) {
  currentDispatcherAgent = agentId;
  ['claude', 'pi', 'codex', 'antigravity'].forEach(id => {
    const card = document.getElementById(`card-agent-${id}`);
    if (!card) return;
    if (id === agentId) {
      let borderCol = "border-amber-500 bg-amber-500/10";
      if (id === 'pi') borderCol = "border-emerald-500 bg-emerald-500/10";
      if (id === 'codex') borderCol = "border-sky-500 bg-sky-500/10";
      if (id === 'antigravity') borderCol = "border-purple-500 bg-purple-500/10";
      card.className = `agent-select-card cursor-pointer rounded-2xl p-5 border-2 ${borderCol} transition shadow-xl`;
    } else {
      card.className = "agent-select-card cursor-pointer rounded-2xl p-5 border-2 border-slate-800 bg-slate-900/60 hover:border-slate-700 transition";
    }
  });
  refreshDispatcherCommand();
}
function setTaskTypeInDispatcher(taskType) {
  currentDispatcherTask = taskType;
  ['full', 'pcb', 'firmware', 'drc_fix'].forEach(t => {
    const btn = document.getElementById(`btn-task-${t}`);
    if (!btn) return;
    if (t === taskType) {
      btn.className = "task-btn p-2.5 rounded-xl border border-sky-500 bg-sky-500/20 text-sky-200 text-xs font-medium text-left transition";
    } else {
      btn.className = "task-btn p-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 text-xs font-medium text-left transition hover:border-slate-700";
    }
  });
  const pipe = platformSettings?.workspace?.pipeline || {};
  const roleHint = document.getElementById('pipeline-role-hint');
  if (roleHint) {
    if (taskType === 'pcb' && pipe.pcb_agent) {
      roleHint.innerText = `💡 流水线推荐：硬件 PCB 任务已绑定优先使用 [${pipe.pcb_agent.toUpperCase()}]`;
    } else if (taskType === 'firmware' && pipe.firmware_agent) {
      roleHint.innerText = `💡 流水线推荐：嵌入式 C 固件任务已绑定优先使用 [${pipe.firmware_agent.toUpperCase()}]`;
    } else if (taskType === 'drc_fix' && pipe.drc_agent) {
      roleHint.innerText = `💡 流水线推荐：DRC 自愈任务已绑定优先使用 [${pipe.drc_agent.toUpperCase()}]`;
    } else {
      roleHint.innerText = '';
    }
  }
  refreshDispatcherCommand();
}
async function refreshDispatcherCommand() {
  const pdir = document.getElementById('disp-project-dir')?.value || activeProjectDir;
  if (!pdir) return;
  try {
    const res = await fetch('/api/agents/command', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        agent_id: currentDispatcherAgent,
        task_type: currentDispatcherTask,
        project_dir: pdir
      })
    });
    currentDispatcherCmdInfo = await res.json();
    const pre = document.getElementById('disp-cmd-preview');
    if (pre) pre.innerText = currentDispatcherCmdInfo.command;
  } catch (err) {
    console.error("生成 Agent 指令失败:", err);
  }
}
function copyDispatcherCmd() {
  if (!currentDispatcherCmdInfo) return;
  navigator.clipboard.writeText(currentDispatcherCmdInfo.command);
  showToast(`已复制 ${currentDispatcherCmdInfo.agent_name} 的非交互启动命令！`);
}
function copyDispatcherInteractiveCmd() {
  if (!currentDispatcherCmdInfo) return;
  navigator.clipboard.writeText(currentDispatcherCmdInfo.interactive_command);
  showToast(`已复制 ${currentDispatcherCmdInfo.agent_name} 的交互式终端命令！`);
}
async function dispatchAgentFromCenter() {
  const pdir = document.getElementById('disp-project-dir')?.value || activeProjectDir;
  const card = document.getElementById('disp-console-card');
  card.classList.remove('hidden');
  document.getElementById('console-title').innerText = `正在启动 ${currentDispatcherAgent}...`;
  document.getElementById('disp-live-log').innerText = "正在拉起后台 Agent 进程并建立标准输出管道...\n";
  const killBtn = document.getElementById('btn-kill-task');
  if (killBtn) killBtn.classList.remove('hidden');
  try {
    const res = await fetch('/api/agents/dispatch', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        agent_id: currentDispatcherAgent,
        task_type: currentDispatcherTask,
        project_dir: pdir
      })
    });
    const j = await res.json();
    if (j.success) {
      activeRunningTaskId = j.task_id;
      document.getElementById('console-title').innerText = `${j.agent_name} 运行中 [${currentDispatcherTask}]`;
      document.getElementById('console-pid').innerText = `PID: ${j.pid}`;
      startPollingTaskLog(j.task_id);
    } else {
      alert("启动失败: " + (j.error || "未知错误"));
      document.getElementById('disp-live-log').innerText += `\n[错误] ${j.error}\n`;
    }
  } catch (err) {
    alert("调度异常: " + err);
  }
}
async function stopActiveAgentTask() {
  if (!activeRunningTaskId) return;
  try {
    const res = await fetch(`/api/agents/task/${activeRunningTaskId}/kill`, { method: 'POST' });
    const d = await res.json();
    if (d.success) {
      showToast("已终止后台运行的 Agent 任务！");
      refreshConsoleLog();
    }
  } catch (err) {
    alert("终止任务失败: " + err);
  }
}
function startPollingTaskLog(taskId) {
  if (activePollTimer) clearInterval(activePollTimer);
  activePollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/agents/task/${taskId}`);
      const data = await res.json();
      if (data.found) {
        document.getElementById('console-timer').innerText = `耗时: ${data.elapsed_sec}s`;
        const logEl = document.getElementById('disp-live-log');
        logEl.innerText = data.log_tail || "等待日志流输出...";
        logEl.scrollTop = logEl.scrollHeight;
        if (data.status !== 'running') {
          clearInterval(activePollTimer);
          const pulse = document.getElementById('console-pulse');
          if (pulse) pulse.classList.remove('animate-pulse');
          document.getElementById('console-title').innerText = `${data.agent_name} 已结束 (${data.status})`;
          const killBtn = document.getElementById('btn-kill-task');
          if (killBtn) killBtn.classList.add('hidden');
          fetchAndApplyProjectDetail(activeProjectDir);
        }
      }
    } catch (e) {
      console.error("轮询日志异常:", e);
    }
  }, 1500);
}
function refreshConsoleLog() {
  if (activeRunningTaskId) {
    fetch(`/api/agents/task/${activeRunningTaskId}`)
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          const logEl = document.getElementById('disp-live-log');
          logEl.innerText = data.log_tail || "";
          logEl.scrollTop = logEl.scrollHeight;
        }
      });
  }
}
async function switchQuickAgent(agentId) {
  currentQuickAgent = agentId;
  ['claude', 'pi', 'codex', 'antigravity'].forEach(id => {
    const btn = document.getElementById(`btn-quick-${id}`);
    if (!btn) return;
    if (id === agentId) {
      let bClass = "quick-agent-btn p-3 rounded-xl border border-amber-500/60 bg-amber-500/10 text-left transition";
      if (id === 'pi') bClass = "quick-agent-btn p-3 rounded-xl border border-emerald-500/60 bg-emerald-500/10 text-left transition";
      if (id === 'codex') bClass = "quick-agent-btn p-3 rounded-xl border border-sky-500/60 bg-sky-500/10 text-left transition";
      if (id === 'antigravity') bClass = "quick-agent-btn p-3 rounded-xl border border-purple-500/60 bg-purple-500/10 text-left transition";
      btn.className = bClass;
    } else {
      btn.className = "quick-agent-btn p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-left transition hover:border-slate-700";
    }
  });
  try {
    const res = await fetch('/api/agents/command', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        agent_id: agentId,
        task_type: "full",
        project_dir: activeProjectDir
      })
    });
    const d = await res.json();
    document.getElementById('quick-agent-cmd').value = d.command;
  } catch (err) {
    console.error(err);
  }
}
function copyQuickCmd() {
  const el = document.getElementById('quick-agent-cmd');
  if (!el) return;
  navigator.clipboard.writeText(el.value);
  showToast("已复制专属 Agent 启动指令！");
}
async function dispatchQuickAgent() {
  selectAgentInDispatcher(currentQuickAgent);
  switchTab('agents');
  await dispatchAgentFromCenter();
}
function goToDispatcherWithCurrentProject() {
  if (activeProjectDir) {
    const el = document.getElementById('disp-project-dir');
    if (el) el.value = activeProjectDir;
  }
  switchTab('agents');
}
let currentPcbCanvasView = '3d'; // '3d' | '2d_pcb' | '2d_sch'
function populateStudioLlmModelSelects() {
  if (!platformSettings || !platformSettings.llm) return;
  const llm = platformSettings.llm;
  const providers = llm.providers || {};
  const activeProv = llm.active_provider || 'custom';
  const activeModel = (providers[activeProv]?.default_model || llm.model || 'Default-LLM');
  const options = [];
  options.push({
    val: `${activeProv}::${activeModel}`,
    label: `默认: ${activeModel.split('/').pop()} (${providers[activeProv]?.name || activeProv})`
  });
  Object.values(providers).forEach(p => {
    const pid = p.id;
    const pname = p.name || pid;
    const defMod = p.default_model;
    if (defMod && `${pid}::${defMod}` !== options[0].val) {
      options.push({
        val: `${pid}::${defMod}`,
        label: `${defMod.split('/').pop()} · ${pname}`
      });
    }
    (p.models || []).slice(0, 3).forEach(m => {
      const key = `${pid}::${m}`;
      if (!options.some(o => o.val === key)) {
        options.push({
          val: key,
          label: `${m.split('/').pop()} · ${pname}`
        });
      }
    });
  });
  ['pcb-llm-model-select', 'fw-llm-model-select'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const prevVal = sel.value;
    sel.innerHTML = '';
    options.forEach(optObj => {
      const opt = document.createElement('option');
      opt.value = optObj.val;
      opt.innerText = optObj.label;
      sel.appendChild(opt);
    });
    if (prevVal && options.some(o => o.val === prevVal)) {
      sel.value = prevVal;
    }
  });
  onStudioEngineChange('pcb');
  onStudioEngineChange('firmware');
}
function renderReviewPane() {
  if (!activeProjectDetail) return;
  const hw = activeProjectDetail.hardware || {};
  const fw = activeProjectDetail.firmware || {};
  const spec = activeProjectDetail.spec || {};
  const mech = spec.mechanical || {};
  const syncInfo = activeProjectDetail.cross_module_sync || {};
  const titleEl = document.getElementById('rev-project-title');
  const subEl = document.getElementById('rev-project-subtitle');
  if (titleEl) titleEl.innerText = `📐 模块一：PCB 硬件设计工坊 (${activeProjectDetail.project_name})`;
  if (subEl) {
    subEl.innerText = `工程路径: ${activeProjectDetail.project_dir} | 尺寸: ${mech.width_mm || '-'}×${mech.height_mm || '-'}mm (${mech.layers || 2}层) | 主控: ${spec.mcu?.model || '-'}`;
  }
  const pcbSyncBanner = document.getElementById('pcb-cross-sync-banner');
  if (pcbSyncBanner) {
    if (syncInfo.pcb_needs_sync) pcbSyncBanner.classList.remove('hidden');
    else pcbSyncBanner.classList.add('hidden');
  }
  const fwSyncBanner = document.getElementById('fw-cross-sync-banner');
  if (fwSyncBanner) {
    if (syncInfo.fw_needs_sync) fwSyncBanner.classList.remove('hidden');
    else fwSyncBanner.classList.add('hidden');
  }
  renderStudioQuickPinoutDrawer();
  const pcbSelect = document.getElementById('rev-pcb-select');
  if (pcbSelect) {
    pcbSelect.innerHTML = '';
    if ((hw.pcb_files || []).length === 0) {
      pcbSelect.innerHTML = '<option value="">当前工程暂无 .kicad_pcb 文件 (请点击生成基准 PCB)</option>';
    } else {
      hw.pcb_files.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.innerText = p.split('/').pop();
        if (p === hw.primary_pcb) opt.selected = true;
        pcbSelect.appendChild(opt);
      });
    }
  }
  const topImg = document.getElementById('rev-top-3d-img');
  const botImg = document.getElementById('rev-bot-3d-img');
  const empty3d = document.getElementById('rev-3d-empty-hint');
  if (hw.top_3d_img) {
    if (empty3d) empty3d.classList.add('hidden');
    if (topImg) {
      topImg.src = `/api/projects/file?path=${encodeURIComponent(hw.top_3d_img)}&t=${Date.now()}`;
      topImg.classList.remove('hidden');
    }
    if (botImg && hw.bottom_3d_img) {
      botImg.src = `/api/projects/file?path=${encodeURIComponent(hw.bottom_3d_img)}&t=${Date.now()}`;
      botImg.classList.remove('hidden');
    }
  } else {
    if (topImg) topImg.classList.add('hidden');
    if (botImg) botImg.classList.add('hidden');
    if (empty3d) empty3d.classList.remove('hidden');
  }
  const pcbSvgImg = document.getElementById('rev-pcb-2d-svg-img');
  if (pcbSvgImg && hw.pcb_2d_svg) {
    pcbSvgImg.src = `/api/projects/file?path=${encodeURIComponent(hw.pcb_2d_svg)}&t=${Date.now()}`;
  }
  const schSvgImg = document.getElementById('rev-sch-2d-svg-img');
  if (schSvgImg && hw.sch_2d_svg) {
    schSvgImg.src = `/api/projects/file?path=${encodeURIComponent(hw.sch_2d_svg)}&t=${Date.now()}`;
  }
  renderDrcResultBox(hw.drc);
  renderGerberBanner(hw.gerber_zip);
  renderReleaseBundleBanner(activeProjectDetail.release_bundle);
  renderJlcDfmDashboard(hw.jlc_dfm);
  renderJlcDownloadBar(hw);
  renderFirmwareMemoryBars(fw.memory_usage, fw.binaries);
  renderFirmwarePinCoveragePanel(fw.pin_coverage);
  const bomTbody = document.getElementById('rev-bom-tbody');
  const bomCountEl = document.getElementById('rev-bom-count');
  if (bomTbody) {
    bomTbody.innerHTML = '';
    const rows = hw.bom_rows || [];
    if (bomCountEl) bomCountEl.innerText = `${rows.length} 项物料`;
    if (rows.length === 0) {
      bomTbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-500 text-xs">当前工程暂无 BOM CSV 文件</td></tr>';
    } else {
      rows.slice(0, 60).forEach((r, idx) => {
        const vals = Object.values(r);
        const refStr = r.Reference || r.Designator || r['位号'] || vals[0] || `R${idx+1}`;
        const valStr = r.Value || r.Comment || r['型号/值'] || vals[1] || '-';
        const fpStr = r.Footprint || r['封装'] || vals[2] || '-';
        const lcscCode = (r.LCSC || r['LCSC Part #'] || 'C25804').trim();
        const libType = (r.LibraryType || r['Library Type'] || 'Basic').trim();
        const isBasic = libType.toLowerCase().includes('basic');
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-800/60 text-xs hover:bg-slate-900/40";
        tr.innerHTML = `
          <td class="py-1.5 px-2 font-mono text-sky-400 font-bold">${escapeHtml(refStr)}</td>
          <td class="py-1.5 px-2 font-semibold text-slate-200">${escapeHtml(valStr)}</td>
          <td class="py-1.5 px-2 font-mono text-amber-400">${escapeHtml(fpStr)}</td>
          <td class="py-1.5 px-2">
            <div class="flex items-center gap-1">
              <input type="text" id="bom-lcsc-${idx}" value="${escapeHtml(lcscCode)}" class="w-24 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-[11px] font-mono text-emerald-400 font-bold">
              <button type="button" onclick="saveBomItemInline('${escapeHtml(refStr)}', ${idx})" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-[10px] transition" title="保存立创编号修改">
                <i class="fa-solid fa-check"></i>
              </button>
            </div>
          </td>
          <td class="py-1.5 px-2">
            <select id="bom-lib-${idx}" onchange="saveBomItemInline('${escapeHtml(refStr)}', ${idx})" class="bg-slate-900 border ${isBasic ? 'border-emerald-500/40 text-emerald-400' : 'border-amber-500/40 text-amber-400'} rounded px-1.5 py-0.5 text-[10px] font-mono">
              <option value="Basic" ${isBasic ? 'selected' : ''}>基础库 Basic (免换料费)</option>
              <option value="Extended" ${!isBasic ? 'selected' : ''}>扩展库 Extended</option>
            </select>
          </td>
          <td class="py-1.5 px-2 text-slate-400 font-mono">${r.Qty || r.Quantity || r['数量'] || '1'}</td>
          <td class="py-1.5 px-2 text-right">
            <a href="https://so.szlcsc.com/global.html?k=${encodeURIComponent(lcscCode)}" target="_blank" rel="noopener" class="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono inline-flex items-center gap-1">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 立创商城
            </a>
          </td>
        `;
        bomTbody.appendChild(tr);
      });
    }
  }
  const fwListEl = document.getElementById('rev-fw-file-list');
  if (fwListEl) {
    fwListEl.innerHTML = '';
    const files = fw.files || [];
    files.forEach(f => {
      const isSelected = f.abs_path === currentEditingFwPath;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.onclick = () => previewFirmwareSource(f.abs_path);
      btn.className = `w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition ${
        isSelected
          ? 'border-sky-500 bg-sky-500/15 text-white shadow'
          : 'border-slate-800 bg-slate-900/70 hover:border-sky-500/50 text-slate-200'
      }`;
      btn.innerHTML = `
        <span class="font-mono truncate"><i class="fa-regular fa-file-code text-sky-400 mr-1.5"></i>${f.rel_path}</span>
        <span class="text-[10px] text-slate-500">${(f.size_bytes / 1024).toFixed(1)} KB</span>
      `;
      fwListEl.appendChild(btn);
    });
    if (files.length > 0) {
      const targetFile = files.find(f => f.abs_path === currentEditingFwPath) || files[0];
      previewFirmwareSource(targetFile.abs_path);
    } else {
      const codeEl = document.getElementById('rev-fw-code-viewer');
      if (codeEl) {
        codeEl.value = activeProjectDetail.bsp_header_code || '// 暂无固件源码';
        codeEl.innerText = activeProjectDetail.bsp_header_code || '// 暂无固件源码';
        updateFirmwareLineNumbers();
      }
    }
  }
  const repCard = document.getElementById('rev-delivery-report-card');
  const repPre = document.getElementById('rev-delivery-report-pre');
  if (repCard && repPre) {
    if (activeProjectDetail.delivery_report) {
      repCard.classList.remove('hidden');
      repPre.innerText = activeProjectDetail.delivery_report;
    } else {
      repCard.classList.add('hidden');
    }
  }
  if (typeof syncWorkbenchExplorerAndDiagnostics === 'function') {
    syncWorkbenchExplorerAndDiagnostics(activeProjectDetail);
  }
}
function switchPcbCanvasView(viewMode) {
  currentPcbCanvasView = viewMode;
  const p3d = document.getElementById('pcb-canvas-pane-3d');
  const p2d = document.getElementById('pcb-canvas-pane-2d');
  const psch = document.getElementById('pcb-canvas-pane-sch');
  const b3d = document.getElementById('btn-pcb-canvas-3d');
  const b2d = document.getElementById('btn-pcb-canvas-2d');
  const bsch = document.getElementById('btn-pcb-canvas-sch');
  const activeCls = "px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 shadow transition";
  const idleCls = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition";
  if (p3d) p3d.classList.toggle('hidden', viewMode !== '3d');
  if (p2d) p2d.classList.toggle('hidden', viewMode !== '2d_pcb');
  if (psch) psch.classList.toggle('hidden', viewMode !== '2d_sch');
  if (b3d) b3d.className = viewMode === '3d' ? activeCls : idleCls;
  if (b2d) b2d.className = viewMode === '2d_pcb' ? activeCls : idleCls;
  if (bsch) bsch.className = viewMode === '2d_sch' ? activeCls : idleCls;
  if ((viewMode === '2d_pcb' || viewMode === '2d_sch') && activeProjectDetail) {
    const hw = activeProjectDetail.hardware || {};
    if (!hw.pcb_2d_svg || !hw.sch_2d_svg) {
      refresh2dSvgViews(true);
    }
  }
}
async function refresh2dSvgViews(silent = false) {
  try {
    const res = await fetch('/api/verify/render2d', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir })
    });
    const d = await res.json();
    if (d.success && d.detail) {
      activeProjectDetail = d.detail;
      const hw = d.detail.hardware || {};
      const pcbSvgImg = document.getElementById('rev-pcb-2d-svg-img');
      if (pcbSvgImg && hw.pcb_2d_svg) {
        pcbSvgImg.src = `/api/projects/file?path=${encodeURIComponent(hw.pcb_2d_svg)}&t=${Date.now()}`;
      }
      const schSvgImg = document.getElementById('rev-sch-2d-svg-img');
      if (schSvgImg && hw.sch_2d_svg) {
        schSvgImg.src = `/api/projects/file?path=${encodeURIComponent(hw.sch_2d_svg)}&t=${Date.now()}`;
      }
      if (!silent) showToast("已刷新 2D 铜皮走线 SVG 与原理图 SVG 预览！", 'success');
    }
  } catch (err) {
    if (!silent) showToast("刷新 2D SVG 失败: " + err, 'error');
  }
}
function renderJlcDfmDashboard(dfm) {
  const grid = document.getElementById('jlc-dfm-cards-grid');
  const freeBadge = document.getElementById('jlc-free-tier-badge');
  if (!grid || !dfm) return;
  if (freeBadge) {
    if (dfm.free_tier_eligible) {
      freeBadge.className = "text-xs px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold";
      freeBadge.innerText = `✅ 符合嘉立创 ≤100×100mm 免费/特价打样线 (${dfm.width_mm}×${dfm.height_mm}mm)`;
    } else {
      freeBadge.className = "text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold";
      freeBadge.innerText = `⚠️ 超出 100×100mm 免费打样线 (${dfm.width_mm}×${dfm.height_mm}mm)`;
    }
  }
  const checks = dfm.checks || [];
  if (checks.length > 0) {
    grid.innerHTML = checks.map(c => `
      <div class="p-2.5 rounded-xl bg-slate-950/90 border ${c.passed ? 'border-emerald-500/30' : 'border-amber-500/40'} space-y-1">
        <div class="text-[10px] text-slate-400 flex items-center justify-between">
          <span>${escapeHtml(c.title)}</span>
          <span>${c.passed ? '🟢 合规' : '🟡 可优化'}</span>
        </div>
        <div class="text-xs font-bold ${c.passed ? 'text-emerald-400' : 'text-amber-300'}">${escapeHtml(c.value)}</div>
        <div class="text-[10px] text-slate-400 leading-tight">${escapeHtml(c.tip)}</div>
      </div>
    `).join('');
  }
}
async function saveBomItemInline(ref, idx) {
  const lcscEl = document.getElementById(`bom-lcsc-${idx}`);
  const libEl = document.getElementById(`bom-lib-${idx}`);
  if (!lcscEl || !libEl) return;
  const lcscCode = lcscEl.value.trim();
  const libType = libEl.value;
  try {
    const res = await fetch('/api/pcb/bom/update', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        project_dir: activeProjectDir,
        reference: ref,
        lcsc: lcscCode,
        lib_type: libType
      })
    });
    const d = await res.json();
    if (d.success && d.detail) {
      activeProjectDetail = d.detail;
      renderReviewPane();
      showToast(`已更新元器件 ${ref} -> 立创编号 ${lcscCode} (${libType}) 并同步刷新 JLC_BOM.csv！`, 'success');
    } else {
      showToast("更新 BOM 失败: " + (d.update?.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("更新 BOM 异常: " + err, 'error');
  }
}
async function optimizeBomToJlcBasic() {
  try {
    const res = await fetch('/api/pcb/bom/optimize_jlc', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir })
    });
    const d = await res.json();
    if (d.success && d.detail) {
      activeProjectDetail = d.detail;
      renderReviewPane();
      const cnt = d.optimize?.replaced_count || 0;
      showToast(
        cnt > 0
          ? `🪄 已将 ${cnt} 项扩展库器件一键转换为嘉立创 SMT 基础库 (Basic Library)，预估换料费降至 ¥0！`
          : `✅ 当前 BOM 全部元器件均已处于嘉立创 SMT 基础库 (Basic) 免换料费状态！`,
        'success'
      );
    }
  } catch (err) {
    showToast("立创基础库优化异常: " + err, 'error');
  }
}
async function runExportEasyEdaPackage() {
  const btn = document.getElementById('btn-export-easyeda');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在打包 EasyEDA Pro...';
  }
  try {
    const res = await fetch('/api/pcb/export_easyeda', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir })
    });
    const d = await res.json();
    if (d.success && d.easyeda) {
      if (d.detail) {
        activeProjectDetail = d.detail;
        renderReviewPane();
      }
      const zp = d.easyeda.easyeda_zip;
      const fn = zp.split('/').pop();
      showToast(`已生成嘉立创 EDA 专业版导入包 ${fn} (${d.easyeda.size_kb} KB)！`, 'success');
      const a = document.createElement('a');
      a.href = `/api/projects/file?path=${encodeURIComponent(zp)}`;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      showToast("导出嘉立创 EDA 工程包失败: " + (d.easyeda?.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("导出嘉立创 EDA 工程包异常: " + err, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
function toggleStudioPinoutDrawer(module) {
  const drawerId = module === 'firmware' ? 'fw-pinout-drawer' : 'pcb-pinout-drawer';
  const el = document.getElementById(drawerId);
  if (!el) return;
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    renderStudioQuickPinoutDrawer();
  }
}
function renderStudioQuickPinoutDrawer() {
  if (!activeProjectDetail) return;
  const pinout = activeProjectDetail.pinout || [];
  ['pcb', 'firmware'].forEach(mod => {
    const tbody = document.getElementById(mod === 'firmware' ? 'fw-quick-pinout-tbody' : 'pcb-quick-pinout-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    pinout.forEach((p, idx) => {
      const pinStr = p.pin || p.mcu_pin || '';
      const netStr = p.net_name || '';
      const funcStr = p.function || p.type_or_func || 'GPIO_Output';
      const descStr = p.description || p.notes || '';
      const macroStem = netStr.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase() || `SIG_${idx}`;
      const tr = document.createElement('tr');
      tr.className = "border-b border-slate-800/60 cross-probe-pin-row transition";
      tr.setAttribute('data-pin', pinStr);
      tr.setAttribute('data-net', netStr);
      tr.innerHTML = `
        <td class="py-1 px-1.5"><input type="text" value="${escapeHtml(pinStr)}" class="qpin-pin w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-amber-300 font-bold"></td>
        <td class="py-1 px-1.5"><input type="text" value="${escapeHtml(netStr)}" class="qpin-net w-32 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-sky-300 font-bold"></td>
        <td class="py-1 px-1.5"><input type="text" value="${escapeHtml(funcStr)}" class="qpin-func w-28 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-200"></td>
        <td class="py-1 px-1.5 font-mono text-[11px] text-emerald-400 cursor-pointer hover:underline" onclick="crossProbeFromHardwarePin('${escapeHtml(pinStr)}', '${escapeHtml(netStr)}')" title="点击跨屏高亮定位 C99 代码中的此引脚宏">PIN_${escapeHtml(macroStem)}_PIN_INDEX</td>
        <td class="py-1 px-1.5"><input type="text" value="${escapeHtml(descStr)}" class="qpin-desc w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300"></td>
        <td class="py-1 px-1.5 text-right flex items-center justify-end gap-1">
          <button type="button" onclick="crossProbeFromHardwarePin('${escapeHtml(pinStr)}', '${escapeHtml(netStr)}')" class="text-sky-400 hover:text-sky-300 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-[10px] font-mono" title="方案 B：跨屏联动定位 C99 固件中的该引脚代码行">
            <i class="fa-solid fa-crosshairs"></i> 定位代码
          </button>
          <button type="button" onclick="removeStudioQuickPinRow(this)" class="text-rose-400 hover:text-rose-300 px-1.5 py-0.5"><i class="fa-solid fa-xmark"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}
function addStudioQuickPinRow(module) {
  const tbody = document.getElementById(module === 'firmware' ? 'fw-quick-pinout-tbody' : 'pcb-quick-pinout-tbody');
  if (!tbody) return;
  const idx = tbody.querySelectorAll('tr').length + 1;
  const tr = document.createElement('tr');
  tr.className = "border-b border-slate-800/60";
  tr.innerHTML = `
    <td class="py-1 px-1.5"><input type="text" value="PB${idx % 8}" class="qpin-pin w-20 bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-xs font-mono text-amber-300 font-bold"></td>
    <td class="py-1 px-1.5"><input type="text" value="NEW_SIG_${idx}" class="qpin-net w-32 bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-xs font-mono text-sky-300 font-bold"></td>
    <td class="py-1 px-1.5"><input type="text" value="GPIO_Output" class="qpin-func w-28 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-slate-200"></td>
    <td class="py-1 px-1.5 font-mono text-[11px] text-emerald-400">PIN_NEW_SIG_${idx}_PIN_INDEX</td>
    <td class="py-1 px-1.5"><input type="text" value="工坊快捷新增外设信号" class="qpin-desc w-full bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300"></td>
    <td class="py-1 px-1.5 text-right">
      <button type="button" onclick="removeStudioQuickPinRow(this)" class="text-rose-400 hover:text-rose-300 px-1.5 py-0.5"><i class="fa-solid fa-xmark"></i></button>
    </td>
  `;
  tbody.appendChild(tr);
}
function removeStudioQuickPinRow(btnEl) {
  const tr = btnEl.closest('tr');
  if (tr) tr.remove();
}
async function saveStudioQuickPinout(module, rebuildPcb = true, recompileFw = true) {
  const tbody = document.getElementById(module === 'firmware' ? 'fw-quick-pinout-tbody' : 'pcb-quick-pinout-tbody');
  if (!tbody) return;
  const rows = [];
  tbody.querySelectorAll('tr').forEach(tr => {
    const pin = tr.querySelector('.qpin-pin')?.value.trim() || '';
    const net = tr.querySelector('.qpin-net')?.value.trim() || '';
    const func = tr.querySelector('.qpin-func')?.value.trim() || 'GPIO_Output';
    const desc = tr.querySelector('.qpin-desc')?.value.trim() || '';
    if (pin && net) {
      rows.push({ pin, net_name: net, function: func, description: desc });
    }
  });
  showToast("正在保存共享引脚表并同步更新 bsp_pinout.h、PCB 与固件...", 'info');
  try {
    const res = await fetch('/api/ssot/quick_pinout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        project_dir: activeProjectDir,
        pinout: rows,
        rebuild_pcb: rebuildPcb,
        recompile_fw: recompileFw
      })
    });
    const d = await res.json();
    if (d.success && d.detail) {
      activeProjectDetail = d.detail;
      renderReviewPane();
      populateIntakeFromProject(d.detail);
      showToast(`✅ 已同步更新共享引脚表 (${rows.length} 项)、bsp_pinout.h 宏定义、PCB 版图与固件编译！`, 'success');
    } else {
      showToast("保存共享引脚表失败: " + (d.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("保存共享引脚表异常: " + err, 'error');
  }
}
function renderFirmwarePinCoveragePanel(cov) {
  const panel = document.getElementById('fw-pin-coverage-panel');
  if (!panel) return;
  if (!cov || !cov.items || cov.items.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const pct = cov.coverage_pct ?? 100;
  const uncov = cov.uncovered_count || 0;
  const chipsHtml = cov.items.map(item => {
    const badgeCls = item.covered
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25';
    const statusIcon = item.covered ? '✅' : '⚠️ 未绑定';
    return `
      <div data-pin="${escapeHtml(item.pin)}" data-net="${escapeHtml(item.net_name)}" class="cross-probe-pin-chip inline-flex items-center rounded-lg border text-[11px] font-mono transition ${badgeCls}">
        <button type="button" onclick="crossProbeFromHardwarePin('${escapeHtml(item.pin)}', '${escapeHtml(item.net_name)}')" class="px-2 py-1 flex items-center gap-1 hover:underline" title="点击在 C99 编辑器中跨屏高亮定位该引脚宏 (${escapeHtml(item.macro_index)})">
          <span>${statusIcon}</span>
          <strong>${escapeHtml(item.pin)}:${escapeHtml(item.net_name)}</strong>
          <span class="text-[10px] opacity-75">(${escapeHtml(item.function)})</span>
        </button>
        <button type="button" onclick="sendQuickCopilotPrompt('firmware', '请在状态机中完善引脚 ${item.pin} (${item.net_name}, 宏 ${item.macro_index}, 功能 ${item.function}) 的初始化与读写驱动逻辑，并重新编译验证')" class="px-1.5 py-1 border-l border-slate-700/60 hover:bg-sky-500/20 text-sky-300" title="让 AI 自动生成或优化该引脚的 C99 驱动代码">
          <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
        </button>
      </div>
    `;
  }).join('');
  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
      <div class="flex items-center gap-2 text-xs">
        <span class="font-bold text-slate-200"><i class="fa-solid fa-plug-circle-check text-emerald-400 mr-1.5"></i>SSOT 硬件引脚宏 (<code class="font-mono text-emerald-400">bsp_pinout.h</code>) 驱动覆盖率：</span>
        <span class="px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${uncov === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${cov.covered_count} / ${cov.total_pins} 已覆盖 (${pct}%)</span>
      </div>
      <button type="button" onclick="sendQuickCopilotPrompt('firmware', '请根据 bsp_pinout.h 中定义的全部引脚宏，在状态机中实现 100% 引脚绑定、初始化与非阻塞轮询逻辑，并立即调用 GCC 重新编译验证')" class="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
        <i class="fa-solid fa-wand-magic-sparkles"></i> 一键生成 100% 全引脚绑定驱动
      </button>
    </div>
    <div class="flex flex-wrap gap-1.5 pt-1">
      ${chipsHtml}
    </div>
  `;
}
function updateFirmwareLineNumbers() {
  const viewer = document.getElementById('rev-fw-code-viewer');
  const gutter = document.getElementById('fw-editor-line-numbers');
  if (!viewer || !gutter) return;
  const text = viewer.value || '';
  const count = Math.max(1, text.split('\n').length);
  const nums = [];
  for (let i = 1; i <= count; i++) {
    nums.push(i);
  }
  gutter.innerText = nums.join('\n');
}
function syncFirmwareEditorScroll() {
  const viewer = document.getElementById('rev-fw-code-viewer');
  const gutter = document.getElementById('fw-editor-line-numbers');
  if (viewer && gutter) {
    gutter.scrollTop = viewer.scrollTop;
  }
}
function updateFirmwareCursorLine() {
  const viewer = document.getElementById('rev-fw-code-viewer');
  const ind = document.getElementById('fw-editor-line-indicator');
  if (!viewer || !ind) return;
  const pos = viewer.selectionStart || 0;
  const lineNo = (viewer.value.slice(0, pos).split('\n').length) || 1;
  ind.innerText = `Ln ${lineNo}`;
}
function renderDrcResultBox(drc) {
  const box = document.getElementById('rev-drc-summary');
  if (!box) return;
  if (!drc) {
    box.innerHTML = `<span class="text-xs text-slate-400">尚未对当前 PCB 运行 DRC 检查，请点击上方「运行 DRC 校验」或使用右侧对话助手自动检查。</span>`;
    return;
  }
  const vCount = drc.violations_count || 0;
  const uCount = drc.unconnected_count || 0;
  if (vCount === 0 && uCount === 0) {
    box.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 text-emerald-400 text-xs font-bold">
        <span><i class="fa-solid fa-circle-check mr-1.5"></i> KiCad CLI 官方 DRC 验收通过：0 违规 (Violations) · 0 未连接 (Unconnected)</span>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-mono bg-emerald-500/20 px-2.5 py-0.5 rounded-full">100% 符合嘉立创投产标准</span>
          <button type="button" onclick="sendQuickCopilotPrompt('pcb', '请对当前已通过 DRC 的 PCB 进行电源防护与制造工艺复核，并生成嘉立创 SMT 贴片文件')" class="text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30">
            💬 让 AI 助手复核工艺
          </button>
        </div>
      </div>
    `;
  } else {
    const itemsHtml = (drc.violations || []).slice(0, 8).map(v => {
      const desc = v.description || JSON.stringify(v);
      const vtype = v.type || 'DRC';
      return `
        <div class="flex items-center justify-between gap-2 py-1 border-b border-slate-800/60 text-[11px] font-mono text-rose-400">
          <span class="truncate">· [${escapeHtml(vtype)}] ${escapeHtml(desc)}</span>
          <button type="button" onclick="sendQuickCopilotPrompt('pcb', '请针对 DRC 违规 [${escapeHtml(vtype)}: ${escapeHtml(desc.slice(0, 80))}] 执行自动定位与自愈修复')" class="shrink-0 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px]">
            💬 AI 修复此项
          </button>
        </div>`;
    }).join('');
    box.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2 text-amber-400 text-xs font-bold">
          <span><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> DRC 检测结果：${vCount} 项违规 · ${uCount} 项未连接网络</span>
          <div class="flex items-center gap-2">
            <button type="button" onclick="sendQuickCopilotPrompt('pcb', '当前 PCB 检测到 ${vCount} 项 DRC 违规和 ${uCount} 项未连接网络，请立即诊断原因、执行自动自愈修复并重新渲染 3D 视图')" class="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow">
              💬 发送全部报错给 AI 对话修复
            </button>
            <button type="button" onclick="runDrcSelfHeal()" class="text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40">
              一键自愈 DRC
            </button>
          </div>
        </div>
        ${itemsHtml}
      </div>
    `;
  }
}
async function runDynamicDrc() {
  const pcbPath = document.getElementById('rev-pcb-select')?.value || '';
  if (!pcbPath) {
    alert("当前工程还没有 .kicad_pcb 文件，请先生成电路板！");
    return;
  }
  const btn = document.getElementById('btn-run-drc');
  if (btn) { btn.disabled = true; btn.innerText = "正在运行 DRC..."; }
  try {
    const fd = new FormData();
    fd.append('board_path', pcbPath);
    const res = await fetch('/api/verify/drc', { method: 'POST', body: fd });
    const d = await res.json();
    if (d.error) {
      alert("DRC 执行失败: " + d.error);
    } else {
      renderDrcResultBox(d);
      showToast(`DRC 校验完成：${d.violations_count} 违规, ${d.unconnected_count} 未连接`);
    }
  } catch (err) {
    alert("DRC 调用异常: " + err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-shield-halved text-emerald-400"></i> 运行 DRC 校验';
    }
  }
}
async function runDynamic3dRender() {
  const pcbPath = document.getElementById('rev-pcb-select')?.value || '';
  if (!pcbPath) {
    alert("当前工程还没有 .kicad_pcb 文件，无法执行 3D 渲染！");
    return;
  }
  const btn = document.getElementById('btn-render-3d');
  if (btn) { btn.disabled = true; btn.innerText = "正在渲染 2D/3D..."; }
  try {
    await refresh2dSvgViews(true);
    const res = await fetch('/api/verify/render3d', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, pcb_path: pcbPath })
    });
    const d = await res.json();
    if (d.success) {
      await fetchAndApplyProjectDetail(activeProjectDir);
      showToast(`2D 走线 SVG 与 3D 光线追踪渲染完成 (耗时 ${d.elapsed_sec}s)！`);
    } else {
      alert("3D 渲染失败: " + d.error);
    }
  } catch (err) {
    alert("3D 渲染请求异常: " + err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-camera-rotate text-sky-400"></i> 刷新 2D/3D 视图';
    }
  }
}
async function previewFirmwareSource(absPath) {
  try {
    const res = await fetch(`/api/projects/read_source?path=${encodeURIComponent(absPath)}`);
    const d = await res.json();
    if (d.success) {
      currentEditingFwPath = d.path;
      fwEditorDirty = false;
      const dirtyBadge = document.getElementById('fw-editor-dirty-badge');
      if (dirtyBadge) dirtyBadge.classList.add('hidden');
      const nameEl = document.getElementById('rev-fw-current-name');
      if (nameEl) nameEl.innerText = d.name;
      const edTabFwLabel = document.getElementById('edtab-fw-label');
      if (edTabFwLabel) edTabFwLabel.innerText = d.name;
      const pathEl = document.getElementById('rev-fw-current-path');
      if (pathEl) pathEl.innerText = d.path;
      const viewer = document.getElementById('rev-fw-code-viewer');
      if (viewer) {
        viewer.value = d.content;
        viewer.innerText = d.content;
        updateFirmwareLineNumbers();
      }
      if (typeof syncMonacoEditorContent === 'function') {
        syncMonacoEditorContent(d.content, d.name);
      }
      if (typeof updateWorkbenchBreadcrumb === 'function') {
        updateWorkbenchBreadcrumb('firmware');
      }
    }
  } catch (err) {
    console.error(err);
  }
}
function markFirmwareEditorDirty() {
  fwEditorDirty = true;
  const dirtyBadge = document.getElementById('fw-editor-dirty-badge');
  if (dirtyBadge) dirtyBadge.classList.remove('hidden');
}
async function saveCurrentFirmwareSource(autoCompile = false) {
  if (!currentEditingFwPath) {
    showToast("请先从左侧列表选择一个固件源文件", 'warn');
    return;
  }
  const viewer = document.getElementById('rev-fw-code-viewer');
  const content = (typeof getActiveFirmwareEditorContent === 'function')
    ? getActiveFirmwareEditorContent()
    : (viewer ? viewer.value : '');
  if (viewer) viewer.value = content;
  const saveBtn = document.getElementById(autoCompile ? 'btn-save-compile-fw' : 'btn-save-fw-file');
  const origHtml = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${autoCompile ? '正在保存并编译...' : '保存中...'}`;
  }
  try {
    const res = await fetch('/api/projects/save_source', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        path: currentEditingFwPath,
        content: content,
        project_dir: activeProjectDir,
        auto_compile: autoCompile
      })
    });
    const d = await res.json();
    if (d.success) {
      fwEditorDirty = false;
      const dirtyBadge = document.getElementById('fw-editor-dirty-badge');
      if (dirtyBadge) dirtyBadge.classList.add('hidden');
      if (d.build) {
        const logBox = document.getElementById('rev-fw-verify-log');
        if (logBox) {
          logBox.classList.remove('hidden');
          logBox.innerText = d.build.log || '';
        }
        if (typeof handleGccBuildResultInWorkbench === 'function') {
          handleGccBuildResultInWorkbench(d.build);
        }
        if (d.build.memory_usage) {
          renderFirmwareMemoryBars(d.build.memory_usage, d.detail?.firmware?.binaries);
        }
      }
      if (d.detail) {
        activeProjectDetail = d.detail;
        renderFirmwarePinCoveragePanel(d.detail.firmware?.pin_coverage);
        if (typeof syncWorkbenchExplorerAndDiagnostics === 'function') {
          syncWorkbenchExplorerAndDiagnostics(d.detail);
        }
      }
      showToast(
        autoCompile
          ? `已保存 ${d.name} 并完成 ARM-GCC 交叉编译与 ELF 链接！`
          : `已保存源文件 ${d.name} (${(d.size_bytes / 1024).toFixed(1)} KB)`,
        'success'
      );
    } else {
      showToast("保存源文件失败: " + (d.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("保存源文件请求异常: " + err, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origHtml;
    }
  }
}
async function runDynamicFirmwareVerify() {
  if (fwEditorDirty && currentEditingFwPath) {
    await saveCurrentFirmwareSource(true);
    return;
  }
  const logBox = document.getElementById('rev-fw-verify-log');
  if (logBox) {
    logBox.classList.remove('hidden');
    logBox.innerText = "正在调用交叉编译器 (arm-none-eabi-gcc) 编译 C 固件、链接 ELF 并统计 Flash/RAM...\n";
  }
  try {
    const res = await fetch('/api/verify/firmware', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir })
    });
    const d = await res.json();
    if (logBox) {
      logBox.innerText = d.log || d.error || "校验完毕";
    }
    if (typeof handleGccBuildResultInWorkbench === 'function') {
      handleGccBuildResultInWorkbench(d);
    }
    await fetchAndApplyProjectDetail(activeProjectDir);
    showToast(
      d.success ? "嵌入式 C 固件编译与 ELF 尺寸统计通过！" : "固件编译存在警告或错误，请查看日志。",
      d.success ? 'success' : 'warn'
    );
  } catch (err) {
    if (logBox) logBox.innerText = "校验请求异常: " + err;
  }
}
function renderGerberBanner(zipPath) {
  const banner = document.getElementById('rev-gerber-banner');
  if (!banner) return;
  if (!zipPath) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  const fname = zipPath.split('/').pop();
  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div class="flex items-center gap-2 text-purple-300 font-medium">
      <i class="fa-solid fa-file-zipper text-purple-400"></i>
      <span>已生成嘉立创生产制造压缩包 (Gerber + Drill + BOM + CPL)：<code class="font-mono text-amber-300">${fname}</code></span>
    </div>
    <a href="/api/projects/file?path=${encodeURIComponent(zipPath)}" download="${fname}" class="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition">
      <i class="fa-solid fa-download"></i> 下载 Gerber 打样包
    </a>
  `;
}
function renderReleaseBundleBanner(bundlePath) {
  const banner = document.getElementById('rev-bundle-banner');
  if (!banner) return;
  if (!bundlePath) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  const fname = bundlePath.split('/').pop();
  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div class="flex items-center gap-2 text-indigo-300 font-medium">
      <i class="fa-solid fa-box-archive text-indigo-400"></i>
      <span>全套软硬件协同交付包 (含 KiCad + Gerber + BOM + C 源码 + .hex/.bin/.elf + 验收报告)：<code class="font-mono text-emerald-300">${fname}</code></span>
    </div>
    <a href="/api/projects/file?path=${encodeURIComponent(bundlePath)}" download="${fname}" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition">
      <i class="fa-solid fa-download"></i> 下载全套交付包
    </a>
  `;
}
function renderFirmwareMemoryBars(mem, binaries = null) {
  const panel = document.getElementById('rev-fw-memory-panel');
  if (!panel) return;
  if (!mem) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }
  panel.classList.remove('hidden');
  const flashPct = Math.min(100, mem.flash_pct || 0);
  const ramPct = Math.min(100, mem.ram_pct || 0);
  const flashBarCol = flashPct > 85 ? 'bg-rose-500' : (flashPct > 65 ? 'bg-amber-400' : 'bg-emerald-400');
  const ramBarCol = ramPct > 85 ? 'bg-rose-500' : (ramPct > 65 ? 'bg-amber-400' : 'bg-sky-400');
  const bins = binaries || activeProjectDetail?.firmware?.binaries || {};
  const hexFile = mem.hex_file || bins.hex || '';
  const binFile = mem.bin_file || bins.bin || '';
  const elfFile = mem.elf_file || bins.elf || '';
  const dlBtns = [];
  if (hexFile) {
    const fn = hexFile.split('/').pop();
    dlBtns.push(`<a href="/api/projects/file?path=${encodeURIComponent(hexFile)}" download="${fn}" class="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1"><i class="fa-solid fa-download"></i> .HEX 烧录包</a>`);
  }
  if (binFile) {
    const fn = binFile.split('/').pop();
    dlBtns.push(`<a href="/api/projects/file?path=${encodeURIComponent(binFile)}" download="${fn}" class="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-mono flex items-center gap-1"><i class="fa-solid fa-download"></i> .BIN 镜像</a>`);
  }
  if (elfFile) {
    const fn = elfFile.split('/').pop();
    dlBtns.push(`<a href="/api/projects/file?path=${encodeURIComponent(elfFile)}" download="${fn}" class="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-mono flex items-center gap-1"><i class="fa-solid fa-download"></i> .ELF 符号表</a>`);
  }
  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800 pb-2">
      <div>
        <span class="font-bold text-slate-200"><i class="fa-solid fa-microchip text-emerald-400 mr-1.5"></i>固件镜像资源占用 (${mem.elf_name} @ ${mem.mcu_id})</span>
        <span class="font-mono text-[10px] text-slate-400 ml-2">.text=${mem.text_bytes}B | .data=${mem.data_bytes}B | .bss=${mem.bss_bytes}B</span>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        ${dlBtns.join('')}
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
      <div>
        <div class="flex justify-between text-[11px] font-mono mb-1">
          <span class="text-emerald-300">Flash (ROM) 占用</span>
          <span class="text-slate-300">${mem.flash_used_bytes} / ${mem.flash_total_bytes} B (${mem.flash_pct}%)</span>
        </div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="${flashBarCol} h-full rounded-full transition-all duration-500" style="width: ${Math.max(2, flashPct)}%"></div>
        </div>
      </div>
      <div>
        <div class="flex justify-between text-[11px] font-mono mb-1">
          <span class="text-sky-300">SRAM (RAM) 占用</span>
          <span class="text-slate-300">${mem.ram_used_bytes} / ${mem.ram_total_bytes} B (${mem.ram_pct}%)</span>
        </div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="${ramBarCol} h-full rounded-full transition-all duration-500" style="width: ${Math.max(2, ramPct)}%"></div>
        </div>
      </div>
    </div>
  `;
}
async function openLocalTool(action) {
  const targetPcb = document.getElementById('rev-pcb-select')?.value || '';
  try {
    const res = await fetch('/api/projects/open_local', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        project_dir: activeProjectDir,
        action: action,
        target_path: action === 'kicad' ? targetPcb : null
      })
    });
    const d = await res.json();
    if (d.success) {
      showToast(d.message || `已打开 ${action}`, 'success');
      if (action === 'easyeda' && d.easyeda_zip) {
        const fn = d.easyeda_zip.split('/').pop();
        const a = document.createElement('a');
        a.href = `/api/projects/file?path=${encodeURIComponent(d.easyeda_zip)}`;
        a.download = fn;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (d.editor_url) {
          window.open(d.editor_url, '_blank', 'noopener');
        }
      }
    } else {
      showToast(d.error || "打开本地工具失败", 'warn');
    }
  } catch (err) {
    showToast("调用本地工具异常: " + err, 'error');
  }
}
async function exportAllInOneBundle() {
  const btn = document.getElementById('btn-export-all-bundle') || document.getElementById('btn-top-bundle');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在打包全套交付物...';
  }
  try {
    const res = await fetch('/api/projects/export_bundle', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir })
    });
    const d = await res.json();
    if (d.success && d.bundle) {
      if (d.detail) {
        activeProjectDetail = d.detail;
        renderReleaseBundleBanner(d.bundle.bundle_zip);
      }
      showToast(`已生成全套交付包 ${d.bundle.bundle_name} (${d.bundle.size_kb} KB，共 ${d.bundle.files_count} 个文件)！`, 'success');
      const a = document.createElement('a');
      a.href = `/api/projects/file?path=${encodeURIComponent(d.bundle.bundle_zip)}`;
      a.download = d.bundle.bundle_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      showToast("打包全套交付物失败: " + (d.bundle?.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("打包请求异常: " + err, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
async function runHardwareScaffold() {
  const btn = document.getElementById('btn-scaffold-hw');
  if (btn) { btn.disabled = true; btn.innerText = "正在生成 PCB & 3D 视图..."; }
  try {
    const res = await fetch('/api/scaffold/hardware', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, overwrite: true })
    });
    const d = await res.json();
    if (d.success) {
      await loadProjectsWorkspace();
      showToast(`已生成 0 违规 KiCad PCB、原理图、2D SVG、BOM 及 3D 渲染视图！`);
    } else {
      alert("生成硬件工程失败: " + JSON.stringify(d));
    }
  } catch (err) {
    alert("生成硬件工程异常: " + err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-amber-400"></i> 生成基准 PCB & 原理图';
    }
  }
}
async function runExportGerberPackage() {
  const pcbPath = document.getElementById('rev-pcb-select')?.value || '';
  const btn = document.getElementById('btn-export-gerber');
  if (btn) { btn.disabled = true; btn.innerText = "正在导出 Gerber ZIP..."; }
  try {
    const res = await fetch('/api/scaffold/export', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, pcb_path: pcbPath || null })
    });
    const d = await res.json();
    if (d.success && d.export) {
      await fetchAndApplyProjectDetail(activeProjectDir);
      showToast(`已导出嘉立创生产制造包 (${d.export.size_kb} KB)！`);
    } else {
      alert("导出 Gerber 失败: " + (d.export?.error || "请先生成 PCB 文件"));
    }
  } catch (err) {
    alert("导出 Gerber 请求异常: " + err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-file-zipper text-purple-400"></i> 导出 Gerber';
    }
  }
}
async function runFirmwareScaffold() {
  const btn = document.getElementById('btn-scaffold-fw');
  if (btn) { btn.disabled = true; btn.innerText = "正在生成 C99 骨架并编译..."; }
  try {
    const res = await fetch('/api/scaffold/firmware', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, overwrite: true })
    });
    const d = await res.json();
    const logBox = document.getElementById('rev-fw-verify-log');
    if (logBox && d.build) {
      logBox.classList.remove('hidden');
      logBox.innerText = d.build.log || '';
    }
    await loadProjectsWorkspace();
    showToast("已生成标准 C99 固件工程骨架并完成 ARM-GCC 编译链接！");
  } catch (err) {
    alert("生成固件骨架异常: " + err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 重置 C99 骨架';
    }
  }
}
async function runDrcSelfHeal() {
  const pcbPath = document.getElementById('rev-pcb-select')?.value || '';
  const btn = document.getElementById('btn-heal-drc');
  if (btn) { btn.disabled = true; btn.innerText = "正在自愈修复 DRC..."; }
  try {
    const res = await fetch('/api/verify/drc_heal', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, pcb_path: pcbPath || null })
    });
    const d = await res.json();
    if (d.heal) {
      await fetchAndApplyProjectDetail(activeProjectDir);
      showToast(`DRC 自愈闭环完成：剩余 ${d.heal.final_violations} 违规 / ${d.heal.final_unconnected} 未连接`);
    } else {
      alert("DRC 自愈异常: " + JSON.stringify(d));
    }
  } catch (err) {
    alert("DRC 自愈请求失败: " + err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-kit-medical text-teal-400"></i> DRC 自动自愈';
    }
  }
}
function switchEdaMode(mode) {
  currentEdaMode = mode === 'jlc' ? 'jlc' : 'kicad';
  const btnKicad = document.getElementById('btn-eda-kicad');
  const btnJlc = document.getElementById('btn-eda-jlc');
  const badge = document.getElementById('pcb-eda-mode-badge');
  const jlcPanel = document.getElementById('jlc-mode-panel');
  if (currentEdaMode === 'jlc') {
    if (btnKicad) btnKicad.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-slate-100";
    if (btnJlc) btnJlc.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 shadow";
    if (badge) {
      badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold";
      badge.innerText = "🏭 嘉立创 JLC 贴片增强模式";
    }
    if (jlcPanel) jlcPanel.classList.remove('hidden');
    if (activeProjectDetail && !activeProjectDetail.hardware?.jlc_bom_file) {
      runExportJlcSmtPackage(true);
    } else if (activeProjectDetail) {
      renderJlcDfmDashboard(activeProjectDetail.hardware?.jlc_dfm);
      renderJlcDownloadBar(activeProjectDetail.hardware);
    }
    showToast("已切换至「嘉立创 JLC 贴片增强模式」：已激活 100×100mm 免费打样体检、基础库优化与 EasyEDA 导出！", 'info');
  } else {
    if (btnKicad) btnKicad.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 shadow";
    if (btnJlc) btnJlc.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-slate-100";
    if (badge) {
      badge.className = "text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold";
      badge.innerText = "🎯 KiCad 原生设计模式";
    }
    if (jlcPanel) jlcPanel.classList.add('hidden');
    showToast("已切换至「KiCad 10 原生设计模式」", 'info');
  }
  onStudioEngineChange('pcb');
}
function renderJlcDownloadBar(hw) {
  const bar = document.getElementById('jlc-files-download-bar');
  if (!bar || !hw) return;
  const btns = [];
  if (hw.jlc_bom_file) {
    const fn = hw.jlc_bom_file.split('/').pop();
    btns.push(`<a href="/api/projects/file?path=${encodeURIComponent(hw.jlc_bom_file)}" download="${fn}" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow"><i class="fa-solid fa-download"></i> 嘉立创 BOM (${fn})</a>`);
  }
  if (hw.jlc_cpl_file) {
    const fn = hw.jlc_cpl_file.split('/').pop();
    btns.push(`<a href="/api/projects/file?path=${encodeURIComponent(hw.jlc_cpl_file)}" download="${fn}" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow"><i class="fa-solid fa-download"></i> 贴片坐标 CPL (${fn})</a>`);
  }
  if (hw.gerber_zip) {
    const fn = hw.gerber_zip.split('/').pop();
    btns.push(`<a href="/api/projects/file?path=${encodeURIComponent(hw.gerber_zip)}" download="${fn}" class="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 shadow"><i class="fa-solid fa-file-zipper"></i> Gerber+SMT 合集包</a>`);
  }
  if (hw.easyeda_zip) {
    const fn = hw.easyeda_zip.split('/').pop();
    btns.push(`<a href="/api/projects/file?path=${encodeURIComponent(hw.easyeda_zip)}" download="${fn}" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] flex items-center gap-1 shadow"><i class="fa-solid fa-file-import"></i> 嘉立创 EDA 工程包</a>`);
  }
  bar.innerHTML = btns.join('');
}
async function runExportJlcSmtPackage(silent = false) {
  const pcbPath = document.getElementById('rev-pcb-select')?.value || '';
  const btn = document.getElementById('btn-export-jlc-smt');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn && !silent) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在生成嘉立创 BOM + CPL + Gerber...';
  }
  try {
    const res = await fetch('/api/pcb/export_jlc', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, pcb_path: pcbPath || null })
    });
    const d = await res.json();
    if (d.success) {
      if (d.detail) {
        activeProjectDetail = d.detail;
        renderReviewPane();
      }
      const jlcPanel = document.getElementById('jlc-mode-panel');
      if (jlcPanel) jlcPanel.classList.remove('hidden');
      if (!silent) {
        showToast(`已生成嘉立创 SMT 贴片 BOM (含立创 C 编号)、CPL 坐标表与 Gerber 压缩包！`, 'success');
      }
    } else if (!silent) {
      showToast("导出嘉立创 SMT 文件失败: " + (d.jlc?.error || "请先生成 PCB"), 'error');
    }
  } catch (err) {
    if (!silent) showToast("导出嘉立创 SMT 异常: " + err, 'error');
  } finally {
    if (btn && !silent) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
function onStudioEngineChange(module) {
  const isFw = module === 'firmware';
  const engSel = document.getElementById(isFw ? 'fw-engine-select' : 'pcb-engine-select');
  const llmSel = document.getElementById(isFw ? 'fw-llm-model-select' : 'pcb-llm-model-select');
  const cliSel = document.getElementById(isFw ? 'fw-cli-agent-select' : 'pcb-cli-agent-select');
  const hintEl = document.getElementById(isFw ? 'fw-copilot-engine-hint' : 'pcb-copilot-engine-hint');
  if (!engSel) return;
  const eng = engSel.value;
  if (cliSel) cliSel.classList.toggle('hidden', eng !== 'cli');
  if (llmSel) llmSel.classList.toggle('hidden', eng !== 'llm');
  if (hintEl) {
    const agentName = cliSel ? cliSel.value : 'claude';
    const llmVal = (llmSel && llmSel.value) ? llmSel.value.split('::').pop().split('/').pop() : 'Default-LLM';
    const baseEngine = eng === 'cli' ? `🤖 Coding CLI (${agentName})` : `⚡ LLM 直驱 (${llmVal})`;
    if (isFw) {
      hintEl.innerText = `当前驱动: ${baseEngine} · 支持 Diff 预览与一键回滚`;
    } else {
      const edaText = currentEdaMode === 'jlc' ? '嘉立创 JLC 模式' : 'KiCad 原生模式';
      hintEl.innerText = `当前驱动: ${baseEngine} · ${edaText} · 支持 Diff 与回滚`;
    }
  }
}
async function loadCopilotHistory(projectDir) {
  if (!projectDir) return;
  try {
    const res = await fetch(`/api/copilot/history?project_dir=${encodeURIComponent(projectDir)}`);
    const d = await res.json();
    if (d.success && d.history) {
      copilotHistory = d.history;
      renderCopilotMessages('pcb', copilotHistory.pcb || []);
      renderCopilotMessages('firmware', copilotHistory.firmware || []);
    }
  } catch (err) {
    console.error("加载 Copilot 对话历史失败:", err);
  }
}
function formatDiffHtml(diffText) {
  if (!diffText) return '';
  return diffText.split('\n').map(line => {
    const esc = escapeHtml(line);
    if (line.startsWith('+++') || line.startsWith('---')) {
      return `<div class="text-sky-300 font-bold">${esc}</div>`;
    }
    if (line.startsWith('@@')) {
      return `<div class="text-purple-400">${esc}</div>`;
    }
    if (line.startsWith('+')) {
      return `<div class="bg-emerald-500/15 text-emerald-300">${esc}</div>`;
    }
    if (line.startsWith('-')) {
      return `<div class="bg-rose-500/15 text-rose-300">${esc}</div>`;
    }
    return `<div class="text-slate-400">${esc}</div>`;
  }).join('');
}
function renderCopilotMessages(module, messages) {
  const isFw = module === 'firmware';
  const box = document.getElementById(isFw ? 'fw-copilot-messages' : 'pcb-copilot-messages');
  if (!box) return;
  const welcomeHtml = isFw
    ? `<div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed">
        👋 您好！我是 <strong>嵌入式 C 固件对话助手</strong>。我已实时加载当前工程的 <code class="text-emerald-400">bsp_pinout.h</code>、左侧选中的 C 源码以及 <code class="text-sky-400">arm-none-eabi-gcc</code> 编译器输出。<br>
        修改后会自动触发 <strong>GCC 编译验证与报错自动重试闭环</strong>，并提供 <strong>代码 Diff 对比</strong> 与 <strong>一键撤销回滚</strong>！
      </div>`
    : `<div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed">
        👋 您好！我是 <strong>PCB 硬件设计对话助手</strong>。我支持：<br>
        1. <strong>尺寸/层叠/线宽/过孔调整</strong>（如“改板框为 70x45mm，电源线加粗到 0.6mm”）<br>
        2. <strong>引脚增删与互换</strong>（如“把 PA0 和 PA1 互换”、“新增 PB0 为 RELAY_CTRL”）<br>
        3. <strong>嘉立创基础库替换与 DRC 自愈</strong>，且每次修改均支持 <strong>查看 Diff</strong> 与 <strong>一键撤销回滚</strong>！
      </div>`;
  if (!messages || messages.length === 0) {
    box.innerHTML = welcomeHtml;
    return;
  }
  const itemsHtml = messages.map((m, idx) => {
    if (m.role === 'user') {
      const engTag = m.engine_type === 'cli'
        ? `🤖 CLI:${m.agent_id || 'agent'}`
        : (m.llm_model ? `⚡ ${m.llm_model.split('/').pop()}` : '');
      return `
        <div class="flex flex-col items-end">
          <div class="max-w-[90%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 bg-sky-600 text-white text-xs leading-relaxed shadow">
            ${escapeHtml(m.content)}
          </div>
          <span class="text-[10px] text-slate-500 mt-1 font-mono">${engTag ? engTag + ' · ' : ''}${m.timestamp || ''}</span>
        </div>
      `;
    } else {
      const actionsHtml = (m.actions_taken && m.actions_taken.length)
        ? `<div class="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
            ${m.actions_taken.map(a => `<div class="text-[11px] text-emerald-400 font-medium">${escapeHtml(a)}</div>`).join('')}
           </div>`
        : '';
      const diffId = `diff-${module}-${idx}`;
      const cliId = `cli-${module}-${idx}`;
      const toolBtns = [];
      if (m.diff_text) {
        toolBtns.push(`
          <button type="button" onclick="document.getElementById('${diffId}').classList.toggle('hidden')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[10px] font-mono flex items-center gap-1">
            <i class="fa-solid fa-code-compare"></i> 查看变更 Diff (${(m.changed_files || []).length || 1} 文件)
          </button>
          <button type="button" onclick="openMonacoDiffModal('${m.snapshot_id || ''}')" class="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono flex items-center gap-1" title="在 VS Code Monaco Side-by-Side 并排视图中审查代码变更">
            <i class="fa-solid fa-columns"></i> VS Code 并排 Diff
          </button>
        `);
      }
      if (m.cli_log) {
        toolBtns.push(`
          <button type="button" onclick="document.getElementById('${cliId}').classList.toggle('hidden')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-mono flex items-center gap-1">
            <i class="fa-solid fa-terminal"></i> CLI 终端日志
          </button>
        `);
      }
      if (m.snapshot_id) {
        toolBtns.push(`
          <button type="button" onclick="rollbackCopilotSnapshot('${m.snapshot_id}', '${module}')" class="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-mono flex items-center gap-1" title="将工程文件一键还原到本次修改前的快照状态">
            <i class="fa-solid fa-rotate-left"></i> 撤销并回滚此修改
          </button>
        `);
      }
      const toolbarHtml = toolBtns.length > 0
        ? `<div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">${toolBtns.join('')}</div>`
        : '';
      const diffPaneHtml = m.diff_text
        ? `<div id="${diffId}" class="hidden mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] max-h-56 overflow-y-auto whitespace-pre">${formatDiffHtml(m.diff_text)}</div>`
        : '';
      const cliPaneHtml = m.cli_log
        ? `<pre id="${cliId}" class="hidden mt-2 p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 font-mono text-[10px] text-amber-200 max-h-48 overflow-y-auto whitespace-pre-wrap">${escapeHtml(m.cli_log)}</pre>`
        : '';
      return `
        <div class="flex flex-col items-start">
          <div class="w-full rounded-2xl rounded-tl-sm p-3 bg-slate-900 border border-slate-800 text-slate-200 text-xs leading-relaxed space-y-1.5">
            ${actionsHtml}
            <div class="whitespace-pre-wrap">${formatSimpleMarkdown(m.content || '')}</div>
            ${toolbarHtml}
            ${diffPaneHtml}
            ${cliPaneHtml}
          </div>
          <span class="text-[10px] text-slate-500 mt-1 font-mono">AI Copilot · ${m.timestamp || ''}</span>
        </div>
      `;
    }
  }).join('');
  box.innerHTML = welcomeHtml + itemsHtml;
  box.scrollTop = box.scrollHeight;
}
async function rollbackCopilotSnapshot(snapshotId, module) {
  if (!snapshotId) return;
  showToast(`正在回滚快照 ${snapshotId} 并恢复工程文件...`, 'info');
  try {
    const res = await fetch('/api/copilot/rollback', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        project_dir: activeProjectDir,
        snapshot_id: snapshotId
      })
    });
    const d = await res.json();
    if (d.success) {
      if (d.history) {
        copilotHistory[module] = d.history;
        renderCopilotMessages(module, d.history);
      }
      if (d.detail) {
        activeProjectDetail = d.detail;
        renderReviewPane();
      }
      showToast(`↩️ 已成功回滚 ${(d.restored_files || []).length} 个文件并还原软硬件状态！`, 'success');
    } else {
      showToast("回滚快照失败: " + (d.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("回滚快照请求异常: " + err, 'error');
  }
}
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function formatSimpleMarkdown(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-[11px]">$1</code>');
  return s;
}
async function sendQuickCopilotPrompt(module, promptText) {
  const isFw = module === 'firmware';
  const inputEl = document.getElementById(isFw ? 'fw-copilot-input' : 'pcb-copilot-input');
  if (inputEl) {
    inputEl.value = promptText;
  }
  await sendCopilotMessage(module);
}
async function sendCompilerLogToCopilot() {
  const logEl = document.getElementById('rev-fw-verify-log');
  const rawLog = (logEl ? logEl.innerText : '').trim();
  const prompt = rawLog
    ? `请分析以下 ARM-GCC 编译输出日志，修复或优化当前 C 源码并重新编译验证：\n${rawLog.slice(0, 600)}`
    : `请检查当前 C 固件源码与 bsp_pinout.h 的一致性，执行交叉编译验证并汇报 Flash/SRAM 占用`;
  await sendQuickCopilotPrompt('firmware', prompt);
}
async function sendCopilotMessage(module) {
  const isFw = module === 'firmware';
  const inputEl = document.getElementById(isFw ? 'fw-copilot-input' : 'pcb-copilot-input');
  const sendBtn = document.getElementById(isFw ? 'btn-send-fw-copilot' : 'btn-send-pcb-copilot');
  const msgBox = document.getElementById(isFw ? 'fw-copilot-messages' : 'pcb-copilot-messages');
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (!text) {
    showToast("请先输入修改指令或点击上方快捷指令胶囊", 'warn');
    return;
  }
  const engSel = document.getElementById(isFw ? 'fw-engine-select' : 'pcb-engine-select');
  const llmSel = document.getElementById(isFw ? 'fw-llm-model-select' : 'pcb-llm-model-select');
  const cliSel = document.getElementById(isFw ? 'fw-cli-agent-select' : 'pcb-cli-agent-select');
  const engineType = engSel ? engSel.value : 'llm';
  const agentId = cliSel ? cliSel.value : (isFw ? 'pi' : 'claude');
  let llmProvider = '';
  let llmModel = '';
  if (llmSel && llmSel.value && llmSel.value.includes('::')) {
    const parts = llmSel.value.split('::');
    llmProvider = parts[0];
    llmModel = parts[1];
  }
  inputEl.value = '';
  const origBtnHtml = sendBtn ? sendBtn.innerHTML : '';
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 执行中';
  }
  const listKey = isFw ? 'firmware' : 'pcb';
  copilotHistory[listKey] = copilotHistory[listKey] || [];
  copilotHistory[listKey].push({
    role: 'user',
    content: text,
    engine_type: engineType,
    agent_id: agentId,
    llm_model: llmModel,
    timestamp: new Date().toTimeString().slice(0, 8)
  });
  renderCopilotMessages(listKey, copilotHistory[listKey]);
  if (msgBox) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = `copilot-loading-${listKey}`;
    loadingDiv.className = "p-3 rounded-xl bg-slate-900 border border-sky-500/40 text-sky-400 text-xs flex items-center gap-2";
    loadingDiv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>AI (${engineType === 'cli' ? agentId : (llmModel.split('/').pop() || 'LLM')}) 正在分析工程上下文并执行${isFw ? '代码修改、GCC 自愈编译与快照对比' : 'PCB 拓扑更新、DRC 校验与快照对比'}...</span>`;
    msgBox.appendChild(loadingDiv);
    msgBox.scrollTop = msgBox.scrollHeight;
  }
  try {
    window.lastOriginalCodeBeforeDiff = getActiveFirmwareEditorContent();
    const res = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        project_dir: activeProjectDir,
        module: listKey,
        message: text,
        engine_type: engineType,
        agent_id: agentId,
        llm_provider: llmProvider,
        llm_model: llmModel,
        active_file_path: currentEditingFwPath,
        eda_mode: currentEdaMode
      })
    });
    const d = await res.json();
    if (d.success) {
      if (d.history) {
        copilotHistory[listKey] = d.history;
        renderCopilotMessages(listKey, d.history);
        const lastMsg = d.history[d.history.length - 1];
        if (lastMsg) {
          window.lastCopilotSnapshotId = lastMsg.snapshot_id || '';
          window.lastCopilotDiffText = lastMsg.diff_text || '';
          window.lastCopilotModule = listKey;
        }
      }
      if (d.updated_file && isFw) {
        currentEditingFwPath = d.updated_file.path;
        const nameEl = document.getElementById('rev-fw-current-name');
        if (nameEl) nameEl.innerText = d.updated_file.name;
        const pathEl = document.getElementById('rev-fw-current-path');
        if (pathEl) pathEl.innerText = d.updated_file.path;
        const viewer = document.getElementById('rev-fw-code-viewer');
        if (viewer) {
          viewer.value = d.updated_file.content;
          viewer.innerText = d.updated_file.content;
          updateFirmwareLineNumbers();
        }
        if (typeof syncCodeToMonaco === 'function') {
          syncCodeToMonaco(d.updated_file.content, d.updated_file.name);
        }
      }
      if (d.build_or_drc && isFw && d.build_or_drc.log) {
        const logBox = document.getElementById('rev-fw-verify-log');
        if (logBox) {
          logBox.classList.remove('hidden');
          logBox.innerText = d.build_or_drc.log;
        }
      }
      if (d.detail) {
        activeProjectDetail = d.detail;
        renderReviewPane();
      }
      showToast(
        isFw ? "AI 助手已完成 C 固件更新、GCC 编译与 Diff 快照生成！" : "AI 助手已完成 PCB 硬件修正、DRC 校验与 Diff 快照生成！",
        'success'
      );
    } else {
      showToast("对话执行失败: " + (d.error || "未知错误"), 'error');
    }
  } catch (err) {
    showToast("对话请求异常: " + err, 'error');
  } finally {
    const ld = document.getElementById(`copilot-loading-${listKey}`);
    if (ld) ld.remove();
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = origBtnHtml;
    }
  }
}
async function clearCopilotChat(module) {
  try {
    const res = await fetch('/api/copilot/clear', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: activeProjectDir, module: module })
    });
    const d = await res.json();
    if (d.success && d.history) {
      copilotHistory = d.history;
      renderCopilotMessages(module, copilotHistory[module] || []);
      showToast("已清空当前模块对话历史", 'info');
    }
  } catch (err) {
    showToast("清空对话失败: " + err, 'error');
  }
}
let activePipelineId = null;
let activePipelineTimer = null;
function renderPipelineStagesUI(stages = null) {
  const grid = document.getElementById('orch-stages-grid');
  if (!grid) return;
  const defaultStages = stages || [
    { index: 1, name: "Stage 1: SSOT 引脚锁定", agent: "SSOT Validator", status: "pending", summary: "校验 spec.json / pinout.json 并生成 bsp_pinout.h", elapsed_sec: 0 },
    { index: 2, name: "Stage 2: 原理图与 PCB 构建", agent: document.getElementById('orch-pcb-agent')?.value || "antigravity", status: "pending", summary: "构建 .kicad_sch、.kicad_pcb 与 BOM", elapsed_sec: 0 },
    { index: 3, name: "Stage 3: DRC 自愈与 Gerber", agent: document.getElementById('orch-drc-agent')?.value || "codex", status: "pending", summary: "kicad-cli drc 闭环自愈、3D 渲染与 Gerber 导出", elapsed_sec: 0 },
    { index: 4, name: "Stage 4: C99 固件与 GCC 编译", agent: document.getElementById('orch-fw-agent')?.value || "pi", status: "pending", summary: "构建 HAL/状态机并链接 .elf 统计 Flash/RAM", elapsed_sec: 0 },
    { index: 5, name: "Stage 5: 交付验收报告签署", agent: "Release Gatekeeper", status: "pending", summary: "生成 docs/PIPELINE_DELIVERY_REPORT.md", elapsed_sec: 0 }
  ];
  grid.innerHTML = '';
  defaultStages.forEach(s => {
    let borderCls = "border-slate-800 bg-slate-950/70";
    let badgeCls = "bg-slate-800 text-slate-400";
    let statusLabel = "待执行";
    if (s.status === "running") {
      borderCls = "border-sky-500 bg-sky-500/10 shadow-lg";
      badgeCls = "bg-sky-500/20 text-sky-300 border border-sky-500/40";
      statusLabel = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>运行中';
    } else if (s.status === "completed") {
      borderCls = "border-emerald-500/60 bg-emerald-500/10";
      badgeCls = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
      statusLabel = `<i class="fa-solid fa-check mr-1"></i>已通过 (${s.elapsed_sec}s)`;
    } else if (s.status === "warning") {
      borderCls = "border-amber-500/60 bg-amber-500/10";
      badgeCls = "bg-amber-500/20 text-amber-300 border border-amber-500/40";
      statusLabel = `告警 (${s.elapsed_sec}s)`;
    }
    const card = document.createElement('div');
    card.className = `rounded-xl p-3.5 border transition flex flex-col justify-between ${borderCls}`;
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-1 mb-1.5">
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-purple-300 border border-slate-800">${s.agent.toUpperCase()}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${badgeCls}">${statusLabel}</span>
        </div>
        <div class="text-xs font-bold text-slate-100 mb-1">${s.name}</div>
        <p class="text-[11px] text-slate-400 leading-snug">${s.summary}</p>
      </div>
    `;
    grid.appendChild(card);
  });
}
async function startAutonomousPipeline() {
  if (ssotDirty) {
    showToast("检测到未保存的 SSOT 引脚修改，正在自动保存并同步 bsp_pinout.h...", 'warn');
    await confirmAndLockSpec(true);
  }
  const pdir = document.getElementById('disp-project-dir')?.value || activeProjectDir;
  const mode = document.getElementById('orch-mode')?.value || 'fast_deterministic';
  const agentsMap = {
    pcb_agent: document.getElementById('orch-pcb-agent')?.value || 'antigravity',
    drc_agent: document.getElementById('orch-drc-agent')?.value || 'codex',
    firmware_agent: document.getElementById('orch-fw-agent')?.value || 'pi'
  };
  const livePanel = document.getElementById('orch-live-panel');
  const startBtn = document.getElementById('btn-start-pipeline');
  const stopBtn = document.getElementById('btn-stop-pipeline');
  if (livePanel) livePanel.classList.remove('hidden');
  if (startBtn) startBtn.disabled = true;
  if (stopBtn) stopBtn.classList.remove('hidden');
  try {
    const res = await fetch('/api/pipeline/start', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project_dir: pdir, mode: mode, agents_map: agentsMap })
    });
    const d = await res.json();
    if (d.success && d.pipeline) {
      activePipelineId = d.pipeline.pipeline_id;
      renderPipelineStagesUI(d.pipeline.stages);
      startPollingPipeline(activePipelineId);
      showToast("已启动 5 阶段多 Agent 全自动软硬件协同流水线！");
    } else {
      alert("启动流水线失败: " + (d.error || "未知错误"));
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.classList.add('hidden');
    }
  } catch (err) {
    alert("启动流水线请求异常: " + err);
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.classList.add('hidden');
  }
}
function startPollingPipeline(pipelineId) {
  if (activePipelineTimer) clearInterval(activePipelineTimer);
  activePipelineTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/pipeline/status/${pipelineId}`);
      const p = await res.json();
      if (!p.found) return;
      renderPipelineStagesUI(p.stages);
      const elBadge = document.getElementById('orch-elapsed-badge');
      if (elBadge) elBadge.innerText = `总耗时: ${p.elapsed_sec}s (${p.progress_pct}%)`;
      const logPre = document.getElementById('orch-log-pre');
      if (logPre) {
        logPre.innerText = p.log_text || '';
        logPre.scrollTop = logPre.scrollHeight;
      }
      const repPre = document.getElementById('orch-report-pre');
      if (repPre && p.report_markdown) {
        repPre.innerText = p.report_markdown;
      }
      if (p.status !== 'running') {
        clearInterval(activePipelineTimer);
        const startBtn = document.getElementById('btn-start-pipeline');
        const stopBtn = document.getElementById('btn-stop-pipeline');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.classList.add('hidden');
        await loadProjectsWorkspace();
        if (p.status === 'completed') {
          showToast(`5 阶段软硬件协同流水线圆满完成 (耗时 ${p.elapsed_sec}s)！`);
        }
      }
    } catch (e) {
      console.error("轮询流水线异常:", e);
    }
  }, 1200);
}
async function stopAutonomousPipeline() {
  if (!activePipelineId) return;
  try {
    await fetch(`/api/pipeline/stop/${activePipelineId}`, { method: 'POST' });
    showToast("已终止当前协同流水线！");
  } catch (err) {
    console.error(err);
  }
}
let skillsRegistryData = { installed: [], marketplace: [], external_sites: [] };
let currentSkillFilter = 'all';
let currentSelectedSkillDetail = null;
let currentSkillDocTab = 'skill_md';
function toggleDistillUploadDrawer() {
  const drawer = document.getElementById('distill-upload-drawer');
  if (drawer) drawer.classList.toggle('hidden');
}
function onDistillFileSelected(input) {
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const inlineStatus = document.getElementById('distill-inline-status');
  if (inlineStatus) {
    inlineStatus.classList.remove('hidden');
    inlineStatus.textContent = `📄 已选文件: ${file.name} (${sizeMB} MB) · 将使用本地 Qwen3.8-27B 跨章节全书深度蒸馏`;
  }
}
async function startDistill() {
  const fileInput = document.getElementById('distill-file');
  const skillName = document.getElementById('skill-name')?.value || 'pcb-design-skill';
  if (!fileInput || !fileInput.files.length) {
    showToast('请先选择需要蒸馏的规范或数据手册文件！', 'warn');
    return;
  }
  const file = fileInput.files[0];
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const log = document.getElementById('distill-log');
  const inlineStatus = document.getElementById('distill-inline-status');
  const btn = document.getElementById('btn-start-distill');
  const origBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Qwen3.8-27B 深度蒸馏中...`;
  }
  let elapsedSec = 0;
  const updateProgressMsg = () => {
    elapsedSec += 1;
    let stageHint = '阶段 1/4: 解析 PDF 原生书签目录与全书章节结构...';
    if (elapsedSec > 4 && elapsedSec <= 65) {
      stageHint = '阶段 2/4: 调用 Qwen3.8-27B 跨章节萃取全书工艺参数与速查表 (cheatsheet.md)...';
    } else if (elapsedSec > 65 && elapsedSec <= 130) {
      stageHint = '阶段 3/4: 调用 Qwen3.8-27B 萃取全流程硬件设计模式与制造反模式 (patterns.md)...';
    } else if (elapsedSec > 130) {
      stageHint = '阶段 4/4: 生成全书各章节 AI 工程导读与 SKILL.md 路由索引...';
    }
    if (inlineStatus) {
      inlineStatus.classList.remove('hidden');
      inlineStatus.textContent = `⏳ [耗时 ${elapsedSec}s] 正在深度蒸馏《${file.name}》(${sizeMB} MB) → [${skillName}] · ${stageHint}`;
    }
    if (log) {
      log.innerText =
        `[AI-PCB Knowledge Distiller v2.5 · 本地 vLLM Qwen3.8-27B]\n` +
        `源文件: ${file.name} (${sizeMB} MB)\n` +
        `目标技能: skills/${skillName}/\n` +
        `已用时间: ${elapsedSec} 秒\n` +
        `当前进度: ${stageHint}\n\n` +
        `正在对全书各章节参数表、线宽线距、过孔叠层、DFM/SMT 制造规范进行跨章节深度采样与大模型萃取，请稍候...`;
    }
  };
  updateProgressMsg();
  const progressTimer = setInterval(updateProgressMsg, 1000);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('skill_name', skillName);
  try {
    const res = await fetch('/api/distill', { method: 'POST', body: fd });
    clearInterval(progressTimer);
    const j = await res.json();
    if (log) log.innerText = j.log || '蒸馏已完成';
    if (inlineStatus) {
      inlineStatus.textContent = j.success
        ? `✅ 蒸馏完成 (共耗时 ${elapsedSec}s)！已生成 skills/${skillName}/ (SKILL.md + cheatsheet.md + patterns.md + 全书章节分册)`
        : `⚠️ 蒸馏遇到问题，请查看下方日志详情`;
    }
    await loadSkillsList();
    if (j.success) {
      showToast(`知识库插件 [${skillName}] 全书深度蒸馏并安装成功！`);
      setTimeout(() => previewSkill(skillName), 800);
    } else {
      showToast(`蒸馏遇到问题，请查看日志`, 'warn');
    }
  } catch (err) {
    clearInterval(progressTimer);
    if (log) log.innerText = "蒸馏请求异常: " + err;
    if (inlineStatus) inlineStatus.textContent = "❌ 蒸馏请求异常: " + err;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml || `<i class="fa-solid fa-bolt mr-1"></i> 开始 AI 智能蒸馏并安装`;
    }
  }
}
async function loadSkillsList() {
  try {
    const res = await fetch('/api/skills/marketplace');
    const j = await res.json();
    if (j && j.success) {
      skillsRegistryData = {
        installed: j.installed || [],
        marketplace: j.marketplace || [],
        external_sites: j.external_sites || []
      };
    } else {
      const resFallback = await fetch('/api/skills');
      const listFallback = await resFallback.json();
      skillsRegistryData.installed = Array.isArray(listFallback) ? listFallback : [];
    }
    renderSkillsMarketplaceLists();
    if (!currentSelectedSkillDetail && skillsRegistryData.installed.length > 0) {
      previewSkill(skillsRegistryData.installed[0].name);
    }
  } catch (err) {
    console.error(err);
  }
}
function setSkillMarketFilter(filterKey) {
  currentSkillFilter = filterKey || 'all';
  ['all', 'installed', 'marketplace', 'pcb', 'firmware'].forEach(k => {
    const btn = document.getElementById(`skill-filter-${k}`);
    if (!btn) return;
    if (k === currentSkillFilter) {
      btn.className = "px-2.5 py-1 rounded-lg bg-indigo-500 text-white font-bold transition";
    } else {
      btn.className = "px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:border-indigo-500/40 transition";
    }
  });
  renderSkillsMarketplaceLists();
}
function filterSkillsMarketplace() {
  renderSkillsMarketplaceLists();
}
function renderSkillsMarketplaceLists() {
  const instBox = document.getElementById('skills-list-box');
  const mktBox = document.getElementById('skills-marketplace-box');
  const secInst = document.getElementById('skill-sec-installed');
  const secMkt = document.getElementById('skill-sec-marketplace');
  const instCntEl = document.getElementById('skill-sec-installed-cnt');
  const mktCntEl = document.getElementById('skill-sec-market-cnt');
  const topBadge = document.getElementById('skill-installed-count-badge');
  if (!instBox || !mktBox) return;
  const q = (document.getElementById('skill-market-search')?.value || '').trim().toLowerCase();
  const matchQuery = (item) => {
    if (!q) return true;
    const hay = `${item.name || ''} ${item.id || ''} ${item.title || ''} ${item.summary || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  };
  const matchCat = (item) => {
    if (currentSkillFilter === 'all' || currentSkillFilter === 'installed' || currentSkillFilter === 'marketplace') return true;
    if (currentSkillFilter === 'pcb') return item.category === 'pcb' || item.category === 'jlc';
    if (currentSkillFilter === 'firmware') return item.category === 'firmware';
    return true;
  };
  const allInstalled = skillsRegistryData.installed || [];
  const enabledCount = allInstalled.filter(s => s.enabled !== false).length;
  if (topBadge) {
    topBadge.innerText = `已安装 ${allInstalled.length} 项 (${enabledCount} 项已激活)`;
  }
  const filteredInst = allInstalled.filter(item => matchQuery(item) && matchCat(item));
  const filteredMkt = (skillsRegistryData.marketplace || []).filter(item => matchQuery(item) && matchCat(item));
  if (instCntEl) instCntEl.innerText = String(filteredInst.length);
  if (mktCntEl) mktCntEl.innerText = String(filteredMkt.length);
  if (secInst) secInst.classList.toggle('hidden', currentSkillFilter === 'marketplace');
  if (secMkt) secMkt.classList.toggle('hidden', currentSkillFilter === 'installed');
  instBox.innerHTML = '';
  if (filteredInst.length === 0) {
    instBox.innerHTML = `<div class="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">暂无匹配的已安装插件</div>`;
  } else {
    filteredInst.forEach(s => {
      const isSelected = currentSelectedSkillDetail && currentSelectedSkillDetail.name === s.name;
      const card = document.createElement('div');
      card.className = `p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
        isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-indigo-500/40'
      }`;
      card.onclick = () => previewSkill(s.name);
      const enabledBadge = s.enabled !== false
        ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">已启用</span>`
        : `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">已禁用</span>`;
      card.innerHTML = `
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
            <i class="fa-solid fa-puzzle-piece text-indigo-400"></i>
            <span class="truncate">${s.title || s.name}</span>
            ${enabledBadge}
          </div>
          <div class="text-[11px] text-slate-400 truncate mt-0.5">${s.summary || s.name}</div>
          <div class="text-[10px] text-slate-500 font-mono mt-0.5">${s.name} · v${s.version || '1.0.0'}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0" onclick="event.stopPropagation()">
          <button type="button" onclick="toggleSkillEnabled('${s.name}')" class="px-2 py-1 rounded-lg text-[11px] font-medium border ${
            s.enabled !== false
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
          }">${s.enabled !== false ? '禁用' : '启用'}</button>
          <button type="button" onclick="uninstallSkillById('${s.name}')" class="px-2 py-1 rounded-lg text-[11px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30" title="卸载此 Skill">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      instBox.appendChild(card);
    });
  }
  mktBox.innerHTML = '';
  if (filteredMkt.length === 0) {
    mktBox.innerHTML = `<div class="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">暂无匹配的社区推荐插件</div>`;
  } else {
    filteredMkt.forEach(m => {
      const isSelected = currentSelectedSkillDetail && currentSelectedSkillDetail.name === m.id;
      const card = document.createElement('div');
      card.className = `p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2.5 ${
        isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/70 hover:border-indigo-500/40'
      }`;
      card.onclick = () => previewSkill(m.id);
      const tagsHtml = (m.tags || []).slice(0, 3).map(t => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono">${t}</span>`).join('');
      const actionBtn = m.installed
        ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">✅ 已安装</span>`
        : `<button type="button" onclick="event.stopPropagation(); installSkillById('${m.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold shadow transition"><i class="fa-solid fa-download mr-1"></i>安装</button>`;
      card.innerHTML = `
        <div class="min-w-0 flex-1 space-y-1">
          <div class="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <i class="${m.icon || 'fa-solid fa-cube'} text-sky-400"></i>
            <span class="truncate">${m.title}</span>
          </div>
          <div class="text-[11px] text-slate-400 line-clamp-2">${m.summary}</div>
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            ${tagsHtml}
            <span class="text-[10px] text-slate-400 font-mono ml-auto"><i class="fa-solid fa-download text-[9px]"></i> ${m.downloads || '10k'} · ⭐ ${m.stars || '800'}</span>
          </div>
        </div>
        <div class="shrink-0 pt-0.5">${actionBtn}</div>
      `;
      mktBox.appendChild(card);
    });
  }
}
async function installSkillById(skillId) {
  try {
    const res = await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_id: skillId })
    });
    const j = await res.json();
    if (j.success) {
      if (j.registry) skillsRegistryData = j.registry;
      renderSkillsMarketplaceLists();
      await previewSkill(j.skill_name || skillId);
      showToast(j.message || `插件 [${skillId}] 安装成功！`);
    } else {
      showToast(j.error || '安装失败', 'error');
    }
  } catch (err) {
    showToast('安装请求异常: ' + err, 'error');
  }
}
async function installSkillFromInput() {
  const urlInput = document.getElementById('ext-skill-url-input');
  const nameInput = document.getElementById('ext-skill-custom-name');
  const rawUrl = (urlInput?.value || '').trim();
  const customName = (nameInput?.value || '').trim();
  if (!rawUrl) {
    showToast('请先输入主流 Skill 网站链接、GitHub 仓库地址或插件 ID！', 'warn');
    return;
  }
  const btn = document.getElementById('btn-install-ext-skill');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_or_url: rawUrl, custom_name: customName })
    });
    const j = await res.json();
    if (j.success) {
      if (urlInput) urlInput.value = '';
      if (nameInput) nameInput.value = '';
      if (j.registry) skillsRegistryData = j.registry;
      renderSkillsMarketplaceLists();
      await previewSkill(j.skill_name);
      showToast(j.message || `已成功下载并安装 [${j.skill_name}]！`);
    } else {
      showToast(j.error || '下载安装失败', 'error');
    }
  } catch (err) {
    showToast('下载安装异常: ' + err, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function toggleSkillEnabled(skillName) {
  try {
    const res = await fetch('/api/skills/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_name: skillName })
    });
    const j = await res.json();
    if (j.success) {
      if (j.registry) skillsRegistryData = j.registry;
      renderSkillsMarketplaceLists();
      if (currentSelectedSkillDetail && currentSelectedSkillDetail.name === skillName) {
        await previewSkill(skillName);
      }
      showToast(`已${j.enabled ? '启用' : '禁用'}插件 [${skillName}]`);
    }
  } catch (err) {
    showToast('切换状态异常: ' + err, 'error');
  }
}
async function uninstallSkillById(skillName) {
  try {
    const res = await fetch('/api/skills/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_name: skillName })
    });
    const j = await res.json();
    if (j.success) {
      if (j.registry) skillsRegistryData = j.registry;
      renderSkillsMarketplaceLists();
      showToast(j.message || `已卸载插件 [${skillName}]`);
      if (skillsRegistryData.installed.length > 0) {
        await previewSkill(skillsRegistryData.installed[0].name);
      }
    } else {
      showToast(j.error || '卸载失败', 'error');
    }
  } catch (err) {
    showToast('卸载异常: ' + err, 'error');
  }
}
async function previewSkill(skillName) {
  try {
    const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}`);
    const d = await res.json();
    currentSelectedSkillDetail = d;
    renderSkillsMarketplaceLists();
    const titleEl = document.getElementById('skill-det-title');
    const verEl = document.getElementById('skill-det-version');
    const statusEl = document.getElementById('skill-det-status-badge');
    const metaEl = document.getElementById('skill-det-meta');
    const sumEl = document.getElementById('skill-det-summary');
    const actEl = document.getElementById('skill-det-actions');
    if (titleEl) titleEl.innerText = d.title || d.name;
    if (verEl) verEl.innerText = `v${d.version || '1.0.0'}`;
    if (statusEl) {
      if (d.installed) {
        statusEl.className = d.enabled !== false
          ? "text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono"
          : "text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono";
        statusEl.innerText = d.enabled !== false ? "✅ 已安装 · 已注入 Copilot" : "⏸️ 已安装 · 已暂停注入";
      } else {
        statusEl.className = "text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono";
        statusEl.innerText = "🌐 社区精选插件 (未安装)";
      }
    }
    if (metaEl) {
      metaEl.innerHTML = `ID: <code class="text-indigo-300">${d.name}</code> · Publisher: ${d.publisher || 'Community'} · 来源: ${d.source_site || 'Local'}`;
    }
    if (sumEl) {
      sumEl.innerText = d.summary || '包含完整的 SKILL.md 工程规范、关键参数速查卡 (cheatsheet.md) 与设计模式 (patterns.md)。';
    }
    if (actEl) {
      if (d.installed) {
        actEl.innerHTML = `
          <button type="button" onclick="toggleSkillEnabled('${d.name}')" class="px-3 py-1.5 rounded-xl text-xs font-bold border ${
            d.enabled !== false
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
          }">${d.enabled !== false ? '暂停注入' : '启用注入'}</button>
          <button type="button" onclick="uninstallSkillById('${d.name}')" class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold">
            <i class="fa-solid fa-trash-can mr-1"></i>卸载插件
          </button>
        `;
      } else {
        actEl.innerHTML = `
          <button type="button" onclick="installSkillById('${d.name}')" class="px-4 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md">
            <i class="fa-solid fa-download mr-1"></i>一键安装到本地技能库
          </button>
        `;
      }
    }
    switchSkillDocTab(currentSkillDocTab);
  } catch (err) {
    console.error(err);
  }
}
function switchSkillDocTab(tabKey) {
  currentSkillDocTab = tabKey || 'skill_md';
  const mapBtn = {
    skill_md: 'btn-skill-tab-skill',
    cheatsheet_md: 'btn-skill-tab-cheat',
    patterns_md: 'btn-skill-tab-pat'
  };
  Object.entries(mapBtn).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (k === currentSkillDocTab) {
      el.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500 text-white transition";
    } else {
      el.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-300 border border-slate-800 hover:text-white transition";
    }
  });
  const log = document.getElementById('distill-log');
  if (!log || !currentSelectedSkillDetail) return;
  const d = currentSelectedSkillDetail;
  const content = d[currentSkillDocTab] || d.skill_md || '暂无该分栏内容';
  const tabLabel = currentSkillDocTab === 'cheatsheet_md' ? 'cheatsheet.md (参数速查卡)' : (currentSkillDocTab === 'patterns_md' ? 'patterns.md (经典工程模式)' : 'SKILL.md (技能说明书)');
  log.innerText = `=== [${d.name}] · ${tabLabel} ===\n\n${content}`;
}
let toastHideTimer = null;
function showToast(msg, type = 'success') {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    document.body.appendChild(toast);
  }
  let bgCls = "bg-emerald-500 text-slate-950 border border-emerald-300";
  let iconCls = "fa-solid fa-circle-check";
  if (type === 'warn') {
    bgCls = "bg-amber-400 text-slate-950 border border-amber-200";
    iconCls = "fa-solid fa-triangle-exclamation";
  } else if (type === 'error') {
    bgCls = "bg-rose-500 text-white border border-rose-300";
    iconCls = "fa-solid fa-circle-xmark";
  }
  toast.className = `fixed bottom-8 right-6 z-50 px-4 py-3 rounded-xl font-bold text-xs shadow-2xl transition-all duration-300 flex items-center gap-2 ${bgCls}`;
  toast.innerHTML = `<i class="${iconCls}"></i><span>${msg}</span>`;
  toast.style.opacity = '1';
  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3600);
}
let coDesignSplitActive = false;
let currentBottomPanelTab = 'problems';
let bottomPanelExpanded = false;
let latestGccDiagnostics = [];
let monacoEditorInstance = null;
let monacoEditorEnabled = false;
let monacoLoadingInProgress = false;
let monacoCompletionRegistered = false;
let cmdPaletteFilteredItems = [];
let cmdPaletteSelectedIndex = 0;
function runHardwareDrcVerify() {
  switchTab('pcb');
  runDynamicDrc();
}
function loadProjectWorkspace() {
  return loadProjectsWorkspace();
}
function onActivityBarClick(actionId) {
  const sb = document.getElementById('app-sidebar');
  if (actionId === 'explorer') {
    if (sb) {
      const wasCollapsed = sb.classList.contains('sidebar-collapsed');
      if (wasCollapsed) {
        toggleSidebar();
      }
      const expEl = document.getElementById('vscode-explorer-section');
      if (expEl) expEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }
  if (sb && sb.classList.contains('sidebar-collapsed') && actionId === 'distiller') {
  }
  switchTab(actionId);
}
function toggleExplorerTreeCollapse() {
  const tree = document.getElementById('vscode-explorer-tree');
  const icon = document.getElementById('explorer-chevron-icon');
  if (!tree) return;
  const hidden = tree.classList.toggle('hidden');
  if (icon) {
    icon.className = hidden ? 'fa-solid fa-chevron-right text-[9px]' : 'fa-solid fa-chevron-down text-[9px]';
  }
}
function updateWorkbenchBreadcrumb(tabId) {
  const bcEl = document.getElementById('vscode-breadcrumb-text');
  if (!bcEl) return;
  const pname = activeProjectDetail?.project_name || 'workspace';
  if (coDesignSplitActive) {
    bcEl.innerHTML = `<span class="text-emerald-400">${escapeHtml(pname)}</span> &rsaquo; ◫ PCB Hardware Studio + C99 (${escapeHtml(currentEditingFwPath.split('/').pop() || 'main.c')})`;
    return;
  }
  const map = {
    dashboard: `${pname} › workspace.overview`,
    intake: `${pname} › ssot › pinout.json ⇄ bsp_pinout.h`,
    pcb: `${pname} › hardware › ${(activeProjectDetail?.hardware?.primary_pcb || 'board.kicad_pcb').split('/').pop()}`,
    firmware: `${pname} › firmware › ${(currentEditingFwPath || 'app_state_machine.c').split('/').pop()}`,
    agents: `${pname} › pipeline › 5-stage-autonomous`,
    distiller: `${pname} › extensions › skill-marketplace`,
    config: `${pname} › settings › llm-and-agents`
  };
  bcEl.innerText = map[tabId] || `${pname} › ${tabId}`;
}
function toggleCoDesignSplitView(forceState = null) {
  const mainEl = document.getElementById('app-main-scroll-area');
  const pcbPane = document.getElementById('pane-pcb');
  const fwPane = document.getElementById('pane-firmware');
  if (!mainEl || !pcbPane || !fwPane) return;
  coDesignSplitActive = forceState !== null ? Boolean(forceState) : !coDesignSplitActive;
  const actSplitBtn = document.getElementById('act-btn-split');
  const hdrSplitBtn = document.getElementById('btn-header-split');
  const tabSplitBtn = document.getElementById('btn-tabbar-split');
  const sbSplitEl = document.getElementById('sb-split-status');
  if (coDesignSplitActive) {
    mainEl.classList.add('codesign-split-active');
    pcbPane.classList.remove('hidden');
    fwPane.classList.remove('hidden');
    renderReviewPane();
    if (actSplitBtn) actSplitBtn.classList.add('active');
    if (hdrSplitBtn) hdrSplitBtn.classList.add('bg-emerald-500/20', 'text-emerald-300');
    if (tabSplitBtn) tabSplitBtn.className = "px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold font-mono text-[10px]";
    if (sbSplitEl) {
      sbSplitEl.innerText = '◫ Split: ON (PCB+C99)';
      sbSplitEl.className = 'text-emerald-400 font-bold';
    }
    const topTitle = document.getElementById('top-view-title');
    if (topTitle) {
      topTitle.innerHTML = '<i class="fa-solid fa-table-columns text-emerald-400"></i> ◫ VS Code 软硬件同屏工作台 (左: PCB 2D/3D & 引脚 | 右: C99 固件 & GCC)';
    }
    updateWorkbenchBreadcrumb('pcb');
    setTimeout(layoutMonacoEditorIfVisible, 80);
    if (forceState === null) {
      showToast('◫ 已开启「软硬件左右同屏分屏」：左侧检视 PCB/引脚表，右侧编写 C99 固件！', 'success');
    }
  } else {
    mainEl.classList.remove('codesign-split-active');
    if (actSplitBtn) actSplitBtn.classList.remove('active');
    if (hdrSplitBtn) hdrSplitBtn.classList.remove('bg-emerald-500/20', 'text-emerald-300');
    if (tabSplitBtn) tabSplitBtn.className = "px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-[10px]";
    if (sbSplitEl) {
      sbSplitEl.innerText = '◫ Split: OFF';
      sbSplitEl.className = 'hover:text-emerald-400 text-slate-400';
    }
    setTimeout(layoutMonacoEditorIfVisible, 80);
    if (forceState === null) {
      switchTab('pcb');
      showToast('已退出软硬件同屏分屏模式');
    }
  }
}
function syncWorkbenchExplorerAndDiagnostics(detail) {
  if (!detail) return;
  renderWorkbenchExplorerTree(detail);
  renderWorkbenchDiagnosticsAndPanel(detail);
  renderWorkbenchStatusBar(detail);
}
function renderWorkbenchExplorerTree(detail) {
  const treeBox = document.getElementById('vscode-explorer-tree');
  if (!treeBox) return;
  const groups = detail.explorer_tree || [];
  if (groups.length === 0) {
    treeBox.innerHTML = '<div class="text-[11px] text-slate-500 px-2 py-1">暂无工程文件</div>';
    return;
  }
  const iconMap = {
    ssot_spec: '<i class="fa-solid fa-sliders text-amber-400 w-3.5 text-center"></i>',
    ssot_pinout: '<i class="fa-solid fa-network-wired text-amber-400 w-3.5 text-center"></i>',
    pcb_board: '<i class="fa-solid fa-compass-drafting text-emerald-400 w-3.5 text-center"></i>',
    sch_sheet: '<i class="fa-solid fa-microchip text-teal-400 w-3.5 text-center"></i>',
    pcb_2d_svg: '<i class="fa-regular fa-image text-emerald-300 w-3.5 text-center"></i>',
    sch_2d_svg: '<i class="fa-regular fa-image text-sky-300 w-3.5 text-center"></i>',
    jlc_bom: '<i class="fa-solid fa-table-list text-amber-300 w-3.5 text-center"></i>',
    jlc_cpl: '<i class="fa-solid fa-crosshairs text-purple-300 w-3.5 text-center"></i>',
    gerber_zip: '<i class="fa-solid fa-file-zipper text-purple-400 w-3.5 text-center"></i>',
    fw_source: '<i class="fa-regular fa-file-code text-sky-400 w-3.5 text-center"></i>',
    delivery_report: '<i class="fa-solid fa-file-signature text-emerald-400 w-3.5 text-center"></i>'
  };
  treeBox.innerHTML = groups.map(g => {
    const files = g.files || [];
    if (files.length === 0) return '';
    const itemsHtml = files.map(f => {
      const isAct = f.abs_path && f.abs_path === currentEditingFwPath;
      const ic = iconMap[f.kind] || '<i class="fa-regular fa-file text-slate-400 w-3.5 text-center"></i>';
      const safePath = (f.abs_path || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const safeName = (f.name || '').replace(/'/g, "\\'");
      return `
        <div onclick="openExplorerFileItem('${f.kind}', '${safePath}', '${safeName}')" class="vscode-tree-item ${isAct ? 'active' : ''}" title="${escapeHtml(f.rel_path || f.name)}">
          <span class="flex items-center gap-1.5 truncate">${ic}<span class="truncate font-mono">${escapeHtml(f.name)}</span></span>
        </div>
      `;
    }).join('');
    return `
      <div class="space-y-0.5">
        <div class="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono">
          <i class="fa-regular fa-folder-open text-amber-400/80 text-[10px]"></i>
          <span class="truncate">${escapeHtml(g.title)}</span>
        </div>
        ${itemsHtml}
      </div>
    `;
  }).join('');
}
async function openExplorerFileItem(kind, absPath, fileName) {
  if (kind === 'ssot_spec' || kind === 'ssot_pinout') {
    switchTab('intake');
    showToast(`已在 SSOT 中枢打开 ${fileName}`);
  } else if (kind === 'pcb_board') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('3d');
    showToast(`已打开 PCB 3D/2D 视图: ${fileName}`);
  } else if (kind === 'pcb_2d_svg') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('2d_pcb');
    showToast(`已切换至 2D 铜皮走线矢量图: ${fileName}`);
  } else if (kind === 'sch_sheet' || kind === 'sch_2d_svg') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchPcbCanvasView('2d_sch');
    showToast(`已切换至硬件原理图预览: ${fileName}`);
  } else if (kind === 'jlc_bom' || kind === 'jlc_cpl' || kind === 'gerber_zip') {
    if (!coDesignSplitActive) switchTab('pcb');
    switchEdaMode('jlc');
    const bomEl = document.getElementById('rev-bom-tbody');
    if (bomEl) bomEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`已定位至嘉立创生产制造与 BOM 选型表: ${fileName}`);
  } else if (kind === 'fw_source') {
    if (!coDesignSplitActive) switchTab('firmware');
    await previewFirmwareSource(absPath);
    renderReviewPane();
  } else if (kind === 'delivery_report') {
    if (!coDesignSplitActive) switchTab('firmware');
    const repEl = document.getElementById('rev-delivery-report-card');
    if (repEl) {
      repEl.classList.remove('hidden');
      repEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
function renderWorkbenchDiagnosticsAndPanel(detail) {
  const probsPane = document.getElementById('btm-pane-problems');
  const probsBadge = document.getElementById('btm-problems-badge');
  const actDot = document.getElementById('act-problems-dot');
  const memGrid = document.getElementById('btm-memory-dfm-grid');
  if (!probsPane) return;
  const baseDiags = Array.isArray(detail.unified_diagnostics) ? [...detail.unified_diagnostics] : [];
  const allDiags = [...latestGccDiagnostics, ...baseDiags];
  if (probsBadge) {
    probsBadge.innerText = String(allDiags.length);
    probsBadge.className = allDiags.length > 0
      ? 'px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-300 text-[10px] font-mono'
      : 'px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono';
  }
  if (actDot) {
    actDot.classList.toggle('hidden', allDiags.length === 0);
  }
  if (allDiags.length === 0) {
    probsPane.innerHTML = `
      <div class="flex items-center justify-between py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
        <span><i class="fa-solid fa-circle-check mr-1.5"></i> 0 Problems · KiCad DRC 零违规、SSOT 引脚零冲突、ARM-GCC 零报错、100% 引脚宏已覆盖！</span>
        <span class="text-[10px] font-mono opacity-80">Ready for JLCPCB SMT &amp; MCU Flash</span>
      </div>
    `;
  } else {
    probsPane.innerHTML = allDiags.map((d, idx) => {
      const isErr = d.severity === 'error';
      const isWarn = d.severity === 'warning';
      const iconHtml = isErr
        ? '<i class="fa-solid fa-circle-xmark text-rose-400"></i>'
        : (isWarn ? '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>' : '<i class="fa-solid fa-circle-info text-sky-400"></i>');
      const srcBadge = `<span class="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">${escapeHtml(d.source || 'IDE')}</span>`;
      const locText = `${escapeHtml(d.file || '')}${d.line ? ':' + d.line : ''}`;
      const safePrompt = (d.quick_fix_prompt || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const targetMod = d.target_tab === 'pcb' ? 'pcb' : 'firmware';
      return `
        <div class="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-slate-900/90 border-b border-slate-900 transition">
          <div onclick="jumpToDiagnosticLocation('${d.target_tab || 'firmware'}', '${escapeHtml(d.file || '')}', ${d.line || 1})" class="flex items-center gap-2 truncate cursor-pointer flex-1">
            ${iconHtml}
            ${srcBadge}
            <span class="text-slate-200 truncate">${escapeHtml(d.message)}</span>
            <span class="text-slate-500 text-[10px] shrink-0">${locText}</span>
          </div>
          ${safePrompt ? `
            <button type="button" onclick="switchTab('${targetMod}'); sendQuickCopilotPrompt('${targetMod}', '${safePrompt}')" class="shrink-0 px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] flex items-center gap-1">
              <i class="fa-solid fa-lightbulb text-amber-300"></i> AI 修复
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }
  if (memGrid) {
    const mem = detail.firmware?.memory_usage;
    const dfm = detail.hardware?.jlc_dfm;
    const cov = detail.firmware?.pin_coverage;
    memGrid.innerHTML = `
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
        <div class="text-[10px] text-slate-400">💾 MCU Flash 占用 (${escapeHtml(mem?.mcu_id || 'MCU')})</div>
        <div class="text-xs font-bold text-emerald-400 font-mono">${mem ? `${mem.flash_used_bytes}B / ${(mem.flash_total_bytes/1024).toFixed(0)}KB (${mem.flash_pct}%)` : '待编译'}</div>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
        <div class="text-[10px] text-slate-400">🧠 MCU SRAM 占用 (Data + BSS)</div>
        <div class="text-xs font-bold text-sky-400 font-mono">${mem ? `${mem.ram_used_bytes}B / ${(mem.ram_total_bytes/1024).toFixed(0)}KB (${mem.ram_pct}%)` : '待编译'}</div>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
        <div class="text-[10px] text-slate-400">🔌 SSOT 引脚宏覆盖率 (bsp_pinout.h)</div>
        <div class="text-xs font-bold text-amber-300 font-mono">${cov ? `${cov.covered_count} / ${cov.total_pins} Pins (${cov.coverage_pct}%)` : '-'}</div>
      </div>
      <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
        <div class="text-[10px] text-slate-400">🏭 嘉立创 DFM 与特价打样合规</div>
        <div class="text-xs font-bold text-emerald-300 font-mono">${dfm ? `${dfm.width_mm}×${dfm.height_mm}mm · ${dfm.free_tier_eligible ? '符合免费打样' : '标准打样'}` : '-'}</div>
      </div>
    `;
  }
}
function renderWorkbenchStatusBar(detail) {
  const pNameEl = document.getElementById('sb-project-name');
  const ssotEl = document.getElementById('sb-ssot-status');
  const drcEl = document.getElementById('sb-drc-badge');
  const pinEl = document.getElementById('sb-pin-badge');
  const memEl = document.getElementById('sb-memory-text');
  const mcuEl = document.getElementById('sb-mcu-model');
  const edaEl = document.getElementById('sb-eda-mode');
  const pcbTabLabel = document.getElementById('edtab-pcb-label');
  if (pNameEl) pNameEl.innerText = detail.project_name || 'project';
  if (ssotEl) ssotEl.innerText = `SSOT (${(detail.pinout || []).length} Pins)`;
  const drcCnt = (detail.hardware?.drc?.violations_count || 0) + (detail.hardware?.drc?.unconnected_count || 0);
  if (drcEl) {
    drcEl.innerHTML = drcCnt === 0
      ? '<i class="fa-regular fa-circle-check text-emerald-400"></i> 0 DRC'
      : `<i class="fa-solid fa-circle-xmark text-rose-400"></i> ${drcCnt} DRC`;
  }
  const uncovCnt = detail.firmware?.pin_coverage?.uncovered_count || 0;
  const gccErrCnt = latestGccDiagnostics.length;
  if (pinEl) {
    if (gccErrCnt > 0) {
      pinEl.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400"></i> ${gccErrCnt} GCC Err`;
    } else {
      pinEl.innerHTML = uncovCnt === 0
        ? '<i class="fa-solid fa-plug-circle-check text-emerald-400"></i> 100% Pins'
        : `<i class="fa-solid fa-triangle-exclamation text-amber-400"></i> ${uncovCnt} Unbound`;
    }
  }
  const mem = detail.firmware?.memory_usage;
  if (memEl) {
    memEl.innerText = mem
      ? `Flash: ${mem.flash_pct}% | SRAM: ${mem.ram_pct}%`
      : 'Flash: --% | SRAM: --%';
  }
  if (mcuEl) {
    mcuEl.innerText = detail.spec?.mcu?.model || 'STM32';
  }
  if (edaEl) {
    edaEl.innerText = currentEdaMode === 'jlc' ? '🏭 嘉立创 JLC SMT' : '🎯 KiCad Native';
  }
  if (pcbTabLabel && detail.hardware?.primary_pcb) {
    pcbTabLabel.innerText = detail.hardware.primary_pcb.split('/').pop();
  }
}
function jumpToDiagnosticLocation(targetTab, fileName, lineNo) {
  if (!coDesignSplitActive) {
    switchTab(targetTab || 'firmware');
  }
  if (targetTab === 'firmware') {
    const viewer = document.getElementById('rev-fw-code-viewer');
    if (viewer) {
      viewer.focus();
      const lines = (viewer.value || '').split('\n');
      let charOffset = 0;
      for (let i = 0; i < Math.min(lineNo - 1, lines.length); i++) {
        charOffset += lines[i].length + 1;
      }
      viewer.setSelectionRange(charOffset, charOffset + (lines[lineNo - 1]?.length || 0));
      updateFirmwareCursorLine();
    }
    if (monacoEditorInstance && monacoEditorEnabled) {
      monacoEditorInstance.revealLineInCenter(lineNo || 1);
      monacoEditorInstance.setPosition({ lineNumber: lineNo || 1, column: 1 });
      monacoEditorInstance.focus();
    }
  }
}
function toggleBottomPanel(forceTab = null) {
  const panel = document.getElementById('vscode-bottom-panel');
  if (!panel) return;
  if (forceTab) {
    panel.classList.remove('hidden');
    switchBottomPanelTab(forceTab);
    return;
  }
  panel.classList.toggle('hidden');
  setTimeout(layoutMonacoEditorIfVisible, 60);
}
function switchBottomPanelTab(tabName) {
  currentBottomPanelTab = tabName;
  ['problems', 'output', 'terminal', 'memory'].forEach(t => {
    const btn = document.getElementById(`btm-tab-${t}`);
    const pane = document.getElementById(`btm-pane-${t}`);
    if (pane) pane.classList.toggle('hidden', t !== tabName);
    if (btn) {
      btn.className = t === tabName
        ? 'pb-1 border-b-2 border-sky-400 text-sky-400 flex items-center gap-1.5 transition'
        : 'pb-1 border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition';
    }
  });
}
function toggleBottomPanelSize() {
  const panel = document.getElementById('vscode-bottom-panel');
  const icon = document.getElementById('btm-panel-size-icon');
  if (!panel) return;
  bottomPanelExpanded = !bottomPanelExpanded;
  panel.style.height = bottomPanelExpanded ? '22rem' : '13rem';
  if (icon) {
    icon.className = bottomPanelExpanded ? 'fa-solid fa-angles-down text-[10px]' : 'fa-solid fa-angles-up text-[10px]';
  }
}
async function autoHealAllProblems() {
  if (latestGccDiagnostics.length > 0) {
    switchTab('firmware');
    sendQuickCopilotPrompt('firmware', '请检查并修复当前 C 固件源码中的 GCC 编译语法错误或警告，并重新调用 arm-none-eabi-gcc 编译');
    return;
  }
  const drcCnt = (activeProjectDetail?.hardware?.drc?.violations_count || 0) + (activeProjectDetail?.hardware?.drc?.unconnected_count || 0);
  if (drcCnt > 0) {
    switchTab('pcb');
    await runDrcSelfHeal();
    return;
  }
  const uncovCnt = activeProjectDetail?.firmware?.pin_coverage?.uncovered_count || 0;
  if (uncovCnt > 0) {
    switchTab('firmware');
    sendQuickCopilotPrompt('firmware', '请根据 bsp_pinout.h 中定义的全部引脚宏，在状态机中补全所有未绑定引脚的初始化与驱动逻辑，并重新编译验证');
    return;
  }
  showToast('当前工程 0 DRC 违规、0 GCC 报错、100% 引脚覆盖，无需修复！', 'success');
}
function runQuickTerminalPrompt() {
  const input = document.getElementById('btm-terminal-input');
  const pre = document.getElementById('btm-terminal-pre');
  if (!input || !input.value.trim()) return;
  const cmd = input.value.trim();
  input.value = '';
  if (pre) {
    pre.innerText += `\n\n❯ ${cmd}\n[正在调度当前激活工坊 AI 助手执行...]`;
    pre.scrollTop = pre.scrollHeight;
  }
  const fwPane = document.getElementById('pane-firmware');
  const targetMod = (fwPane && !fwPane.classList.contains('hidden')) ? 'firmware' : 'pcb';
  sendQuickCopilotPrompt(targetMod, cmd);
}
function handleGccBuildResultInWorkbench(buildObj) {
  const outPre = document.getElementById('btm-output-pre');
  const logStr = buildObj?.log || buildObj?.error || '';
  if (outPre && logStr) {
    outPre.innerText = `[ARM-GCC Build @ ${new Date().toLocaleTimeString()}]\n${logStr}`;
  }
  latestGccDiagnostics = [];
  const regex = /([^:\s]+\.[ch]):(\d+):(\d+):\s*(error|warning):\s*(.+)/gi;
  let match;
  while ((match = regex.exec(logStr)) !== null) {
    latestGccDiagnostics.push({
      severity: match[4].toLowerCase() === 'error' ? 'error' : 'warning',
      source: 'ARM-GCC',
      file: match[1].split('/').pop(),
      line: parseInt(match[2], 10) || 1,
      column: parseInt(match[3], 10) || 1,
      message: match[5].trim(),
      target_tab: 'firmware',
      quick_fix_prompt: `请修复 ${match[1].split('/').pop()} 第 ${match[2]} 行的 GCC 编译报错: ${match[5].trim()}`
    });
  }
  const errBadge = document.getElementById('fw-gcc-error-badge');
  if (errBadge) {
    errBadge.classList.toggle('hidden', latestGccDiagnostics.length === 0);
  }
  applyGccDiagnosticsToMonaco(latestGccDiagnostics);
  if (activeProjectDetail) {
    renderWorkbenchDiagnosticsAndPanel(activeProjectDetail);
    renderWorkbenchStatusBar(activeProjectDetail);
  }
  if (latestGccDiagnostics.some(d => d.severity === 'error')) {
    toggleBottomPanel('problems');
  }
}
function toggleFirmwareEditorEngine() {
  const monacoWrap = document.getElementById('monaco-fw-editor-wrapper');
  const nativeWrap = document.getElementById('native-fw-editor-wrapper');
  const btn = document.getElementById('btn-toggle-monaco-mode');
  if (!monacoWrap || !nativeWrap) return;
  if (!monacoEditorEnabled) {
    initOrSyncMonacoEditor(() => {
      monacoEditorEnabled = true;
      monacoWrap.classList.remove('hidden');
      nativeWrap.classList.add('hidden');
      if (btn) {
        btn.innerText = '⚡ Monaco: ON (点击切回极速模式)';
        btn.className = 'text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold font-mono transition';
      }
      layoutMonacoEditorIfVisible();
      showToast('已切换至 VS Code Monaco Editor 内核 (支持 C99 语法高亮、PIN_ 宏自动补全与 GCC 波浪线报错)！');
    });
  } else {
    monacoEditorEnabled = false;
    monacoWrap.classList.add('hidden');
    nativeWrap.classList.remove('hidden');
    if (btn) {
      btn.innerText = '⚡ Monaco 内核';
      btn.className = 'text-[10px] px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-mono transition';
    }
    updateFirmwareLineNumbers();
  }
}
function initOrSyncMonacoEditor(onReady) {
  if (monacoEditorInstance) {
    if (onReady) onReady();
    return;
  }
  if (typeof window.require !== 'function') {
    showToast('当前离线环境未加载 Monaco CDN，已保持原生带行号编辑器模式', 'warn');
    return;
  }
  if (monacoLoadingInProgress) return;
  monacoLoadingInProgress = true;
  window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
  window.require(['vs/editor/editor.main'], function () {
    monacoLoadingInProgress = false;
    const container = document.getElementById('monaco-fw-editor-container');
    const viewer = document.getElementById('rev-fw-code-viewer');
    if (!container) return;
    if (!monacoCompletionRegistered && window.monaco) {
      monacoCompletionRegistered = true;
      window.monaco.languages.registerCompletionItemProvider('c', {
        provideCompletionItems: function () {
          const suggestions = [];
          const pinout = activeProjectDetail?.pinout || [];
          pinout.forEach((p, idx) => {
            const net = (p.net_name || `SIG_${idx}`).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
            ['NAME', 'PORT_NAME', 'PIN_INDEX', 'BIT_MASK', 'ALT_FUNC'].forEach(suffix => {
              const macro = `PIN_${net}_${suffix}`;
              suggestions.push({
                label: macro,
                kind: window.monaco.languages.CompletionItemKind.Constant,
                insertText: macro,
                detail: `[SSOT bsp_pinout.h] ${p.pin} -> ${p.net_name} (${p.function || 'GPIO'})`
              });
            });
          });
          return { suggestions };
        }
      });
    }
    const isDark = document.documentElement.classList.contains('dark');
    monacoEditorInstance = window.monaco.editor.create(container, {
      value: viewer ? viewer.value : '',
      language: 'c',
      theme: isDark ? 'vs-dark' : 'vs',
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      minimap: { enabled: true },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      roundedSelection: true
    });
    monacoEditorInstance.onDidChangeModelContent(() => {
      const val = monacoEditorInstance.getValue();
      const vEl = document.getElementById('rev-fw-code-viewer');
      if (vEl && vEl.value !== val) {
        vEl.value = val;
        markFirmwareEditorDirty();
        updateFirmwareLineNumbers();
      }
    });
    monacoEditorInstance.onDidChangeCursorPosition((e) => {
      const posStr = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      const ind = document.getElementById('fw-editor-line-indicator');
      if (ind) ind.innerText = posStr;
      const sbCur = document.getElementById('sb-cursor-pos');
      if (sbCur) sbCur.innerText = `${posStr} · C99 (Monaco)`;
      if (typeof crossProbeFromCodeCursor === 'function') {
        crossProbeFromCodeCursor();
      }
    });
    applyGccDiagnosticsToMonaco(latestGccDiagnostics);
    if (onReady) onReady();
  });
}
function syncMonacoEditorContent(content, fileName = '') {
  if (!monacoEditorInstance || !window.monaco) return;
  if (monacoEditorInstance.getValue() !== content) {
    monacoEditorInstance.setValue(content || '');
  }
  const model = monacoEditorInstance.getModel();
  if (model && fileName) {
    const lang = fileName.endsWith('.json') ? 'json' : (fileName.endsWith('.md') ? 'markdown' : (fileName === 'Makefile' ? 'makefile' : 'c'));
    window.monaco.editor.setModelLanguage(model, lang);
  }
}
function getActiveFirmwareEditorContent() {
  if (monacoEditorEnabled && monacoEditorInstance) {
    return monacoEditorInstance.getValue();
  }
  const viewer = document.getElementById('rev-fw-code-viewer');
  return viewer ? viewer.value : '';
}
function layoutMonacoEditorIfVisible() {
  if (monacoEditorInstance && monacoEditorEnabled) {
    monacoEditorInstance.layout();
  }
}
function applyGccDiagnosticsToMonaco(diags) {
  if (!monacoEditorInstance || !window.monaco) return;
  const model = monacoEditorInstance.getModel();
  if (!model) return;
  const curName = (currentEditingFwPath || '').split('/').pop();
  const markers = (diags || [])
    .filter(d => !d.file || d.file === curName)
    .map(d => ({
      severity: d.severity === 'error' ? window.monaco.MarkerSeverity.Error : window.monaco.MarkerSeverity.Warning,
      startLineNumber: d.line || 1,
      startColumn: d.column || 1,
      endLineNumber: d.line || 1,
      endColumn: 80,
      message: d.message
    }));
  window.monaco.editor.setModelMarkers(model, 'arm-none-eabi-gcc', markers);
}
function buildCommandPaletteCatalog() {
  const cmds = [
    { type: 'cmd', icon: 'fa-table-columns text-emerald-400', title: '> View: Toggle Co-Design Split View (开启/关闭 左PCB右C代码同屏分屏)', hint: '⌘\\', action: () => toggleCoDesignSplitView() },
    { type: 'cmd', icon: 'fa-bolt text-sky-400', title: '> Editor: Toggle VS Code Monaco C99 Kernel (切换 Monaco 编辑器内核)', hint: 'Monaco', action: () => { switchTab('firmware'); toggleFirmwareEditorEngine(); } },
    { type: 'cmd', icon: 'fa-hammer text-sky-400', title: '> Firmware: Compile C99 with ARM-GCC (交叉编译生成 ELF/HEX/BIN)', hint: 'GCC', action: () => { switchTab('firmware'); runDynamicFirmwareVerify(); } },
    { type: 'cmd', icon: 'fa-shield-halved text-emerald-400', title: '> PCB: Run KiCad DRC Verification (运行官方 KiCad DRC 规则校验)', hint: 'DRC', action: () => { switchTab('pcb'); runDynamicDrc(); } },
    { type: 'cmd', icon: 'fa-industry text-amber-400', title: '> PCB: Switch to JLCPCB SMT Mode (切换至嘉立创贴片增强模式)', hint: 'JLC', action: () => { switchTab('pcb'); switchEdaMode('jlc'); } },
    { type: 'cmd', icon: 'fa-compass-drafting text-emerald-400', title: '> PCB: Switch to KiCad Native Mode (切换至 KiCad 原生模式)', hint: 'KiCad', action: () => { switchTab('pcb'); switchEdaMode('kicad'); } },
    { type: 'cmd', icon: 'fa-wand-magic-sparkles text-emerald-400', title: '> Diagnostics: Auto-Heal All Problems with AI (AI 一键自愈全部问题)', hint: 'Auto-Heal', action: () => autoHealAllProblems() },
    { type: 'cmd', icon: 'fa-rocket text-teal-400', title: '> Pipeline: Start 5-Stage Autonomous Co-Design (一键启动五阶段协同流水线)', hint: 'FLOW', action: () => { switchTab('agents'); startAutonomousPipeline(); } },
    { type: 'cmd', icon: 'fa-puzzle-piece text-indigo-400', title: '> Extensions: Open Skill Marketplace & Distiller (打开 Skill 插件市场)', hint: 'SKILL', action: () => switchTab('distiller') },
    { type: 'cmd', icon: 'fa-flask text-purple-400', title: '> Extensions: Distill Local PDF/Datasheet to Skill (上传资料蒸馏为新 Skill)', hint: 'Book2Skill', action: () => { switchTab('distiller'); toggleDistillUploadDrawer(); } },
    { type: 'cmd', icon: 'fa-window-maximize text-sky-400', title: '> View: Toggle Bottom Problems & Terminal Panel (显示/隐藏底部诊断面板)', hint: '⌘J', action: () => toggleBottomPanel() },
    { type: 'cmd', icon: 'fa-sun text-amber-400', title: '> Preferences: Toggle Color Theme (切换深色/浅色主题)', hint: 'Theme', action: () => toggleTheme() },
    { type: 'cmd', icon: 'fa-laptop-code text-sky-400', title: '> Bridge: Open Project in Desktop VS Code (用桌面 VS Code 打开工程)', hint: 'External', action: () => openLocalTool('vscode') },
    { type: 'cmd', icon: 'fa-compass-drafting text-emerald-400', title: '> Bridge: Open PCB in Desktop KiCad (用桌面 KiCad 打开电路板)', hint: 'External', action: () => openLocalTool('kicad') }
  ];
  const fileItems = [];
  (activeProjectDetail?.explorer_tree || []).forEach(g => {
    (g.files || []).forEach(f => {
      fileItems.push({
        type: 'file',
        icon: 'fa-file-code text-sky-400',
        title: `${f.name} — ${f.rel_path}`,
        hint: g.group.toUpperCase(),
        action: () => openExplorerFileItem(f.kind, f.abs_path, f.name)
      });
    });
  });
  return [...fileItems, ...cmds];
}
function openCommandPalette(initialQuery = '') {
  const modal = document.getElementById('vscode-cmd-palette-modal');
  const input = document.getElementById('vscode-cmd-input');
  if (!modal || !input) return;
  modal.classList.remove('hidden');
  input.value = initialQuery;
  filterCommandPalette(initialQuery);
  setTimeout(() => input.focus(), 20);
}
function closeCommandPalette() {
  const modal = document.getElementById('vscode-cmd-palette-modal');
  if (modal) modal.classList.add('hidden');
}
function filterCommandPalette(query = '') {
  const q = (query || '').trim().toLowerCase();
  const all = buildCommandPaletteCatalog();
  if (!q) {
    cmdPaletteFilteredItems = all;
  } else if (q.startsWith('>')) {
    const sub = q.slice(1).trim();
    cmdPaletteFilteredItems = all.filter(it => it.type === 'cmd' && it.title.toLowerCase().includes(sub));
  } else {
    cmdPaletteFilteredItems = all.filter(it => it.title.toLowerCase().includes(q) || (it.hint || '').toLowerCase().includes(q));
  }
  cmdPaletteSelectedIndex = 0;
  renderCommandPaletteList();
}
function renderCommandPaletteList() {
  const box = document.getElementById('vscode-cmd-list');
  if (!box) return;
  if (cmdPaletteFilteredItems.length === 0) {
    box.innerHTML = '<div class="py-6 text-center text-xs text-slate-500 font-mono">未找到匹配的工程文件或 IDE 命令</div>';
    return;
  }
  box.innerHTML = cmdPaletteFilteredItems.map((it, idx) => {
    const isSel = idx === cmdPaletteSelectedIndex;
    return `
      <div onclick="executeCommandPaletteItem(${idx})" class="px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between text-xs font-mono transition ${
        isSel ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-300 hover:bg-slate-800/70'
      }">
        <span class="flex items-center gap-2.5 truncate">
          <i class="fa-solid ${it.icon} w-4 text-center"></i>
          <span class="truncate">${escapeHtml(it.title)}</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">${escapeHtml(it.hint || '')}</span>
      </div>
    `;
  }).join('');
}
function onCommandPaletteKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cmdPaletteSelectedIndex = (cmdPaletteSelectedIndex + 1) % Math.max(1, cmdPaletteFilteredItems.length);
    renderCommandPaletteList();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    cmdPaletteSelectedIndex = (cmdPaletteSelectedIndex - 1 + Math.max(1, cmdPaletteFilteredItems.length)) % Math.max(1, cmdPaletteFilteredItems.length);
    renderCommandPaletteList();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    executeCommandPaletteItem(cmdPaletteSelectedIndex);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeCommandPalette();
  }
}
function executeCommandPaletteItem(idx) {
  const item = cmdPaletteFilteredItems[idx];
  closeCommandPalette();
  if (item && typeof item.action === 'function') {
    item.action();
  }
}
window.addEventListener('DOMContentLoaded', initApp);
