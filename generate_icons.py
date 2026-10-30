import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("icons", exist_ok=True)

def create_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background rounded rectangle with gradient-like look
    # Purple/Indigo gradient background
    margin = max(1, int(size * 0.05))
    radius = max(3, int(size * 0.22))
    
    # Base color
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=(79, 70, 229, 255) # Indigo-600
    )
    
    # Draw a cute clipboard + typing symbol
    # Clipboard board
    cb_w = int(size * 0.44)
    cb_h = int(size * 0.52)
    cb_x = int((size - cb_w) / 2)
    cb_y = int((size - cb_h) / 2) + int(size * 0.04)
    cb_radius = max(2, int(size * 0.08))
    
    draw.rounded_rectangle(
        [cb_x, cb_y, cb_x + cb_w, cb_y + cb_h],
        radius=cb_radius,
        fill=(255, 255, 255, 255)
    )
    
    # Clip on top
    clip_w = int(cb_w * 0.5)
    clip_h = max(2, int(size * 0.1))
    clip_x = int(cb_x + (cb_w - clip_w) / 2)
    clip_y = cb_y - max(1, int(size * 0.04))
    
    draw.rounded_rectangle(
        [clip_x, clip_y, clip_x + clip_w, clip_y + clip_h],
        radius=max(1, int(clip_h / 2)),
        fill=(209, 213, 219, 255)
    )
    
    # Typing lines inside clipboard
    line_x1 = cb_x + int(cb_w * 0.2)
    line_x2 = cb_x + int(cb_w * 0.8)
    line_w = max(1, int(size * 0.04))
    
    y1 = cb_y + int(cb_h * 0.35)
    y2 = cb_y + int(cb_h * 0.55)
    y3 = cb_y + int(cb_h * 0.75)
    
    draw.line([line_x1, y1, line_x2, y1], fill=(99, 102, 241, 255), width=line_w)
    draw.line([line_x1, y2, line_x2 - int(cb_w * 0.15), y2], fill=(99, 102, 241, 255), width=line_w)
    draw.line([line_x1, y3, line_x2 - int(cb_w * 0.35), y3], fill=(168, 85, 247, 255), width=line_w)
    
    # Cursor dot or accent
    if size >= 48:
        cursor_x = line_x2 - int(cb_w * 0.25)
        draw.line([cursor_x, y3 - int(line_w), cursor_x, y3 + int(line_w)], fill=(236, 72, 153, 255), width=line_w)

    img.save(f"icons/icon-{size}.png", "PNG")
    print(f"Generated icons/icon-{size}.png")

for s in [16, 48, 128]:
    create_icon(s)
