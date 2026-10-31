#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AI-PCB Platform 统一需求文档解析器 (Universal Document Parser)

支持格式：
  - Excel: .xlsx, .xls (提取所有工作表、表头、引脚定义表、BOM表、网络表)
  - Word: .docx, .doc (提取正文段落、标题层级、结构化表格)
  - PDF: .pdf (通过 PyMuPDF/pdfplumber 提取文字与表格)
  - 纯文本: .md, .txt, .csv, .json
"""

import os, sys, subprocess, json
import pandas as pd
import fitz  # PyMuPDF
import docx

def parse_excel(file_path):
    xl = pd.ExcelFile(file_path)
    sheets_data = []
    text_summary = []
    
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        # 清理全空行与全空列
        df = df.dropna(how='all').dropna(axis=1, how='all')
        if df.empty:
            continue
            
        headers = [str(col).strip() for col in df.columns]
        rows = []
        for _, row in df.iterrows():
            row_dict = {str(k): (str(v) if pd.notna(v) else "") for k, v in row.items()}
            rows.append(row_dict)
            
        sheets_data.append({
            "name": sheet_name,
            "headers": headers,
            "rows": rows[:100]  # 最多保留100行
        })
        
        text_summary.append(f"### Sheet: {sheet_name}\n" + df.to_markdown(index=False))

    return {
        "file_type": "excel",
        "filename": os.path.basename(file_path),
        "full_text": "\n\n".join(text_summary),
        "tables": sheets_data
    }

def parse_docx(file_path):
    doc = docx.Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    
    tables_data = []
    text_tables = []
    
    for idx, table in enumerate(doc.tables):
        rows_raw = []
        for row in table.rows:
            rows_raw.append([cell.text.strip() for cell in row.cells])
        if not rows_raw:
            continue
            
        headers = rows_raw[0]
        data_rows = []
        for r in rows_raw[1:]:
            row_dict = {}
            for col_idx, val in enumerate(r):
                header_name = headers[col_idx] if col_idx < len(headers) else f"Col_{col_idx}"
                row_dict[header_name] = val
            data_rows.append(row_dict)
            
        tables_data.append({
            "name": f"Table_{idx+1}",
            "headers": headers,
            "rows": data_rows
        })
        
        # 格式化表格文本
        t_lines = [" | ".join(headers), " | ".join(["---"] * len(headers))]
        for r in rows_raw[1:]:
            t_lines.append(" | ".join(r))
        text_tables.append(f"### 表格 {idx+1}:\n" + "\n".join(t_lines))

    full_text = "\n\n".join(paragraphs)
    if text_tables:
        full_text += "\n\n" + "\n\n".join(text_tables)

    return {
        "file_type": "docx",
        "filename": os.path.basename(file_path),
        "full_text": full_text,
        "tables": tables_data
    }

def parse_doc(file_path):
    """对于旧版 .doc 二进制文件，在 macOS 下调用 textutil 转换"""
    try:
        res = subprocess.run(["textutil", "-convert", "txt", file_path, "-stdout"],
                             capture_output=True, text=True, check=True)
        return {
            "file_type": "doc",
            "filename": os.path.basename(file_path),
            "full_text": res.stdout,
            "tables": []
        }
    except Exception as e:
        return {
            "file_type": "doc",
            "filename": os.path.basename(file_path),
            "full_text": f"解析旧版 .doc 失败: {e}",
            "tables": []
        }

def parse_pdf(file_path):
    import re
    doc = fitz.open(file_path)
    total_pages = len(doc)
    pages_text = []
    page_map = {}
    for page_num in range(total_pages):
        page = doc[page_num]
        txt = page.get_text().strip()
        page_map[page_num + 1] = txt
        if txt:
            pages_text.append(f"--- Page {page_num+1} ---\n{txt}")

    raw_toc = []
    try:
        raw_toc = doc.get_toc() or []
    except Exception:
        raw_toc = []

    toc_chapters = []
    if raw_toc:
        # 优先寻找“第X章 / Chapter X / 附录”主章节节点；若无则取非小节号的最高层级书签
        chapter_nodes = []
        lvl1_nodes = []
        for idx, item in enumerate(raw_toc):
            if len(item) < 3:
                continue
            lvl, title, pno = int(item[0]), str(item[1]).strip(), max(1, int(item[2]))
            if title in ("封面", "书名页", "版权", "版权页", "目录", "目 录"):
                continue
            is_chapter = bool(re.match(r"^(第\s*[0-9一二三四五六七八九十百]+\s*[章篇部]|Chapter\s+\d+|附录|前\s*言|绪\s*论|参考文献)", title, re.I))
            is_sub_numbered = bool(re.match(r"^\d+\.\d+", title))
            node_obj = {"idx": idx, "level": lvl, "title": title, "start_page": pno}
            if is_chapter:
                chapter_nodes.append(node_obj)
            elif lvl == 1 and not is_sub_numbered:
                lvl1_nodes.append(node_obj)

        filtered_nodes = chapter_nodes if len(chapter_nodes) >= 2 else lvl1_nodes

        if filtered_nodes:
            for i, node in enumerate(filtered_nodes):
                start_p = node["start_page"]
                end_p = (filtered_nodes[i + 1]["start_page"] - 1) if (i + 1 < len(filtered_nodes)) else total_pages
                if end_p < start_p:
                    end_p = start_p
                # 收集该章下的子节标题
                next_raw_idx = filtered_nodes[i + 1]["idx"] if (i + 1 < len(filtered_nodes)) else len(raw_toc)
                sub_sections = []
                for sub in raw_toc[node["idx"] + 1 : next_raw_idx]:
                    if len(sub) >= 3:
                        sub_sections.append(f"{sub[1].strip()} (P.{sub[2]})")
                ch_pages = []
                for p in range(start_p, min(end_p, total_pages) + 1):
                    ptxt = page_map.get(p, "")
                    if ptxt:
                        ch_pages.append(f"[Page {p}]\n{ptxt}")
                ch_body = "\n\n".join(ch_pages)
                if ch_body.strip():
                    header_meta = f"章节页码范围: 第 {start_p} 页 ~ 第 {end_p} 页 (共 {end_p - start_p + 1} 页)\n"
                    if sub_sections:
                        header_meta += "包含小节: " + " | ".join(sub_sections[:25]) + "\n\n"
                    toc_chapters.append({
                        "title": f"{node['title']} (P.{start_p}-{end_p})",
                        "raw_title": node["title"],
                        "start_page": start_p,
                        "end_page": end_p,
                        "sub_sections": sub_sections,
                        "content": header_meta + ch_body
                    })

    return {
        "file_type": "pdf",
        "filename": os.path.basename(file_path),
        "total_pages": total_pages,
        "toc": raw_toc,
        "toc_chapters": toc_chapters,
        "full_text": "\n\n".join(pages_text),
        "tables": []
    }

def parse_text(file_path):
    with open(file_path, "r", encoding="utf8", errors="ignore") as f:
        content = f.read()
    return {
        "file_type": "text",
        "filename": os.path.basename(file_path),
        "full_text": content,
        "tables": []
    }

def parse_document(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")
        
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".xlsx", ".xls"):
        return parse_excel(file_path)
    elif ext == ".docx":
        return parse_docx(file_path)
    elif ext == ".doc":
        return parse_doc(file_path)
    elif ext == ".pdf":
        return parse_pdf(file_path)
    elif ext in (".md", ".txt", ".csv", ".json"):
        return parse_text(file_path)
    else:
        # 兜底纯文本读取
        return parse_text(file_path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        res = parse_document(sys.argv[1])
        print(f"解析成功: {res['filename']} ({res['file_type']})")
        print(f"文本长度: {len(res['full_text'])} 字符 | 提取表格数: {len(res['tables'])}")
        print("\n--- 文本预览前 500 字 ---")
        print(res["full_text"][:500])
