"""
Build TenderOptima 30–40s product promo from landing media.

Outputs:
  services/frontend/public/landing/promo/tenderoptima-promo-16x9.mp4
  services/frontend/public/landing/promo/tenderoptima-promo-9x16.mp4

Run:
  python marketing/promo/build_promo_video.py
  python marketing/promo/build_promo_video.py --aspect 16x9
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from moviepy import (
	CompositeVideoClip,
	ImageClip,
	ImageSequenceClip,
	VideoFileClip,
	concatenate_videoclips,
	vfx,
)
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "services" / "frontend" / "public" / "landing"
OUT_DIR = LANDING / "promo"
CACHE = Path(__file__).resolve().parent / "_frames"

# Design system (MASTER.md)
PRIMARY = (15, 23, 42)  # #0F172A
SECONDARY = (51, 65, 85)  # #334155
CTA = (3, 105, 161)  # #0369A1
BG = (248, 250, 252)  # #F8FAFC
TEXT = (2, 6, 23)  # #020617
WHITE = (255, 255, 255)
SLATE_200 = (226, 232, 240)
SLATE_100 = (241, 245, 249)
AMBER = (180, 83, 9)

FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")
FPS = 30


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
	path = FONT_BOLD if bold else FONT_REG
	return ImageFont.truetype(str(path), size)


def wrap_text(
	draw: ImageDraw.ImageDraw,
	text: str,
	fnt: ImageFont.FreeTypeFont,
	max_width: int,
) -> list[str]:
	words = text.split()
	lines: list[str] = []
	current = ""
	for word in words:
		trial = f"{current} {word}".strip()
		if draw.textlength(trial, font=fnt) <= max_width:
			current = trial
		else:
			if current:
				lines.append(current)
			current = word
	if current:
		lines.append(current)
	return lines or [text]


def rounded_rect(
	draw: ImageDraw.ImageDraw,
	xy: tuple[int, int, int, int],
	radius: int,
	fill: tuple[int, ...],
	outline: tuple[int, ...] | None = None,
	width: int = 1,
) -> None:
	draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def fit_contain(
	img: Image.Image,
	box: tuple[int, int],
	bg: tuple[int, int, int] = BG,
) -> Image.Image:
	"""Scale image to fit inside box, letterbox with bg."""
	bw, bh = box
	canvas = Image.new("RGB", (bw, bh), bg)
	src = img.convert("RGBA")
	scale = min(bw / src.width, bh / src.height)
	nw, nh = max(1, int(src.width * scale)), max(1, int(src.height * scale))
	resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
	x = (bw - nw) // 2
	y = (bh - nh) // 2
	canvas.paste(resized, (x, y), resized if resized.mode == "RGBA" else None)
	return canvas


def fit_cover(img: Image.Image, box: tuple[int, int]) -> Image.Image:
	bw, bh = box
	src = img.convert("RGB")
	scale = max(bw / src.width, bh / src.height)
	nw, nh = math.ceil(src.width * scale), math.ceil(src.height * scale)
	resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
	x = (nw - bw) // 2
	y = (nh - bh) // 2
	return resized.crop((x, y, x + bw, y + bh))


def draw_logo(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> int:
	"""Draw TenderOptima wordmark. Returns width."""
	f_tender = font(size, bold=True)
	f_optima = font(size, bold=False)
	draw.text((x, y), "Tender", font=f_tender, fill=PRIMARY)
	w1 = int(draw.textlength("Tender", font=f_tender))
	draw.text((x + w1, y), "Optima", font=f_optima, fill=CTA)
	w2 = int(draw.textlength("Optima", font=f_optima))
	return w1 + w2


def make_caption_bar(
	width: int,
	height: int,
	caption: str,
	*,
	bar_h: int | None = None,
) -> Image.Image:
	"""Bottom caption bar — readable without audio."""
	bar_h = bar_h or max(120, height // 6)
	overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
	draw = ImageDraw.Draw(overlay)
	y0 = height - bar_h
	draw.rectangle((0, y0, width, height), fill=(15, 23, 42, 210))
	# Accent line
	draw.rectangle((0, y0, width, y0 + 4), fill=(*CTA, 255))

	fnt = font(max(28, width // 42), bold=True)
	pad_x = width // 24
	lines = wrap_text(draw, caption, fnt, width - 2 * pad_x)
	line_h = int(fnt.size * 1.35)
	total_h = line_h * len(lines)
	ty = y0 + (bar_h - total_h) // 2
	for i, line in enumerate(lines):
		lw = int(draw.textlength(line, font=fnt))
		draw.text(((width - lw) // 2, ty + i * line_h), line, font=fnt, fill=WHITE)
	return overlay


def frame_opening(size: tuple[int, int]) -> Image.Image:
	w, h = size
	portrait = h > w
	img = Image.new("RGB", size, BG)
	draw = ImageDraw.Draw(img)

	for i in range(h):
		t = i / h
		r = int(BG[0] + (PRIMARY[0] - BG[0]) * t * 0.08)
		g = int(BG[1] + (PRIMARY[1] - BG[1]) * t * 0.08)
		b = int(BG[2] + (PRIMARY[2] - BG[2]) * t * 0.08)
		draw.line([(0, i), (w, i)], fill=(r, g, b))

	chaos_items = [
		("Excel-таблицы", "Ручной сбор предложений"),
		("Письма в почте", "Переписка разбросана"),
		("Сверка вручную", "Часы на каждый тендер"),
	]

	title_f = font(max(22, w // 22 if portrait else w // 55), bold=True)
	title = "Закупки сегодня"
	tw = int(draw.textlength(title, font=title_f))

	if portrait:
		card_w = w - 80
		card_h = 110
		gap = 16
		cy = 160
		draw.text(((w - tw) // 2, 100), title, font=title_f, fill=AMBER)
		for i, (head, sub) in enumerate(chaos_items):
			x = 40
			y = cy + i * (card_h + gap)
			rounded_rect(
				draw,
				(x, y, x + card_w, y + card_h),
				16,
				WHITE,
				outline=SLATE_200,
				width=2,
			)
			draw.rectangle((x, y, x + 6, y + card_h), fill=AMBER)
			hf = font(max(22, w // 28), bold=True)
			sf = font(max(16, w // 36))
			draw.text((x + 24, y + 24), head, font=hf, fill=TEXT)
			draw.text((x + 24, y + 60), sub, font=sf, fill=SECONDARY)

		mid_y = cy + len(chaos_items) * (card_h + gap) + 20
	else:
		card_w = min(420, w // 3 - 40)
		card_h = 140
		gap = 24
		total_w = len(chaos_items) * card_w + (len(chaos_items) - 1) * gap
		start_x = (w - total_w) // 2
		cy = h // 2 - 180
		draw.text(((w - tw) // 2, cy - 56), title, font=title_f, fill=AMBER)
		for i, (head, sub) in enumerate(chaos_items):
			x = start_x + i * (card_w + gap)
			rounded_rect(
				draw,
				(x, cy, x + card_w, cy + card_h),
				16,
				WHITE,
				outline=SLATE_200,
				width=2,
			)
			draw.rectangle((x, cy, x + 6, cy + card_h), fill=AMBER)
			hf = font(max(20, w // 60), bold=True)
			sf = font(max(16, w // 70))
			draw.text((x + 20, cy + 28), head, font=hf, fill=TEXT)
			for j, line in enumerate(wrap_text(draw, sub, sf, card_w - 40)):
				draw.text((x + 20, cy + 70 + j * 24), line, font=sf, fill=SECONDARY)
		mid_y = cy + card_h + 70

	aw = int(draw.textlength("→", font=font(48, bold=True)))
	draw.text(((w - aw) // 2, mid_y - 10), "→", font=font(48, bold=True), fill=CTA)

	logo_size = max(48, w // 12 if portrait else w // 18)
	logo_y = mid_y + 50
	tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
	lw = int(tmp.textlength("Tender", font=font(logo_size, True))) + int(
		tmp.textlength("Optima", font=font(logo_size, False)),
	)
	draw_logo(draw, (w - lw) // 2, logo_y, logo_size)

	tag = "AI-сервис для автоматизации закупок\nи анализа предложений поставщиков"
	tf = font(max(22, w // 28 if portrait else w // 48), bold=False)
	ty = logo_y + logo_size + 28
	for i, line in enumerate(tag.split("\n")):
		llw = int(draw.textlength(line, font=tf))
		draw.text(((w - llw) // 2, ty + i * int(tf.size * 1.4)), line, font=tf, fill=SECONDARY)

	return img


def frame_opening_logo(size: tuple[int, int]) -> Image.Image:
	"""Clean logo beat after chaos."""
	w, h = size
	img = Image.new("RGB", size, BG)
	draw = ImageDraw.Draw(img)
	logo_size = max(64, w // 12)
	tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
	lw = int(tmp.textlength("Tender", font=font(logo_size, True))) + int(
		tmp.textlength("Optima", font=font(logo_size, False)),
	)
	draw_logo(draw, (w - lw) // 2, h // 2 - logo_size - 20, logo_size)

	tag = "AI-сервис для автоматизации закупок\nи анализа предложений поставщиков"
	tf = font(max(26, w // 42), bold=False)
	ty = h // 2 + 20
	for i, line in enumerate(tag.split("\n")):
		llw = int(draw.textlength(line, font=tf))
		draw.text(((w - llw) // 2, ty + i * int(tf.size * 1.45)), line, font=tf, fill=SECONDARY)
	return img


def frame_broadcast(size: tuple[int, int]) -> Image.Image:
	"""Recreate landing broadcast mock for request mailing segment."""
	w, h = size
	img = Image.new("RGB", size, (241, 245, 249))
	draw = ImageDraw.Draw(img)

	# Browser chrome
	pad = max(24, w // 40)
	chrome_h = 44
	rounded_rect(
		draw,
		(pad, pad, w - pad, h - pad),
		20,
		WHITE,
		outline=SLATE_200,
		width=2,
	)
	draw.rectangle((pad, pad, w - pad, pad + chrome_h), fill=SLATE_100)
	for i, c in enumerate([(239, 68, 68), (234, 179, 8), (34, 197, 94)]):
		cx = pad + 18 + i * 16
		draw.ellipse((cx, pad + 16, cx + 10, pad + 26), fill=c)
	uf = font(14)
	url = "app.tenderoptima.online / запросы"
	draw.text((pad + 80, pad + 14), url, font=uf, fill=SECONDARY)

	ix0, iy0 = pad + 28, pad + chrome_h + 24
	ix1, iy1 = w - pad - 28, h - pad - 28

	hf = font(max(22, w // 50), bold=True)
	sf = font(max(16, w // 70))
	draw.text((ix0, iy0), "Поставщики для рассылки", font=hf, fill=TEXT)
	draw.text((ix0, iy0 + 36), "Запрос · кабель ВВГнг 3×2,5 · Минск", font=sf, fill=SECONDARY)

	badge = "12 выбрано"
	bf = font(16, bold=True)
	bw = int(draw.textlength(badge, font=bf)) + 24
	bx = ix1 - bw
	rounded_rect(draw, (bx, iy0 + 4, bx + bw, iy0 + 36), 10, (224, 242, 254), outline=None)
	draw.text((bx + 12, iy0 + 10), badge, font=bf, fill=CTA)

	suppliers = [
		("Э", "ЭлектроКомплект", "Минск · электра@…", True),
		("К", "КабельПро", "Гомель · sales@…", True),
		("С", "СнабТех", "Брест · info@…", True),
		("А", "АльфаКабель", "Гродно · order@…", False),
		("П", "ПроводСнаб", "Витебск · mail@…", True),
	]
	row_y = iy0 + 80
	row_h = min(56, (iy1 - row_y - 90) // len(suppliers))
	nf = font(max(16, w // 65), bold=True)
	mf = font(max(13, w // 80))
	for i, (initial, name, meta, checked) in enumerate(suppliers):
		y = row_y + i * (row_h + 8)
		rounded_rect(
			draw,
			(ix0, y, ix1, y + row_h),
			12,
			(248, 250, 252) if checked else WHITE,
			outline=SLATE_200,
		)
		# checkbox
		cb = (ix0 + 14, y + row_h // 2 - 10, ix0 + 34, y + row_h // 2 + 10)
		if checked:
			rounded_rect(draw, cb, 4, CTA)
			draw.text((cb[0] + 4, cb[1] - 1), "✓", font=font(14, True), fill=WHITE)
		else:
			rounded_rect(draw, cb, 4, WHITE, outline=SLATE_200, width=2)
		# avatar
		ax = ix0 + 48
		ay = y + row_h // 2 - 16
		draw.ellipse((ax, ay, ax + 32, ay + 32), fill=(186, 230, 253))
		draw.text((ax + 9, ay + 5), initial, font=font(14, True), fill=CTA)
		draw.text((ax + 44, y + 8), name, font=nf, fill=TEXT)
		draw.text((ax + 44, y + row_h // 2 + 2), meta, font=mf, fill=SECONDARY)
		if checked:
			tag = "в рассылке"
			tw = int(draw.textlength(tag, font=mf)) + 16
			tx = ix1 - tw - 12
			rounded_rect(
				draw,
				(tx, y + row_h // 2 - 12, tx + tw, y + row_h // 2 + 12),
				8,
				(224, 242, 254),
			)
			draw.text((tx + 8, y + row_h // 2 - 8), tag, font=mf, fill=CTA)

	# Letter preview strip
	preview_y = iy1 - 78
	rounded_rect(
		draw,
		(ix0, preview_y, ix1 - 220, iy1),
		12,
		SLATE_100,
		outline=SLATE_200,
	)
	pf = font(max(13, w // 85))
	draw.text(
		(ix0 + 16, preview_y + 12),
		"Шаблон письма (из ТЗ):",
		font=font(14, True),
		fill=SECONDARY,
	)
	draw.text(
		(ix0 + 16, preview_y + 36),
		"Просим предоставить КП на кабель ВВГнг 3×2,5…",
		font=pf,
		fill=TEXT,
	)

	btn_w, btn_h = 200, 48
	bx0 = ix1 - btn_w
	by0 = preview_y + 15
	rounded_rect(draw, (bx0, by0, bx0 + btn_w, by0 + btn_h), 10, CTA)
	bfnt = font(16, bold=True)
	label = "Отправить всем"
	lw = int(draw.textlength(label, font=bfnt))
	draw.text(
		(bx0 + (btn_w - lw) // 2, by0 + 14),
		label,
		font=bfnt,
		fill=WHITE,
	)
	return img


def frame_final_cta(size: tuple[int, int]) -> Image.Image:
	w, h = size
	img = Image.new("RGB", size, PRIMARY)
	draw = ImageDraw.Draw(img)

	# Soft radial-ish glow via concentric ellipses
	cx, cy = w // 2, h // 2 - 40
	for r in range(max(w, h) // 2, 40, -40):
		alpha = 8
		# approximate with darker rings — stay solid RGB
		tone = tuple(min(255, c + alpha + (max(w, h) // 2 - r) // 30) for c in PRIMARY)
		bbox = (cx - r, cy - r // 2, cx + r, cy + r // 2)
		draw.ellipse(bbox, outline=tone, width=2)

	logo_size = max(56, w // 14)
	tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
	# White/CTA logo on dark
	f_t = font(logo_size, True)
	f_o = font(logo_size, False)
	lw = int(tmp.textlength("Tender", font=f_t)) + int(tmp.textlength("Optima", font=f_o))
	lx = (w - lw) // 2
	ly = h // 2 - logo_size - 80
	draw.text((lx, ly), "Tender", font=f_t, fill=WHITE)
	draw.text((lx + int(tmp.textlength("Tender", font=f_t)), ly), "Optima", font=f_o, fill=(56, 189, 248))

	slogan = (
		"TenderOptima: поиск поставщиков,\n"
		"переписка и анализ КП — в одном инструменте"
	)
	sf = font(max(24, w // 40), bold=False)
	sy = ly + logo_size + 36
	for i, line in enumerate(slogan.split("\n")):
		llw = int(draw.textlength(line, font=sf))
		draw.text(((w - llw) // 2, sy + i * int(sf.size * 1.4)), line, font=sf, fill=SLATE_200)

	# CTA button
	btn_label = "Узнать больше"
	bf = font(max(20, w // 55), bold=True)
	bw = int(draw.textlength(btn_label, font=bf)) + 64
	bh = 56
	bx = (w - bw) // 2
	by = sy + int(sf.size * 1.4) * 2 + 40
	rounded_rect(draw, (bx, by, bx + bw, by + bh), 12, CTA)
	draw.text((bx + 32, by + 16), btn_label, font=bf, fill=WHITE)

	url = "tenderoptima.online"
	uf = font(max(18, w // 55))
	uw = int(draw.textlength(url, font=uf))
	draw.text(((w - uw) // 2, by + bh + 24), url, font=uf, fill=(148, 163, 184))
	return img


def save_rgb(img: Image.Image, path: Path) -> Path:
	path.parent.mkdir(parents=True, exist_ok=True)
	rgb = img.convert("RGB")
	rgb.save(path, "PNG")
	return path


def ken_burns_clip(
	img: Image.Image,
	duration: float,
	size: tuple[int, int],
	*,
	zoom_end: float = 1.08,
	fps: int = FPS,
) -> ImageSequenceClip:
	"""Slow zoom-in on a still frame."""
	base = fit_contain(img, size)
	# Fewer unique frames — smoother encode, less RAM
	step = max(1, fps // 10)
	n = max(2, int(duration * fps))
	arrs: list[np.ndarray] = []
	for i in range(0, n, step):
		t = i / (n - 1)
		z = 1 + (zoom_end - 1) * t
		zw, zh = max(size[0], int(size[0] * z)), max(size[1], int(size[1] * z))
		zoomed = base.resize((zw, zh), Image.Resampling.LANCZOS)
		x = (zw - size[0]) // 2
		y = (zh - size[1]) // 2
		frame = zoomed.crop((x, y, x + size[0], y + size[1]))
		arrs.append(np.array(frame))
	# Stretch last frame to exact duration via fps of sequence
	seq_fps = len(arrs) / duration
	return ImageSequenceClip(arrs, fps=seq_fps)


def still_with_caption(
	img: Image.Image,
	duration: float,
	size: tuple[int, int],
	caption: str,
	*,
	zoom: float = 1.06,
) -> CompositeVideoClip:
	kb = ken_burns_clip(img, duration, size, zoom_end=zoom)
	cap = make_caption_bar(size[0], size[1], caption)
	cap_np = np.array(cap)
	rgb = cap_np[:, :, :3]
	alpha = cap_np[:, :, 3] / 255.0
	cap_clip = ImageClip(rgb).with_duration(duration).with_mask(
		ImageClip(alpha, is_mask=True).with_duration(duration),
	)
	return CompositeVideoClip([kb, cap_clip], size=size).with_duration(duration)


def gif_segment(
	path: Path,
	duration: float,
	size: tuple[int, int],
	caption: str,
	*,
	speed: float = 2.2,
) -> CompositeVideoClip:
	raw = VideoFileClip(str(path))
	# speed up then take needed duration
	sped = raw.with_effects([vfx.MultiplySpeed(speed)])
	if sped.duration < duration:
		sped = sped.with_effects([vfx.Loop(duration=duration)])
	sped = sped.subclipped(0, duration)

	def resize_frame(get_frame, t):
		frame = get_frame(t)
		pil = Image.fromarray(frame)
		fitted = fit_contain(pil, size, bg=BG)
		return np.array(fitted)

	resized = sped.transform(resize_frame).with_duration(duration)

	cap = make_caption_bar(size[0], size[1], caption)
	cap_np = np.array(cap)
	rgb = cap_np[:, :, :3]
	alpha = cap_np[:, :, 3] / 255.0
	cap_clip = ImageClip(rgb).with_duration(duration).with_mask(
		ImageClip(alpha, is_mask=True).with_duration(duration),
	)
	return CompositeVideoClip([resized, cap_clip], size=size).with_duration(duration)


def fade_pair(clips: list, fade: float = 0.35):
	out = []
	for i, c in enumerate(clips):
		effects = []
		if i > 0:
			effects.append(vfx.CrossFadeIn(fade))
		if i < len(clips) - 1:
			effects.append(vfx.CrossFadeOut(fade))
		out.append(c.with_effects(effects) if effects else c)
	return concatenate_videoclips(out, method="compose", padding=-fade)


def build(aspect: str) -> Path:
	if aspect == "16x9":
		size = (1920, 1080)
		out_name = "tenderoptima-promo-16x9.mp4"
	elif aspect == "9x16":
		size = (1080, 1920)
		out_name = "tenderoptima-promo-9x16.mp4"
	else:
		raise ValueError(aspect)

	CACHE.mkdir(parents=True, exist_ok=True)
	OUT_DIR.mkdir(parents=True, exist_ok=True)

	# --- Load assets ---
	supplier_gif = LANDING / "supplier_flow.gif"
	email_chat = Image.open(LANDING / "email_chat.png")
	upload = Image.open(LANDING / "upload_area_analyze.png")
	analyze = Image.open(LANDING / "analyze_load.png")
	edit_refs = Image.open(LANDING / "edit_refs_analyze.png")
	compare = Image.open(LANDING / "tz_kp_compare.png")
	table = Image.open(LANDING / "supplier_table.png")
	excel = Image.open(LANDING / "excel.png")
	letter = Image.open(LANDING / "letter.png")

	opening = frame_opening(size)
	logo_beat = frame_opening_logo(size)
	broadcast = frame_broadcast(size)
	final = frame_final_cta(size)

	clips = []

	# 0–4s: chaos → logo
	c0 = still_with_caption(
		opening,
		2.2,
		size,
		"Хаос закупок: таблицы, письма, ручная сверка",
		zoom=1.03,
	)
	c1 = still_with_caption(
		logo_beat,
		1.8,
		size,
		"AI-сервис для автоматизации закупок и анализа КП",
		zoom=1.04,
	)
	clips.extend([c0, c1])

	# 4–10s: supplier search GIF
	c2 = gif_segment(
		supplier_gif,
		6.0,
		size,
		"Автоматический поиск поставщиков по запросу и региону поставки",
		speed=2.4,
	)
	clips.append(c2)

	# 10–18s: broadcast + letter
	c3 = still_with_caption(
		broadcast,
		4.5,
		size,
		"Формирование и рассылка запросов — в несколько кликов",
		zoom=1.05,
	)
	c4 = still_with_caption(
		letter,
		3.5,
		size,
		"Авто-генерация текста письма на основе ТЗ",
		zoom=1.06,
	)
	clips.extend([c3, c4])

	# 18–26s: inbox
	c5 = still_with_caption(
		email_chat,
		8.0,
		size,
		"Вся переписка с поставщиками — в одном месте",
		zoom=1.07,
	)
	clips.append(c5)

	# 26–34s: AI analysis sequence
	ai_caption = (
		"AI извлекает требования из ТЗ и сверяет их с КП. Без ручной сверки таблиц"
	)
	c6 = still_with_caption(upload, 2.0, size, ai_caption, zoom=1.05)
	c7 = still_with_caption(analyze, 1.8, size, ai_caption, zoom=1.04)
	c8 = still_with_caption(edit_refs, 2.0, size, ai_caption, zoom=1.05)
	c9 = still_with_caption(compare, 2.2, size, ai_caption, zoom=1.06)
	clips.extend([c6, c7, c8, c9])

	# 34–40s: report + CTA
	c10 = still_with_caption(
		table,
		1.6,
		size,
		"Готовый отчёт: таблица соответствия",
		zoom=1.05,
	)
	c11 = still_with_caption(
		excel,
		1.6,
		size,
		"Экспорт в XLSX / DOCX и письма поставщикам",
		zoom=1.05,
	)
	# Final without bottom bar — CTA is the frame
	final_clip = ken_burns_clip(final, 2.8, size, zoom_end=1.04)
	clips.extend([c10, c11, final_clip])

	video = fade_pair(clips, fade=0.3)
	# Trim / pad to ~38–40s
	target = min(40.0, max(36.0, video.duration))
	if video.duration > target:
		video = video.subclipped(0, target)

	out_path = OUT_DIR / out_name
	video.write_videofile(
		str(out_path),
		fps=FPS,
		codec="libx264",
		audio=False,
		preset="medium",
		bitrate="6M",
		threads=4,
		logger="bar",
	)
	video.close()
	for c in clips:
		try:
			c.close()
		except Exception:
			pass
	return out_path


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument(
		"--aspect",
		choices=["16x9", "9x16", "both"],
		default="both",
	)
	args = parser.parse_args()
	aspects = ["16x9", "9x16"] if args.aspect == "both" else [args.aspect]
	for a in aspects:
		print(f"Building {a}…")
		path = build(a)
		print(f"Wrote {path}")


if __name__ == "__main__":
	main()
