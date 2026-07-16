"""
Export numbered PNG frames for Canva video editor.

Outputs:
  marketing/promo/canva-assets/16x9/NN-slug.png
  marketing/promo/canva-assets/9x16/NN-slug.png
  marketing/promo/canva-assets/clips/supplier_flow.mp4  (GIF → MP4 for Canva)

Run: python marketing/promo/export_canva_assets.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoFileClip, vfx

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / "canva-assets" / "source"
OUT_16 = Path(__file__).resolve().parent / "canva-assets" / "16x9"
OUT_9 = Path(__file__).resolve().parent / "canva-assets" / "9x16"
OUT_CLIPS = Path(__file__).resolve().parent / "canva-assets" / "clips"

BG = (248, 250, 252)
PRIMARY = (15, 23, 42)
CTA = (3, 105, 161)
WHITE = (255, 255, 255)
SLATE_200 = (226, 232, 240)
AMBER = (180, 83, 9)
SECONDARY = (51, 65, 85)
TEXT = (2, 6, 23)

FONT_REG = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

# Curated scene list: (filename slug, source path relative to SRC or special)
SCENES: list[tuple[str, str | None]] = [
	("00-opening-chaos", None),  # generated
	("01-supplier-search-form", "c__Users_andda_AppData_Roaming_Cursor_User_workspaceStorage_c8701324a65c50de7fdd1b842169f230_images_image-a7680a29-d6b3-4f38-82d0-412b7d0325bd.png"),
	("02-supplier-search-loading", "c__Users_andda_AppData_Roaming_Cursor_User_workspaceStorage_c8701324a65c50de7fdd1b842169f230_images_image-2515366f-a57d-49ab-aa32-0bfb4a39ed7d.png"),
	("03-supplier-results", "c__Users_andda_AppData_Roaming_Cursor_User_workspaceStorage_c8701324a65c50de7fdd1b842169f230_images_image-5486b8fa-a7f0-4015-9ed1-31fbe8227e09.png"),
	("04-email-params", "c__Users_andda_AppData_Roaming_Cursor_User_workspaceStorage_c8701324a65c50de7fdd1b842169f230_images_image-47446204-c8a1-41b6-87ac-e9c57c6a7a16.png"),
	("05-inbox-correspondence", "email_chat.png"),
	("06-letter-supplier", "letter.png"),
	("07-upload-tz", "upload_area_analyze.png"),
	("08-analyze-loading", "analyze_load.png"),
	("09-edit-requirements", "edit_refs_analyze.png"),
	("10-tz-kp-compare", "tz_kp_compare.png"),
	("11-compare-table", "supplier_table.png"),
	("12-export-excel", "excel.png"),
	("13-final-cta", "final"),  # generated
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
	return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REG), size)


def fit_contain(img: Image.Image, box: tuple[int, int], bg: tuple[int, int, int] = BG) -> Image.Image:
	bw, bh = box
	canvas = Image.new("RGB", (bw, bh), bg)
	src = img.convert("RGBA")
	scale = min(bw / src.width, bh / src.height)
	nw, nh = max(1, int(src.width * scale)), max(1, int(src.height * scale))
	resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
	x, y = (bw - nw) // 2, (bh - nh) // 2
	canvas.paste(resized, (x, y), resized)
	return canvas


def frame_opening(size: tuple[int, int]) -> Image.Image:
	w, h = size
	portrait = h > w
	img = Image.new("RGB", size, BG)
	draw = ImageDraw.Draw(img)
	chaos = [
		("Excel-таблицы", "Ручной сбор предложений"),
		("Письма в почте", "Переписка разбросана"),
		("Сверка вручную", "Часы на каждый тендер"),
	]
	title_f = font(max(22, w // 22 if portrait else w // 55), bold=True)
	title = "Закупки сегодня"
	tw = int(draw.textlength(title, font=title_f))
	if portrait:
		cy = 160
		draw.text(((w - tw) // 2, 100), title, font=title_f, fill=AMBER)
		for i, (head, sub) in enumerate(chaos):
			x, y = 40, cy + i * 126
			draw.rounded_rectangle((x, y, w - 40, y + 110), 16, fill=WHITE, outline=SLATE_200, width=2)
			draw.rectangle((x, y, x + 6, y + 110), fill=AMBER)
			draw.text((x + 24, y + 24), head, font=font(max(22, w // 28), True), fill=TEXT)
			draw.text((x + 24, y + 60), sub, font=font(max(16, w // 36)), fill=SECONDARY)
		mid_y = cy + len(chaos) * 126 + 20
	else:
		card_w, card_h, gap = min(420, w // 3 - 40), 140, 24
		total_w = len(chaos) * card_w + (len(chaos) - 1) * gap
		start_x, cy = (w - total_w) // 2, h // 2 - 180
		draw.text(((w - tw) // 2, cy - 56), title, font=title_f, fill=AMBER)
		for i, (head, sub) in enumerate(chaos):
			x = start_x + i * (card_w + gap)
			draw.rounded_rectangle((x, cy, x + card_w, cy + card_h), 16, fill=WHITE, outline=SLATE_200, width=2)
			draw.rectangle((x, cy, x + 6, cy + card_h), fill=AMBER)
			draw.text((x + 20, cy + 28), head, font=font(20, True), fill=TEXT)
			draw.text((x + 20, cy + 70), sub, font=font(16), fill=SECONDARY)
		mid_y = cy + card_h + 70
	aw = int(draw.textlength("→", font=font(48, True)))
	draw.text(((w - aw) // 2, mid_y - 10), "→", font=font(48, True), fill=CTA)
	logo_size = max(48, w // 12 if portrait else w // 18)
	tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
	lw = int(tmp.textlength("Tender", font=font(logo_size, True))) + int(
		tmp.textlength("Optima", font=font(logo_size, False)),
	)
	lx, ly = (w - lw) // 2, mid_y + 50
	draw.text((lx, ly), "Tender", font=font(logo_size, True), fill=PRIMARY)
	draw.text((lx + int(tmp.textlength("Tender", font=font(logo_size, True))), ly), "Optima", font=font(logo_size, False), fill=CTA)
	tag = "AI-сервис для автоматизации закупок\nи анализа предложений поставщиков"
	tf = font(max(22, w // 28 if portrait else w // 48))
	ty = ly + logo_size + 28
	for i, line in enumerate(tag.split("\n")):
		llw = int(draw.textlength(line, font=tf))
		draw.text(((w - llw) // 2, ty + i * int(tf.size * 1.4)), line, font=tf, fill=SECONDARY)
	return img


def frame_final(size: tuple[int, int]) -> Image.Image:
	w, h = size
	img = Image.new("RGB", size, PRIMARY)
	draw = ImageDraw.Draw(img)
	cx, cy = w // 2, h // 2 - 40
	for r in range(max(w, h) // 2, 40, -40):
		tone = tuple(min(255, c + 8 + (max(w, h) // 2 - r) // 30) for c in PRIMARY)
		draw.ellipse((cx - r, cy - r // 2, cx + r, cy + r // 2), outline=tone, width=2)
	logo_size = max(56, w // 14)
	tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
	f_t, f_o = font(logo_size, True), font(logo_size, False)
	lw = int(tmp.textlength("Tender", font=f_t)) + int(tmp.textlength("Optima", font=f_o))
	lx, ly = (w - lw) // 2, h // 2 - logo_size - 80
	draw.text((lx, ly), "Tender", font=f_t, fill=WHITE)
	draw.text((lx + int(tmp.textlength("Tender", font=f_t)), ly), "Optima", font=f_o, fill=(56, 189, 248))
	slogan = "TenderOptima: поиск поставщиков,\nпереписка и анализ КП — в одном инструменте"
	sf = font(max(24, w // 40))
	sy = ly + logo_size + 36
	for i, line in enumerate(slogan.split("\n")):
		llw = int(draw.textlength(line, font=sf))
		draw.text(((w - llw) // 2, sy + i * int(sf.size * 1.4)), line, font=sf, fill=SLATE_200)
	btn = "Узнать больше"
	bf = font(max(20, w // 55), True)
	bw = int(draw.textlength(btn, font=bf)) + 64
	bx, by = (w - bw) // 2, sy + int(sf.size * 1.4) * 2 + 40
	draw.rounded_rectangle((bx, by, bx + bw, by + 56), 12, fill=CTA)
	draw.text((bx + 32, by + 16), btn, font=bf, fill=WHITE)
	url = "tenderoptima.online"
	uf = font(max(18, w // 55))
	uw = int(draw.textlength(url, font=uf))
	draw.text(((w - uw) // 2, by + 80), url, font=uf, fill=(148, 163, 184))
	return img


def load_scene(src_key: str | None, slug: str) -> Image.Image:
	if src_key is None:
		return frame_opening((1920, 1080))
	if src_key == "final":
		return frame_final((1920, 1080))
	path = SRC / src_key
	if not path.exists():
		raise FileNotFoundError(path)
	return Image.open(path).convert("RGB")


def export_gif_clip() -> Path:
	gif_path = SRC / "supplier_flow.gif"
	if not gif_path.exists():
		raise FileNotFoundError(gif_path)
	OUT_CLIPS.mkdir(parents=True, exist_ok=True)
	out = OUT_CLIPS / "supplier_flow.mp4"
	clip = VideoFileClip(str(gif_path))
	# Slightly faster for promo use in Canva
	sped = clip.with_effects([vfx.MultiplySpeed(2.0)])
	sped.write_videofile(
		str(out),
		fps=30,
		codec="libx264",
		audio=False,
		preset="medium",
		bitrate="8M",
		logger=None,
	)
	clip.close()
	sped.close()
	return out


def main() -> None:
	for d in (OUT_16, OUT_9, OUT_CLIPS):
		d.mkdir(parents=True, exist_ok=True)
		# Clear old numbered exports only
		for f in d.glob("[0-9][0-9]-*.png"):
			f.unlink()

	captions = []
	for slug, src_key in SCENES:
		base = load_scene(src_key, slug)
		for aspect, out_dir, size in (
			("16x9", OUT_16, (1920, 1080)),
			("9x16", OUT_9, (1080, 1920)),
		):
			if slug in ("00-opening-chaos", "13-final-cta"):
				frame = frame_opening(size) if slug.startswith("00") else frame_final(size)
			else:
				frame = fit_contain(base, size)
			out_path = out_dir / f"{slug}.png"
			frame.save(out_path, "PNG", optimize=True)
		captions.append(slug)

	clip_path = export_gif_clip()
	print(f"Exported {len(SCENES)} scenes x 2 aspects")
	print(f"GIF clip: {clip_path}")
	print(f"16x9: {OUT_16}")
	print(f"9x16: {OUT_9}")


if __name__ == "__main__":
	main()
