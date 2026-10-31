#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 多模型统一调用客户端 (Universal Multi-Provider LLM Client)

支持动态切换与按场景路由：
  - SiliconFlow (DeepSeek-V4-Flash / DeepSeek-V3 / R1 / Qwen2.5-Coder)
  - DeepSeek 官方 API
  - OpenAI / 兼容网关
  - Claude / OpenRouter 网关
  - Ollama / vLLM 本地大模型
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

PLATFORM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, PLATFORM_ROOT)

from core.config_manager import resolve_llm_config


def _clean_llm_output(content: str) -> str:
    """清理推理模型可能输出的 <think>...</think> 思考块"""
    if not content:
        return ""
    if "</think>" in content:
        content = content.split("</think>", 1)[-1]
    return content.strip()


def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
    temperature: Optional[float] = None,
    max_tokens: int = 4096,
    task_type: str = "req_distill",
    override_config: Optional[Dict[str, Any]] = None,
    enable_thinking: bool = False
) -> str:
    """调用当前激活或路由指定的 LLM API"""
    cfg = resolve_llm_config(task_type=task_type, override=override_config)
    api_key = cfg.get("api_key", "")
    base_url = cfg.get("base_url", "http://100.113.144.63:8012/v1").rstrip("/")
    model_name = cfg.get("model_name", "Qwen3.8-27B")
    temp = temperature if temperature is not None else cfg.get("temperature", 0.2)

    is_local = any(h in base_url for h in ("127.0.0.1", "localhost", "100.", "192.168.", "10.", "172."))
    if not api_key and not is_local:
        raise ValueError(
            f"当前服务商 [{cfg.get('provider_name', cfg.get('provider_id'))}] 未配置 API Key！"
            "请前往「模型与 Agent 配置中心」填写 API Key。"
        )

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": model_name,
        "messages": messages,
        "temperature": temp,
        "max_tokens": max_tokens
    }

    if "qwen3" in model_name.lower() or is_local:
        payload["chat_template_kwargs"] = {"enable_thinking": enable_thinking}

    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    req_data = json.dumps(payload).encode("utf8")
    url = f"{base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "AI-PCB-Platform/2.0"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(url, data=req_data, headers=headers)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if is_local else urllib.request.build_opener()

    try:
        with opener.open(req, timeout=240) as resp:
            data = json.loads(resp.read().decode("utf8"))
            content = data["choices"][0]["message"]["content"]
            return _clean_llm_output(content)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf8", errors="ignore")
        # 兼容部分不支持 response_format 或 chat_template_kwargs 的模型，自动降级重试一次
        if e.code == 400 and ("response_format" in err_msg or "chat_template_kwargs" in err_msg):
            payload.pop("response_format", None)
            payload.pop("chat_template_kwargs", None)
            req_retry = urllib.request.Request(url, data=json.dumps(payload).encode("utf8"), headers=headers)
            with opener.open(req_retry, timeout=240) as resp2:
                data2 = json.loads(resp2.read().decode("utf8"))
                return _clean_llm_output(data2["choices"][0]["message"]["content"])
        raise RuntimeError(f"LLM API 报错 ({e.code}) [{model_name} @ {base_url}]: {err_msg[:300]}")
    except Exception as e:
        raise RuntimeError(f"调用 LLM 失败 [{model_name} @ {base_url}]: {e}")


def call_llm_text(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_tokens: int = 1200,
    task_type: str = "req_distill",
    override_config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """安全调用 LLM 返回文本字典，任何网络或配置异常均优雅降级返回 {"success": False}"""
    try:
        txt = call_llm(
            prompt=user_prompt,
            system_prompt=system_prompt,
            json_mode=False,
            temperature=temperature,
            max_tokens=max_tokens,
            task_type=task_type,
            override_config=override_config
        )
        return {"success": True, "text": txt}
    except Exception as e:
        return {"success": False, "error": str(e), "text": ""}


def test_llm_connection(override_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """测试指定或当前激活的 LLM 服务商连通性与响应延迟"""
    cfg = resolve_llm_config(task_type="req_distill", override=override_config)
    t0 = time.time()
    try:
        reply = call_llm(
            prompt="请仅回复一句话：AI-PCB 软硬件协同引擎连接正常。",
            system_prompt="你是嵌入式C与PCB硬件协同设计AI助手。",
            json_mode=False,
            temperature=0.1,
            max_tokens=64,
            override_config=cfg
        )
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "success": True,
            "provider_id": cfg.get("provider_id"),
            "provider_name": cfg.get("provider_name"),
            "model_name": cfg.get("model_name"),
            "base_url": cfg.get("base_url"),
            "latency_ms": latency_ms,
            "reply": reply
        }
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "success": False,
            "provider_id": cfg.get("provider_id"),
            "provider_name": cfg.get("provider_name"),
            "model_name": cfg.get("model_name"),
            "base_url": cfg.get("base_url"),
            "latency_ms": latency_ms,
            "error": str(e)
        }


if __name__ == "__main__":
    res = test_llm_connection()
    print(json.dumps(res, indent=2, ensure_ascii=False))
