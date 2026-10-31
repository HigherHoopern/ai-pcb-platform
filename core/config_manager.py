#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 统一配置中心管理器 (Model & Agent Configuration Manager)

负责持久化与管理：
  1. 多模型服务商配置 (SiliconFlow, DeepSeek, OpenAI, Anthropic, OpenRouter, Ollama 等)
  2. 分场景模型路由 (需求提炼、知识库蒸馏、引脚/架构审查)
  3. Coding Agent CLI 自定义参数、模型指定与环境变量注入
  4. 多 Agent 协同流水线与当前激活工程配置
"""

import os
import json
from typing import Dict, Any, Tuple

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(PLATFORM_ROOT, "config")
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.json")


def _load_dotenv_dict() -> Dict[str, str]:
    env_vars = {}
    env_file = os.path.join(PLATFORM_ROOT, ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass
    return env_vars


def get_default_settings() -> Dict[str, Any]:
    dotenv = _load_dotenv_dict()
    env_key = dotenv.get("LLM_API_KEY") or os.environ.get("LLM_API_KEY", "")
    env_base = dotenv.get("LLM_BASE_URL") or os.environ.get("LLM_BASE_URL", "https://api.siliconflow.cn/v1")
    env_model = dotenv.get("LLM_MODEL_NAME") or os.environ.get("LLM_MODEL_NAME", "deepseek-ai/DeepSeek-V4-Flash")

    return {
        "llm": {
            "active_provider": "ollama",
            "providers": {
                "ollama": {
                    "id": "ollama",
                    "name": "本地 vLLM / Qwen3.8-27B (100.113.144.63)",
                    "base_url": "http://100.113.144.63:8012/v1",
                    "api_key": "EMPTY",
                    "default_model": "Qwen3.8-27B",
                    "models": [
                        "Qwen3.8-27B",
                        "qwen3.8"
                    ]
                },
                "siliconflow": {
                    "id": "siliconflow",
                    "name": "SiliconFlow (硅基流动)",
                    "base_url": env_base,
                    "api_key": env_key,
                    "default_model": env_model,
                    "models": [
                        env_model,
                        "deepseek-ai/DeepSeek-V3",
                        "deepseek-ai/DeepSeek-R1",
                        "Qwen/Qwen2.5-Coder-32B-Instruct",
                        "Pro/deepseek-ai/DeepSeek-V3"
                    ]
                },
                "deepseek": {
                    "id": "deepseek",
                    "name": "DeepSeek 官方 API",
                    "base_url": "https://api.deepseek.com/v1",
                    "api_key": "",
                    "default_model": "deepseek-chat",
                    "models": [
                        "deepseek-chat",
                        "deepseek-reasoner"
                    ]
                },
                "openai": {
                    "id": "openai",
                    "name": "OpenAI / 兼容网关",
                    "base_url": "https://api.openai.com/v1",
                    "api_key": "",
                    "default_model": "gpt-4o",
                    "models": [
                        "gpt-4o",
                        "gpt-4o-mini",
                        "o3-mini"
                    ]
                },
                "anthropic_compat": {
                    "id": "anthropic_compat",
                    "name": "Claude / OpenRouter 网关",
                    "base_url": "https://openrouter.ai/api/v1",
                    "api_key": "",
                    "default_model": "anthropic/claude-3.7-sonnet",
                    "models": [
                        "anthropic/claude-3.7-sonnet",
                        "google/gemini-2.5-pro",
                        "deepseek/deepseek-r1"
                    ]
                }
            },
            "routing": {
                "req_distill": {
                    "label": "需求解析与引脚矩阵提炼 (Gate 1)",
                    "provider": "default",
                    "model": "Qwen3.8-27B",
                    "temperature": 0.1
                },
                "skill_distill": {
                    "label": "技术规范与数据手册蒸馏 (Skill Distiller)",
                    "provider": "default",
                    "model": "Qwen3.8-27B",
                    "temperature": 0.2
                },
                "pinmux_review": {
                    "label": "软硬件引脚冲突与架构审查",
                    "provider": "default",
                    "model": "Qwen3.8-27B",
                    "temperature": 0.1
                }
            }
        },
        "agents": {
            "antigravity": {
                "custom_bin": "",
                "model_arg": "",
                "extra_args": "",
                "env_vars": {}
            },
            "claude": {
                "custom_bin": "",
                "model_arg": "",
                "extra_args": "",
                "env_vars": {}
            },
            "pi": {
                "custom_bin": "",
                "model_arg": "",
                "extra_args": "",
                "env_vars": {}
            },
            "codex": {
                "custom_bin": "",
                "model_arg": "",
                "extra_args": "",
                "env_vars": {}
            }
        },
        "workspace": {
            "projects_root": os.path.join(PLATFORM_ROOT, "workspaces"),
            "active_project_dir": os.path.join(PLATFORM_ROOT, "workspaces", "smart-env-alarm-01"),
            "pipeline": {
                "pcb_agent": "antigravity",
                "firmware_agent": "antigravity",
                "drc_agent": "antigravity"
            }
        }
    }


def load_settings() -> Dict[str, Any]:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    defaults = get_default_settings()
    if not os.path.exists(SETTINGS_FILE):
        save_settings(defaults)
        return defaults

    try:
        with open(SETTINGS_FILE, "r", encoding="utf8") as f:
            data = json.load(f)
        # 深度合并默认字段以保证向后兼容
        for section in ("llm", "agents", "workspace"):
            if section not in data:
                data[section] = defaults[section]
        if "providers" in defaults["llm"]:
            for pid, pcfg in defaults["llm"]["providers"].items():
                if pid not in data["llm"].get("providers", {}):
                    data["llm"].setdefault("providers", {})[pid] = pcfg
                elif pid == "siliconflow" and not data["llm"]["providers"][pid].get("api_key") and pcfg.get("api_key"):
                    data["llm"]["providers"][pid]["api_key"] = pcfg["api_key"]
        return data
    except Exception:
        return defaults


def save_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf8") as f:
        json.dump(new_settings, f, indent=2, ensure_ascii=False)
    return new_settings


def resolve_llm_config(task_type: str = "req_distill", override: Dict[str, Any] = None) -> Dict[str, Any]:
    """根据任务类型解析当前应当使用的 LLM Provider、Base URL、API Key 与 Model Name"""
    if override and override.get("base_url") and override.get("model_name"):
        return {
            "provider_id": override.get("provider_id", "custom"),
            "provider_name": override.get("provider_name", "Custom Provider"),
            "base_url": override["base_url"].rstrip("/"),
            "api_key": override.get("api_key", ""),
            "model_name": override["model_name"],
            "temperature": float(override.get("temperature", 0.2))
        }

    settings = load_settings()
    llm_cfg = settings.get("llm", {})
    providers = llm_cfg.get("providers", {})
    active_pid = llm_cfg.get("active_provider", "ollama")
    routing = llm_cfg.get("routing", {}).get(task_type, {})

    route_pid = routing.get("provider", "default")
    if not route_pid or route_pid == "default" or route_pid not in providers:
        target_pid = active_pid
    else:
        target_pid = route_pid

    p_info = providers.get(target_pid) or providers.get("ollama") or {}
    model_name = routing.get("model") or p_info.get("default_model") or "Qwen3.8-27B"
    temp = routing.get("temperature", 0.1)

    return {
        "provider_id": target_pid,
        "provider_name": p_info.get("name", target_pid),
        "base_url": (p_info.get("base_url") or "http://100.113.144.63:8012/v1").rstrip("/"),
        "api_key": p_info.get("api_key", "EMPTY"),
        "model_name": model_name,
        "temperature": float(temp)
    }
