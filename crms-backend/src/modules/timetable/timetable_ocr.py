#!/usr/bin/env python3
"""
timetable_ocr.py - Extract structured data from timetable-style documents.
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import re
import statistics
import sys
from pathlib import Path

import numpy as np

IMG_EXT = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
TIME_RE = re.compile(r"(\d{1,2})\s*[.:]\s*(\d{2})\s*([AP])\.?\s*M", re.I)

# --------------------------------------------------------------------------- helpers
def clean(t: str) -> str:
    t = re.sub(r"[£€](?=\d)", "E", str(t))
    return re.sub(r"\s+", " ", t.replace("|", " ")).strip()

def _cluster(vals, tol):
    if not vals: return []
    vals = sorted(vals)
    groups = [[vals[0]]]
    for v in vals[1:]:
        if v - groups[-1][-1] <= tol:
            groups[-1].append(v)
        else:
            groups.append([v])
    return [sum(g) / len(g) for g in groups]

def boxes_to_grid(boxes, tol):
    if not boxes: return []
    xs = _cluster([b[0] for b in boxes] + [b[2] for b in boxes], tol)
    ys = _cluster([b[1] for b in boxes] + [b[3] for b in boxes], tol)

    def near(edges, v):
        return min(range(len(edges)), key=lambda i: abs(edges[i] - v))

    grid = []
    for x0, y0, x1, y1, t in boxes:
        c0, c1, r0, r1 = near(xs, x0), near(xs, x1), near(ys, y0), near(ys, y1)
        grid.append(dict(r0=r0, r1=max(r1, r0 + 1), c0=c0, c1=max(c1, c0 + 1), text=t))
    return grid

def words_to_lines(words, gap_factor=1.5):
    if not words: return []
    words = sorted(words, key=lambda w: (w["y0"] + w["y1"]) / 2)
    lines = []
    for w in words:
        yc, h = (w["y0"] + w["y1"]) / 2, w["y1"] - w["y0"]
        if lines and abs(yc - lines[-1]["yc"]) < 0.6 * max(h, lines[-1]["h"]):
            ln = lines[-1]
            ln["w"].append(w)
            ln["yc"] = (ln["yc"] * (len(ln["w"]) - 1) + yc) / len(ln["w"])
            ln["h"] = max(ln["h"], h)
        else:
            lines.append(dict(w=[w], yc=yc, h=h))
    out = []
    for ln in lines:
        ws = sorted(ln["w"], key=lambda w: w["x0"])
        gap = gap_factor * statistics.median(w["y1"] - w["y0"] for w in ws)
        segs, cur = [], [ws[0]]
        for a, b in zip(ws, ws[1:]):
            if b["x0"] - a["x1"] > gap:
                segs.append(cur)
                cur = [b]
            else:
                cur.append(b)
        segs.append(cur)
        out.append([clean(" ".join(w["text"] for w in s)) for s in segs])
    return out

def parse_lines(lines):
    meta, titles, other = {}, [], []
    for segs in lines:
        i = 0
        while i < len(segs):
            s = segs[i]
            m = re.match(r"^([^:]{2,40}?)\s*:\s*(.*)$", s)
            if m:
                k, v = m.group(1).strip(), m.group(2).strip()
                if not v and i + 1 < len(segs) and ":" not in segs[i + 1]:
                    v = segs[i + 1]
                    i += 1
                meta[k] = v
            elif s:
                (titles if len(segs) == 1 else other).append(s)
            i += 1
    return meta, titles, other

def _fmt_time(m):
    return f"{int(m[0])}:{m[1]} {m[2].upper()}M"

def _infer_missing_periods(hdr):
    i = 0
    while i < len(hdr):
        if hdr[i]["period"] is None:
            j = i
            while j < len(hdr) and hdr[j]["period"] is None:
                j += 1
            prev = hdr[i - 1]["period"] if i > 0 else 0
            nxt = hdr[j]["period"] if j < len(hdr) else None
            n = j - i
            if nxt is not None and nxt - prev - 1 >= n:
                for k in range(i, j):
                    hdr[k]["period"], hdr[k]["is_break"] = prev + 1 + (k - i), False
        i = max(i + 1, 0) if hdr[i]["period"] is not None else j
    for a, b in zip(hdr, hdr[1:]):
        if not a["end"]:
            a["end"] = b["start"]

def parse_timetable(cells):
    hdr = []
    for c in cells:
        times = TIME_RE.findall(c["text"])
        if times:
            rest = TIME_RE.sub(" ", c["text"])
            p = re.findall(r"\b(\d{1,2})\b", rest)
            hdr.append(dict(c0=c["c0"], c1=c["c1"], r0=c["r0"], r1=c["r1"],
                            period=int(p[-1]) if p else None,
                            start=_fmt_time(times[0]), end=_fmt_time(times[-1]) if len(times) > 1 else "",
                            is_break=not p))
    if len(hdr) < 3:
        return None
    hdr_r0 = min(h["r0"] for h in hdr)
    hdr = sorted([h for h in hdr if h["r0"] == hdr_r0], key=lambda h: h["c0"])
    _infer_missing_periods(hdr)
    min_c0 = min(h["c0"] for h in hdr)

    day_cells = []
    for c in cells:
        if c["c1"] <= min_c0 and c["r0"] > hdr_r0:
            m = difflib.get_close_matches(c["text"].strip().lower(), DAYS, n=1, cutoff=0.6)
            if m:
                day_cells.append((m[0].capitalize(), c))
    if len(day_cells) < 2:
        return None

    days = {}
    for name, d in sorted(day_cells, key=lambda x: x[1]["r0"]):
        entries = []
        for c in sorted(cells, key=lambda c: c["c0"]):
            if c["c0"] < min_c0 or not (c["r0"] < d["r1"] and c["r1"] > d["r0"]):
                continue
            cols = [h for h in hdr if h["c0"] < c["c1"] and h["c1"] > c["c0"]]
            per = [h for h in cols if not h["is_break"]]
            if not per or not c["text"].strip():
                continue
            entries.append(dict(periods=[h["period"] for h in per], start=per[0]["start"],
                                end=per[-1]["end"], subject=c["text"].strip(),
                                _c0=per[0]["c0"], _c1=per[-1]["c1"]))
        days[name] = entries

    return dict(
        columns=[dict(period=h["period"], start=h["start"], end=h["end"], is_break=h["is_break"],
                      _c0=h["c0"], _c1=h["c1"]) for h in hdr],
        days=days, _header_r0=hdr_r0, _last_r1=max(d["r1"] for _, d in day_cells))

def _is_coordinator_header(text):
    t = re.sub(r"[^a-z ]", "", text.lower())
    if re.search(r"coordinator|faculty", t):
        return True
    sim = lambda ref: difflib.SequenceMatcher(None, t, ref).ratio()
    return sim("name of the course coordinator faculty") > max(0.5, sim("name of the course short name") + 0.05)

def parse_courses(cells):
    h0 = next((c for c in cells if re.search(r"course\s*code", c["text"], re.I)), None)
    if not h0:
        return None
    hdr = sorted([c for c in cells if c["r0"] == h0["r0"]], key=lambda c: c["c0"])
    names, seen = [], {}
    for h in hdr:
        n = h["text"] or f"col_{h['c0']}"
        seen[n] = seen.get(n, 0) + 1
        names.append(n if seen[n] == 1 else f"{n} ({seen[n]})")

    def header_for(c):
        best = max(range(len(hdr)), key=lambda i: min(c["c1"], hdr[i]["c1"]) - max(c["c0"], hdr[i]["c0"]))
        return best

    group_of, g = {}, 0
    for i, h in enumerate(hdr):
        group_of[i] = g
        if _is_coordinator_header(h["text"]):
            g += 1
    n_groups = max(group_of.values()) + 1
    tables = [[] for _ in range(n_groups)]

    rows = sorted({c["r0"] for c in cells if c["r0"] >= h0["r1"]})
    for r in rows:
        recs = [dict() for _ in range(n_groups)]
        for c in cells:
            if c["r0"] == r and c["text"].strip():
                i = header_for(c)
                recs[group_of[i]][names[i]] = c["text"].strip()
        for gi, rec in enumerate(recs):
            if rec:
                tables[gi].append(rec)
    return dict(tables=[t for t in tables if t], _header_r0=h0["r0"])

def snap_to_known(text, known, cutoff=0.8):
    parts = [p.strip() for p in re.split(r"\s*/\s*", text) if p.strip()]
    out = []
    for p in parts:
        u = p.upper()
        if u in known:
            out.append(p)
        elif len(u) <= 2:
            m = [k for k in known if len(k) == len(u) and sum(a != b for a, b in zip(k, u)) <= 1]
            out.append(m[0] if len(m) == 1 else p)
        else:
            m = difflib.get_close_matches(u, sorted(known), n=1, cutoff=cutoff)
            out.append(m[0] if m else p)
    return out

def cells_to_text_lines(cells):
    rows = {}
    for c in cells:
        rows.setdefault(c["r0"], []).append(c)
    return [[clean(c["text"]) for c in sorted(v, key=lambda c: c["c0"]) if c["text"].strip()]
            for _, v in sorted(rows.items())]

def cells_to_matrix(cells):
    if not cells:
        return []
    nr, nc = max(c["r1"] for c in cells), max(c["c1"] for c in cells)
    m = [[""] * nc for _ in range(nr)]
    for c in cells:
        for r in range(c["r0"], c["r1"]):
            for k in range(c["c0"], c["c1"]):
                m[r][k] = c["text"]
    return [row for row in m if any(row)]

def process_page(source, page, blocks, text_lines, excel_like=False):
    res = dict(source=source, page=page, titles=[], metadata={}, other_text=[],
               timetables=[], course_tables=[], other_tables=[])
    lines = list(text_lines)
    queue = list(blocks)
    known = set()
    while queue:
        blk = queue.pop(0)
        tt = parse_timetable(blk)
        ct = None if tt else parse_courses(blk)
        found = tt or ct
        if found:
            hr = found["_header_r0"]
            lines += cells_to_text_lines([c for c in blk if c["r1"] <= hr])
            if tt:
                res["timetables"].append(tt)
                queue.append([c for c in blk if c["r0"] >= tt["_last_r1"]])
            else:
                res["course_tables"].append(ct)
        elif blk:
            few = max(len(r) for r in cells_to_text_lines(blk)) <= 4 and len({c["r0"] for c in blk}) <= 8
            if excel_like and few:
                lines += cells_to_text_lines(blk)
            else:
                res["other_tables"].append(cells_to_matrix(blk))

    for ct in res["course_tables"]:
        for gi, tbl in enumerate(ct["tables"]):
            for rec in tbl:
                for k, v in rec.items():
                    if gi == 0:
                        m = re.search(r"\(([A-Za-z0-9 &/\-]{2,25})\)\s*$", v)
                        if m:
                            known.add(m.group(1).strip().upper())
                        if re.search(r"course", k, re.I) and "code" not in k.lower():
                            words = [w for w in re.sub(r"\(.*?\)", "", v).split()
                                     if w.lower() not in {"and", "of", "the", "for", "&"}]
                            if 2 <= len(words) <= 4:
                                known.add("".join(w[0] for w in words).upper())
                    elif re.search(r"categor|activity|course", k, re.I):
                        known.update(p.strip().upper() for p in re.split(r"/", v) if p.strip())
    for tt in res["timetables"]:
        for entries in tt["days"].values():
            for e in entries:
                raw = e["subject"]
                opts = snap_to_known(raw, known) if known else [p.strip() for p in raw.split("/")]
                opts = [o.upper() if len(o) <= 4 and o.isalpha() and o.upper() not in known and known else o
                        for o in opts]
                e["options"] = opts
                e["subject"] = " / ".join(opts)
                if e["subject"].replace(" ", "") != raw.replace(" ", ""):
                    e["raw_ocr"] = raw

    meta, titles, other = parse_lines(lines)
    res.update(metadata=meta, titles=titles, other_text=other)
    return res

def _check_tesseract():
    import pytesseract
    return pytesseract

def _ocr_cell(gray, box, lang, psm):
    import cv2
    pytesseract = _check_tesseract()
    x0, y0, x1, y1 = box
    pad = 3
    crop = gray[y0 + pad:y1 - pad, x0 + pad:x1 - pad]
    if crop.size == 0 or (crop < 140).mean() < 0.004:
        return ""

    def run(img, p):
        img = cv2.copyMakeBorder(img, 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=255)
        d = pytesseract.image_to_data(img, lang=lang, config=f"--psm {p}", output_type=pytesseract.Output.DICT)
        idx = [i for i, t in enumerate(d["text"]) if t.strip() and float(d["conf"][i]) >= 0]
        if not idx:
            return "", 0.0
        conf = sum(float(d["conf"][i]) for i in idx) / len(idx)
        rows = {}
        for i in idx:
            rows.setdefault((d["block_num"][i], d["par_num"][i], d["line_num"][i]), []).append(d["text"][i])
        lines = [" ".join(v) for v in rows.values()]
        if len(lines) >= 3 and all(len(l) <= 1 for l in lines):
            return "".join(lines), conf
        return clean(" ".join(lines)), conf

    def scaled(target):
        f = min(4.0, target / crop.shape[0])
        return cv2.resize(crop, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC) if f > 1 else crop

    attempts = [(scaled(90), psm)]
    best_t, best_c = "", -1.0
    for n, (img, p) in enumerate(attempts):
        t, c = run(img, p)
        if c > best_c:
            best_t, best_c = t, c
    if best_c < 80:
        for target in (150, 220):
            big = scaled(target)
            sharp = cv2.threshold(cv2.GaussianBlur(big, (3, 3), 0), 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            for img, p in ((big, psm), (sharp, psm), (sharp, 7)):
                t, c = run(img, p)
                if c > best_c:
                    best_t, best_c = t, c
            if best_c >= 85:
                break
    return best_t

def ocr_image(gray, lang="eng", psm=6, debug_path=None):
    import cv2
    pytesseract = _check_tesseract()

    H, W = gray.shape
    if W < 2000:
        f = min(4.0, 2000 / W)
        gray = cv2.resize(gray, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
        H, W = gray.shape

    bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    hor = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, W // 60), 1)))
    ver = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(15, W // 80))))
    lines = cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((3, 3), np.uint8))

    n, _, stats, _ = cv2.connectedComponentsWithStats(lines, connectivity=8)
    tables = [tuple(stats[i][:4]) for i in range(1, n) if stats[i][2] > 0.15 * W and stats[i][3] > 0.04 * H]
    tables.sort(key=lambda t: t[1])

    cnts, hier = cv2.findContours(cv2.bitwise_not(lines), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    cell_boxes = []
    if hier is not None:
        for c, hh in zip(cnts, hier[0]):
            if hh[3] != -1:
                continue
            x, y, w, h = cv2.boundingRect(c)
            if w < 0.012 * W or h < 0.008 * H or w > 0.95 * W or h > 0.6 * H:
                continue
            if cv2.contourArea(c) / (w * h) < 0.7:
                continue
            cell_boxes.append((x, y, x + w, y + h))

    blocks = []
    for tx, ty, tw, th in tables:
        inside = [b for b in cell_boxes
                  if tx - 5 <= (b[0] + b[2]) / 2 <= tx + tw + 5 and ty - 5 <= (b[1] + b[3]) / 2 <= ty + th + 5]
        if not inside:
            continue
        boxes = [(*b, _ocr_cell(gray, b, lang, psm)) for b in inside]
        blocks.append(boxes_to_grid(boxes, tol=max(4, W // 200)))

    masked = gray.copy()
    for tx, ty, tw, th in tables:
        cv2.rectangle(masked, (tx - 4, ty - 4), (tx + tw + 4, ty + th + 4), 255, -1)
    masked = cv2.resize(masked, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
    d = pytesseract.image_to_data(masked, lang=lang, config="--psm 11", output_type=pytesseract.Output.DICT)
    words = [dict(text=d["text"][i], x0=d["left"][i], x1=d["left"][i] + d["width"][i],
                  y0=d["top"][i], y1=d["top"][i] + d["height"][i])
             for i in range(len(d["text"])) if d["text"][i].strip() and float(d["conf"][i]) > 20]
    return blocks, (words_to_lines(words) if words else [])

def read_image(path, opts):
    import cv2
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        sys.exit(f"Cannot read image: {path}")
    blocks, lines = ocr_image(img, opts.lang, opts.psm)
    return [process_page(path.name, 1, blocks, lines)]

def read_pdf(path, opts):
    import pdfplumber
    results = []
    with pdfplumber.open(str(path)) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            blocks, lines = [], []
            if len((page.extract_text() or "").strip()) > 20:
                tables = page.find_tables()
                bboxes = [t.bbox for t in tables]
                for t in tables:
                    boxes = []
                    for x0, y0, x1, y1 in t.cells:
                        bb = (max(x0, page.bbox[0]), max(y0, page.bbox[1]), min(x1, page.bbox[2]), min(y1, page.bbox[3]))
                        txt = clean(page.within_bbox(bb).extract_text() or "")
                        boxes.append((*bb, txt))
                    if boxes:
                        blocks.append(boxes_to_grid(boxes, tol=2.0))
                def outside(o):
                    if o.get("object_type") != "char": return True
                    cx, cy = (o["x0"] + o["x1"]) / 2, (o["top"] + o["bottom"]) / 2
                    return not any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in bboxes)
                ws = page.filter(outside).extract_words(x_tolerance=1.5)
                words = [dict(text=w["text"], x0=w["x0"], x1=w["x1"], y0=w["top"], y1=w["bottom"]) for w in ws]
                lines = words_to_lines(words) if words else []
            if not blocks:
                import pypdfium2 as pdfium
                doc = pdfium.PdfDocument(str(path))
                img = np.array(doc[pno - 1].render(scale=300 / 72).to_pil().convert("L"))
                blocks, lines = ocr_image(img, opts.lang, opts.psm)
            results.append(process_page(path.name, pno, blocks, lines))
    return results

def _rows_to_cells(rows, merged=None):
    cells = []
    covered, anchors = set(), {}
    for rng in merged or []:
        anchors[(rng.min_row, rng.min_col)] = rng
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                covered.add((r, c))
    for r, row in enumerate(rows, 1):
        for c, v in enumerate(row, 1):
            if (r, c) in anchors:
                g = anchors[(r, c)]
                r1, c1 = g.max_row + 1, g.max_col + 1
            elif (r, c) in covered or v is None or str(v).strip() == "":
                continue
            else:
                r1, c1 = r + 1, c + 1
            cells.append(dict(r0=r, r1=r1, c0=c, c1=c1, text=clean(v if v is not None else "")))
    return cells

def _split_blocks(cells):
    occ = sorted({r for c in cells for r in range(c["r0"], c["r1"])})
    blocks, cur, prev = [], set(), None
    for r in occ:
        if prev is not None and r > prev + 1:
            blocks.append(cur)
            cur = set()
        cur.add(r)
        prev = r
    if cur:
        blocks.append(cur)
    return [[c for c in cells if c["r0"] in rs] for rs in blocks]

def read_excel(path, opts):
    import openpyxl
    wb = openpyxl.load_workbook(str(path), data_only=True)
    out = []
    for i, ws in enumerate(wb.worksheets, 1):
        rows = [[c.value for c in row] for row in ws.iter_rows()]
        cells = _rows_to_cells(rows, ws.merged_cells.ranges)
        if cells:
            r = process_page(f"{path.name}:{ws.title}", i, _split_blocks(cells), [], excel_like=True)
            out.append(r)
    return out

def read_csv(path, opts):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    cells = _rows_to_cells(rows)
    return [process_page(path.name, 1, _split_blocks(cells), [], excel_like=True)]

def extract(path: Path, opts):
    ext = path.suffix.lower()
    if ext in IMG_EXT: return read_image(path, opts)
    if ext == ".pdf": return read_pdf(path, opts)
    if ext in (".xlsx", ".xlsm"): return read_excel(path, opts)
    if ext == ".csv": return read_csv(path, opts)
    sys.exit(f"Unsupported file type: {ext}")

def _strip_private(o):
    if isinstance(o, dict):
        return {k: _strip_private(v) for k, v in o.items() if not k.startswith("_")}
    if isinstance(o, list):
        return [_strip_private(v) for v in o]
    return o

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("-o", "--out", default="ocr_output")
    ap.add_argument("--lang", default="eng")
    ap.add_argument("--psm", type=int, default=6)
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--print", action="store_true")
    opts = ap.parse_args()

    for f in opts.inputs:
        p = Path(f)
        if not p.exists(): continue
        results = extract(p, opts)
        clean_res = _strip_private(results)
        if opts.print:
            print(json.dumps(clean_res, ensure_ascii=False))

if __name__ == "__main__":
    main()
