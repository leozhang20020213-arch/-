from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(r"D:\trpg\大梁武侠")
REVIEW_OUTPUT = ROOT / "review_output"
WORK_LOGS = ROOT / "work_logs"

DOCX_TARGETS = [
    ("player_rulebook", "玩家规则书", "大梁武侠TRPG_玩家规则书_完整整合版_v0.41.docx"),
    ("dm_rulebook", "DM规则书", "大梁武侠TRPG_DM规则书_完整整合版_v0.41.docx"),
]

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
MAX_CHARS = 3000


@dataclass
class Paragraph:
    index: int
    text: str
    style: str


def find_exact(filename: str) -> Path | None:
    for path in ROOT.rglob(filename):
        if "__pycache__" in path.parts or ".git" in path.parts:
            continue
        if path.is_file():
            return path
    return None


def text_from_paragraph(paragraph: ET.Element) -> str:
    pieces: list[str] = []
    for node in paragraph.iter():
        if node.tag == f"{{{NS['w']}}}t" and node.text:
            pieces.append(node.text)
        elif node.tag == f"{{{NS['w']}}}tab":
            pieces.append("\t")
        elif node.tag == f"{{{NS['w']}}}br":
            pieces.append("\n")
    return "".join(pieces).strip()


def style_from_paragraph(paragraph: ET.Element) -> str:
    p_style = paragraph.find("./w:pPr/w:pStyle", NS)
    if p_style is None:
        return ""
    return p_style.attrib.get(f"{{{NS['w']}}}val", "")


def read_docx_paragraphs(path: Path) -> list[Paragraph]:
    with zipfile.ZipFile(path) as docx:
        xml = docx.read("word/document.xml")
    root = ET.fromstring(xml)
    paragraphs: list[Paragraph] = []
    for idx, p in enumerate(root.findall(".//w:p", NS), start=1):
        text = text_from_paragraph(p)
        if not text:
            continue
        paragraphs.append(Paragraph(index=idx, text=text, style=style_from_paragraph(p)))
    return paragraphs


def looks_like_heading(p: Paragraph) -> bool:
    text = p.text.strip()
    style = p.style.lower()
    if "heading" in style or style in {"1", "2", "3"}:
        return True
    if re.match(r"^第[一二三四五六七八九十百零〇0-9]+[章节卷部篇幕]\b", text):
        return True
    if re.match(r"^[一二三四五六七八九十]+[、.．]\s*\S+", text) and len(text) <= 40:
        return True
    if re.match(r"^\d+(\.\d+){0,3}[、.．]\s*\S+", text) and len(text) <= 60:
        return True
    if len(text) <= 24 and any(key in text for key in ["开卡", "检定", "战斗", "情景", "休整", "武学", "内功", "装备", "DM", "敌人", "剧本"]):
        return True
    return False


def chunk_paragraphs(paragraphs: list[Paragraph], source_key: str, source_label: str, source_path: Path) -> list[dict[str, object]]:
    chunks: list[dict[str, object]] = []
    current_title = "未识别章节"
    buffer: list[str] = []
    start_index: int | None = None
    end_index: int | None = None

    def flush() -> None:
        nonlocal buffer, start_index, end_index
        if not buffer or start_index is None or end_index is None:
            buffer = []
            start_index = None
            end_index = None
            return
        text = "\n".join(buffer).strip()
        if not text:
            buffer = []
            start_index = None
            end_index = None
            return
        chunks.append(
            {
                "chunk_id": f"{source_key}-{len(chunks) + 1:04d}",
                "source_type": source_label,
                "source_file": str(source_path),
                "chapter_or_heading": current_title,
                "position": {
                    "paragraph_start": start_index,
                    "paragraph_end": end_index,
                },
                "char_count": len(text),
                "text": text,
                "confidence": "中",
                "limitations": "DOCX未提供稳定页码；位置以段落序号记录。岁月与生成数据库缺失不影响本规则书切块，但会影响后续长团验证。",
            }
        )
        buffer = []
        start_index = None
        end_index = None

    for paragraph in paragraphs:
        is_heading = looks_like_heading(paragraph)
        candidate_len = sum(len(item) for item in buffer) + len(paragraph.text)
        if is_heading and buffer:
            flush()
            current_title = paragraph.text
        elif is_heading:
            current_title = paragraph.text

        if start_index is None:
            start_index = paragraph.index
        buffer.append(paragraph.text)
        end_index = paragraph.index

        if candidate_len >= MAX_CHARS:
            flush()

    flush()
    return chunks


def main() -> None:
    REVIEW_OUTPUT.mkdir(exist_ok=True)
    WORK_LOGS.mkdir(exist_ok=True)

    all_chunks: list[dict[str, object]] = []
    inventory: list[dict[str, object]] = []

    for source_key, source_label, filename in DOCX_TARGETS:
        path = find_exact(filename)
        if path is None:
            inventory.append({"source_type": source_label, "filename": filename, "status": "missing"})
            continue
        paragraphs = read_docx_paragraphs(path)
        chunks = chunk_paragraphs(paragraphs, source_key, source_label, path)
        inventory.append(
            {
                "source_type": source_label,
                "filename": filename,
                "status": "found",
                "path": str(path),
                "paragraphs": len(paragraphs),
                "chunks": len(chunks),
                "chars": sum(len(p.text) for p in paragraphs),
            }
        )
        all_chunks.extend(chunks)

    output_path = REVIEW_OUTPUT / "01_chapter_chunks.jsonl"
    with output_path.open("w", encoding="utf-8") as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")

    summary_path = WORK_LOGS / "b01_chapter_chunks_summary.md"
    lines = [
        "# B01 章节切块摘要",
        "",
        "生成时间：2026-06-11 01:33 Asia/Shanghai",
        "",
        "## 输入文件",
        "",
        "| 类型 | 状态 | 段落数 | 切块数 | 字符数 | 路径 |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for item in inventory:
        lines.append(
            f"| {item['source_type']} | {item['status']} | {item.get('paragraphs', 0)} | {item.get('chunks', 0)} | {item.get('chars', 0)} | `{item.get('path', item['filename'])}` |"
        )
    lines.extend(
        [
            "",
            "## 输出",
            "",
            f"- JSONL：`{output_path}`",
            f"- 切块总数：{len(all_chunks)}",
            "",
            "## 限制",
            "",
            "- DOCX 未提供稳定页码，本轮使用段落序号作为证据位置。",
            "- 本轮只完成章节文本切块，不进行 Rule_ID 映射、冲突判断或规则修改。",
            "- 岁月与生成数据库仍缺失，后续长团、年龄、家庭、弟子、产业相关结论继续标为限制性。",
        ]
    )
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(output_path)
    print(summary_path)
    print(json.dumps({"inventory": inventory, "chunk_count": len(all_chunks)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
