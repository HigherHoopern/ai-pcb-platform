/**
 * Xter AI-PCB Platform — Cloud-Client Separation & Desktop Native Bridge (Phase 2)
 *
 * 功能职责：
 * 1. 动态云端 API 路由网关：拦截 `/api/*` 请求，自动拼接 `XTER_CLOUD_API_BASE` 并注入 `Authorization: Bearer <LicenseKey>` 与 `X-Cloud-Mode: 1`。
 * 2. 商业授权与多租户沙箱控制台 (`openCloudLicenseModal`)：支持在线配置云端服务器地址、验证企业/专业版 License Key、查看核心 IP 防护状态。
 * 3. 双模本地桌面工具桥接 (`openLocalTool` 增强)：
 *    - 桌面安装包模式 (macOS .dmg / Windows .exe via Tauri)：调用 Rust 原生指令将云端工程同步至客户本机 `~/Xter-AI-PCB-Projects/` 并唤起客户本机的 KiCad 10 / VS Code。
 *    - 网页云端模式 (Web SaaS)：自动触发浏览器下载 `.kicad_pcb` 或全套交付包 ZIP。
 *    - 本地开发模式 (Local Dev)：保持原有本机直连行为。
 */
(function () {
  const STORAGE_API_BASE = 'XTER_CLOUD_API_BASE';
  const STORAGE_LICENSE_KEY = 'XTER_LICENSE_KEY';
  const STORAGE_CLOUD_MODE = 'XTER_CLOUD_MODE_ENABLED';
  const STORAGE_TENANT_INFO = 'XTER_TENANT_INFO';

  window.XTER_CLOUD_CONFIG = {
    apiBase: (localStorage.getItem(STORAGE_API_BASE) || window.DEFAULT_CLOUD_API_BASE || '').replace(/\/+$/, ''),
    licenseKey: (localStorage.getItem(STORAGE_LICENSE_KEY) || '').trim(),
    cloudModeEnabled: localStorage.getItem(STORAGE_CLOUD_MODE) === '1',
    isDesktopApp: Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__ || window.electronAPI),
    tenantInfo: (function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_TENANT_INFO) || 'null');
      } catch (e) {
        return null;
      }
    })()
  };

  // =========================================================================
  // 1. 全局 Fetch 拦截器：自动路由 `/api/*` 到云端服务器并携带多租户 License Key
  // =========================================================================
  const _rawFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    let url = input;
    let options = init ? Object.assign({}, init) : {};

    if (typeof url === 'string' && url.startsWith('/api/')) {
      const base = (window.XTER_CLOUD_CONFIG.apiBase || '').replace(/\/+$/, '');
      if (base) {
        url = base + url;
      }

      const headers = new Headers(options.headers || {});
      if (window.XTER_CLOUD_CONFIG.licenseKey) {
        headers.set('Authorization', 'Bearer ' + window.XTER_CLOUD_CONFIG.licenseKey);
        headers.set('X-License-Key', window.XTER_CLOUD_CONFIG.licenseKey);
      }
      if (window.XTER_CLOUD_CONFIG.cloudModeEnabled || window.XTER_CLOUD_CONFIG.licenseKey || base) {
        headers.set('X-Cloud-Mode', '1');
      }
      options.headers = headers;
    }

    return _rawFetch(url, options);
  };

  // 辅助：为图片/文件下载 URL 附加云端 Base 地址
  window.resolveCloudAssetUrl = function (relOrApiPath) {
    if (!relOrApiPath || typeof relOrApiPath !== 'string') return relOrApiPath;
    if (relOrApiPath.startsWith('/api/')) {
      const base = (window.XTER_CLOUD_CONFIG.apiBase || '').replace(/\/+$/, '');
      return base ? base + relOrApiPath : relOrApiPath;
    }
    return relOrApiPath;
  };

  // =========================================================================
  // 2. 顶部状态徽章与云端连接弹窗 UI
  // =========================================================================
  function updateHeaderCloudBadge() {
    const badgeEl = document.getElementById('header-cloud-mode-badge');
    const textEl = document.getElementById('header-cloud-mode-text');
    if (!badgeEl || !textEl) return;

    const cfg = window.XTER_CLOUD_CONFIG;
    const isCloud = Boolean(cfg.cloudModeEnabled || cfg.licenseKey || cfg.apiBase);

    if (isCloud && cfg.tenantInfo && cfg.tenantInfo.valid) {
      badgeEl.className = 'px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap';
      const tierTag = (cfg.tenantInfo.tier || 'PRO').toUpperCase().replace('_ADMIN', '');
      textEl.textContent = `☁️ 云端已授权 (${tierTag})`;
    } else if (isCloud) {
      badgeEl.className = 'px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap';
      textEl.textContent = '☁️ 云端模式 (待验权)';
    } else {
      badgeEl.className = 'px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap';
      textEl.textContent = cfg.isDesktopApp ? '🖥️ 桌面端连接配置' : '☁️ 云端与商业授权';
    }
  }

  window.openCloudLicenseModal = async function () {
    const modal = document.getElementById('cloud-license-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const apiInput = document.getElementById('cloud-cfg-api-base');
    const keyInput = document.getElementById('cloud-cfg-license-key');
    const modeCheck = document.getElementById('cloud-cfg-enable-checkbox');

    if (apiInput) apiInput.value = window.XTER_CLOUD_CONFIG.apiBase || '';
    if (keyInput) keyInput.value = window.XTER_CLOUD_CONFIG.licenseKey || '';
    if (modeCheck) modeCheck.checked = Boolean(window.XTER_CLOUD_CONFIG.cloudModeEnabled || window.XTER_CLOUD_CONFIG.licenseKey);

    await refreshCloudStatusInModal();
  };

  window.closeCloudLicenseModal = function () {
    const modal = document.getElementById('cloud-license-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  window.applyDemoLicenseKey = function (demoKey) {
    const keyInput = document.getElementById('cloud-cfg-license-key');
    const modeCheck = document.getElementById('cloud-cfg-enable-checkbox');
    if (keyInput) keyInput.value = demoKey;
    if (modeCheck) modeCheck.checked = true;
    saveAndVerifyCloudLicense();
  };

  window.switchToLocalDevMode = async function () {
    localStorage.removeItem(STORAGE_API_BASE);
    localStorage.removeItem(STORAGE_LICENSE_KEY);
    localStorage.setItem(STORAGE_CLOUD_MODE, '0');
    localStorage.removeItem(STORAGE_TENANT_INFO);

    window.XTER_CLOUD_CONFIG.apiBase = '';
    window.XTER_CLOUD_CONFIG.licenseKey = '';
    window.XTER_CLOUD_CONFIG.cloudModeEnabled = false;
    window.XTER_CLOUD_CONFIG.tenantInfo = null;

    const apiInput = document.getElementById('cloud-cfg-api-base');
    const keyInput = document.getElementById('cloud-cfg-license-key');
    const modeCheck = document.getElementById('cloud-cfg-enable-checkbox');
    if (apiInput) apiInput.value = '';
    if (keyInput) keyInput.value = '';
    if (modeCheck) modeCheck.checked = false;

    updateHeaderCloudBadge();
    await refreshCloudStatusInModal();
    if (typeof window.loadGlobalProjectsList === 'function') {
      window.loadGlobalProjectsList();
    }
  };

  window.saveAndVerifyCloudLicense = async function () {
    const apiInput = document.getElementById('cloud-cfg-api-base');
    const keyInput = document.getElementById('cloud-cfg-license-key');
    const modeCheck = document.getElementById('cloud-cfg-enable-checkbox');
    const statusBox = document.getElementById('cloud-verify-result-box');

    const apiBase = (apiInput ? apiInput.value : '').trim().replace(/\/+$/, '');
    const licenseKey = (keyInput ? keyInput.value : '').trim();
    const cloudEnabled = modeCheck ? modeCheck.checked : Boolean(licenseKey || apiBase);

    window.XTER_CLOUD_CONFIG.apiBase = apiBase;
    window.XTER_CLOUD_CONFIG.licenseKey = licenseKey;
    window.XTER_CLOUD_CONFIG.cloudModeEnabled = cloudEnabled;

    localStorage.setItem(STORAGE_API_BASE, apiBase);
    localStorage.setItem(STORAGE_LICENSE_KEY, licenseKey);
    localStorage.setItem(STORAGE_CLOUD_MODE, cloudEnabled ? '1' : '0');

    if (statusBox) {
      statusBox.className = 'p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-sky-300';
      statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> 正在连接云端安全网关并校验 License 授权码...';
    }

    try {
      if (licenseKey) {
        const res = await window.fetch('/api/cloud/verify_license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: licenseKey })
        });
        const data = await res.json();
        if (data.success && data.valid) {
          window.XTER_CLOUD_CONFIG.tenantInfo = data;
          localStorage.setItem(STORAGE_TENANT_INFO, JSON.stringify(data));
          if (statusBox) {
            statusBox.className = 'p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-300 space-y-1';
            statusBox.innerHTML = `
              <div class="font-bold text-emerald-200 flex items-center justify-between">
                <span>${data.message}</span>
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 font-mono text-[10px]">${(data.tier || '').toUpperCase()}</span>
              </div>
              <div class="text-[11px] text-slate-300 font-mono">
                租户隔离 ID: <span class="text-sky-300">${data.tenant_id}</span> · 有效期至: ${data.expires_at} · 独立工程上限: ${data.max_projects} 个
              </div>
            `;
          }
        } else {
          window.XTER_CLOUD_CONFIG.tenantInfo = null;
          localStorage.removeItem(STORAGE_TENANT_INFO);
          if (statusBox) {
            statusBox.className = 'p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300';
            statusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> ${data.error || '授权码验证失败'}`;
          }
        }
      } else {
        if (statusBox) {
          statusBox.className = 'p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300';
          statusBox.innerHTML = cloudEnabled
            ? '⚠️ 已开启云端分离模式，但尚未填写商业授权码 (License Key)。请点击下方预设授权码或输入客户专属 Key。'
            : '🛠️ 当前处于【本地全功能开发模式 (Local Dev Mode)】，前后端同机直连运行。';
        }
      }
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300';
        statusBox.innerHTML = `<i class="fa-solid fa-plug-circle-xmark mr-1.5"></i> 无法连接云端 API 网关 (${apiBase || window.location.origin}): ${err.message}`;
      }
    }

    updateHeaderCloudBadge();
    await refreshCloudStatusInModal();
    if (typeof window.loadGlobalProjectsList === 'function') {
      window.loadGlobalProjectsList();
    }
  };

  async function refreshCloudStatusInModal() {
    const infoEl = document.getElementById('cloud-live-status-summary');
    if (!infoEl) return;
    try {
      const res = await window.fetch('/api/cloud/status');
      const data = await res.json();
      if (data && data.tenant) {
        const t = data.tenant;
        const ip = data.ip_protection || {};
        infoEl.innerHTML = `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-slate-400">当前运行模式</div>
              <div class="font-bold text-sky-300 mt-0.5 font-mono">${t.is_cloud_mode ? '☁️ CLOUD SAAS' : '💻 LOCAL DEV'}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-slate-400">当前租户沙箱 (Tenant)</div>
              <div class="font-bold text-emerald-300 mt-0.5 font-mono truncate">${t.tenant_id || 'default'}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-slate-400">324页知识库防爬脱敏</div>
              <div class="font-bold text-purple-300 mt-0.5 font-mono">${ip.skill_full_markdown_protected ? '🛡️ ACTIVE' : 'OFF'}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div class="text-slate-400">C99 宿主机仿真沙箱</div>
              <div class="font-bold text-amber-300 mt-0.5 font-mono">${ip.c99_host_sandbox_enabled ? '🔒 SANDBOXED' : 'OFF'}</div>
            </div>
          </div>
        `;
      }
    } catch (e) {
      infoEl.innerHTML = `<div class="text-xs text-slate-400">等待连接云端网关...</div>`;
    }
  }

  // =========================================================================
  // 3. 双模本地桌面工具桥接 (Web 下载 vs Tauri 桌面端本机同步唤起 KiCad/VSCode)
  // =========================================================================
  function installDualModeLocalBridge() {
    const _origOpenLocalTool = window.openLocalTool;
    window.openLocalTool = async function (action) {
      const cfg = window.XTER_CLOUD_CONFIG;
      const isRemoteCloud = Boolean(
        cfg.cloudModeEnabled ||
        (cfg.apiBase && !cfg.apiBase.includes('127.0.0.1') && !cfg.apiBase.includes('localhost'))
      );

      // 情况 A：运行在 Tauri 打包的 macOS (.dmg/.app) 或 Windows (.exe/.msi) 桌面客户端内
      const tauriInvoke =
        (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) ||
        (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);

      if (typeof tauriInvoke === 'function') {
        try {
          const projSelect = document.getElementById('global-project-select');
          const projectDir = projSelect ? projSelect.value : '';
          // 先在云端打包最新工程 ZIP
          const bundleRes = await window.fetch('/api/projects/export_bundle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_dir: projectDir })
          });
          const bundleData = await bundleRes.json();
          const bundlePath = bundleData && bundleData.bundle ? bundleData.bundle.bundle_zip : '';
          const downloadUrl = window.resolveCloudAssetUrl(
            `/api/projects/download?path=${encodeURIComponent(bundlePath)}`
          );

          const msg = await tauriInvoke('sync_and_open_local_tool', {
            action: action,
            downloadUrl: downloadUrl,
            licenseKey: cfg.licenseKey || '',
            projectName: (bundleData && bundleData.bundle && bundleData.bundle.bundle_name) || 'xter_project.zip'
          });
          alert(msg || `已同步云端工程并在本机启动 ${action}`);
          return;
        } catch (err) {
          console.warn('Tauri native bridge fallback:', err);
        }
      }

      // 情况 B：运行在远端云模式下的纯浏览器端 (Web SaaS) -> 触发浏览器下载工程或 PCB 文件
      if (isRemoteCloud) {
        const projSelect = document.getElementById('global-project-select');
        const projectDir = projSelect ? projSelect.value : '';
        try {
          const res = await window.fetch('/api/projects/export_bundle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_dir: projectDir })
          });
          const data = await res.json();
          if (data.success && data.bundle && data.bundle.bundle_zip) {
            const dlUrl = window.resolveCloudAssetUrl(
              `/api/projects/download?path=${encodeURIComponent(data.bundle.bundle_zip)}`
            );
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = data.bundle.bundle_name || 'Full_Release_Bundle.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            alert(
              `☁️ 【云端网页模式提示】\n` +
              `由于您当前通过浏览器访问云端算力集群，已为您自动打包并下载最新工程包 (${data.bundle.bundle_name})！\n\n` +
              `💡 提示：若需点击按钮直接唤起您电脑上的 KiCad 10 或 VS Code，请使用 macOS (.dmg) 或 Windows (.exe) 桌面客户端版本。`
            );
            return;
          }
        } catch (e) {
          console.error('Cloud export fallback error:', e);
        }
      }

      // 情况 C：本地开发模式或同机部署，调用原始宿主机桥接逻辑
      if (typeof _origOpenLocalTool === 'function') {
        return _origOpenLocalTool(action);
      }
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateHeaderCloudBadge();
    setTimeout(installDualModeLocalBridge, 200);
  });
})();
