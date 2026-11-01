"""
Ghost Overlay - Screen-Capture-Proof Floating Teleprompter & Auto-Typer
Uses Windows SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
Invisible to:
  - Display Capture (OBS, Zoom, Discord, Teams full screen shares)
  - Window Capture (OBS, Zoom, Discord window captures)
  - Tab Capture (Browser tab share / getDisplayMedia)
  - Screenshots (Snipping Tool, PrintScreen, Win+Shift+S)
"""

import sys
import time
import random
import threading
import ctypes
from ctypes import wintypes
import tkinter as tk
from tkinter import ttk

# Windows API Constants
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WDA_NONE = 0x00000000
WDA_MONITOR = 0x00000001
WDA_EXCLUDEFROMCAPTURE = 0x00000011  # Windows 10 version 2004+ exclusion flag

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# Structures for SendInput
class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong)
    ]

class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD)
    ]

class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong)
    ]

class _INPUT_UNION(ctypes.Union):
    _fields_ = [
        ("mi", MOUSEINPUT),
        ("ki", KEYBDINPUT),
        ("hi", HARDWAREINPUT)
    ]

class INPUT(ctypes.Structure):
    _fields_ = [
        ("type", wintypes.DWORD),
        ("u", _INPUT_UNION)
    ]

def send_unicode_char(char):
    """Sends a single Unicode character using SendInput."""
    code = ord(char)
    inp_down = INPUT()
    inp_down.type = INPUT_KEYBOARD
    inp_down.u.ki.wVk = 0
    inp_down.u.ki.wScan = code
    inp_down.u.ki.dwFlags = KEYEVENTF_UNICODE
    inp_down.u.ki.time = 0
    inp_down.u.ki.dwExtraInfo = 0

    inp_up = INPUT()
    inp_up.type = INPUT_KEYBOARD
    inp_up.u.ki.wVk = 0
    inp_up.u.ki.wScan = code
    inp_up.u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
    inp_up.u.ki.time = 0
    inp_up.u.ki.dwExtraInfo = 0

    user32.SendInput(1, ctypes.byref(inp_down), ctypes.sizeof(INPUT))
    user32.SendInput(1, ctypes.byref(inp_up), ctypes.sizeof(INPUT))

class GhostOverlayApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Ghost Overlay")
        self.root.overrideredirect(True)  # Frameless window
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", 0.94)

        self.is_expanded = True
        self.is_hidden = False
        self.last_target_hwnd = None
        self.is_typing = False
        self.stop_typing = False

        self.setup_ui()
        self.apply_capture_protection()
        self.setup_drag()
        self.start_hotkey_listener()

    def get_hwnd(self):
        self.root.update_idletasks()
        hwnd = self.root.winfo_id()
        parent = user32.GetParent(hwnd)
        return parent if parent else hwnd

    def apply_capture_protection(self):
        """Enforces WDA_EXCLUDEFROMCAPTURE to hide window from OBS, Zoom, Teams, Screen Shares."""
        hwnd = self.get_hwnd()
        try:
            # Enable layered window style
            style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED)
            
            # Set display affinity to exclude from captures
            res = user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
            if res:
                print("[GhostOverlay] Protected successfully! Excluded from display, window & tab capture.")
            else:
                err = ctypes.get_last_error()
                print(f"[GhostOverlay] SetWindowDisplayAffinity warning code: {err}")
        except Exception as e:
            print("[GhostOverlay] Protection error:", e)

    def setup_ui(self):
        self.root.configure(bg="#0f172a")

        # Main container with rounded border look
        self.main_frame = tk.Frame(self.root, bg="#0f172a", highlightthickness=1, highlightbackground="#38bdf8", highlightcolor="#38bdf8")
        self.main_frame.pack(fill="both", expand=True)

        # Title bar (Draggable)
        self.title_bar = tk.Frame(self.main_frame, bg="#1e293b", height=28)
        self.title_bar.pack(fill="x", side="top")

        self.title_label = tk.Label(
            self.title_bar,
            text="👻 Ghost Overlay (Hidden from Screen Capture)",
            font=("Segoe UI", 9, "bold"),
            fg="#38bdf8",
            bg="#1e293b"
        )
        self.title_label.pack(side="left", padx=8, pady=3)

        self.btn_close = tk.Label(self.title_bar, text="✕", font=("Segoe UI", 9, "bold"), fg="#94a3b8", bg="#1e293b", cursor="hand2")
        self.btn_close.pack(side="right", padx=8)
        self.btn_close.bind("<Button-1>", lambda e: self.root.destroy())

        self.btn_toggle_expand = tk.Label(self.title_bar, text="⇕", font=("Segoe UI", 10, "bold"), fg="#38bdf8", bg="#1e293b", cursor="hand2")
        self.btn_toggle_expand.pack(side="right", padx=4)
        self.btn_toggle_expand.bind("<Button-1>", lambda e: self.toggle_expand())

        # Expanded Content Area
        self.content_frame = tk.Frame(self.main_frame, bg="#0f172a", padx=10, pady=8)
        self.content_frame.pack(fill="both", expand=True)

        # Staging Text Area
        self.lbl_info = tk.Label(
            self.content_frame,
            text="Text to Auto-Type (Alt+V anywhere to type into active field):",
            font=("Segoe UI", 8),
            fg="#94a3b8",
            bg="#0f172a"
        )
        self.lbl_info.pack(anchor="w", pady=(0, 4))

        self.text_box = tk.Text(
            self.content_frame,
            wrap="word",
            height=6,
            width=42,
            font=("Consolas", 9),
            bg="#1e293b",
            fg="#f8fafc",
            insertbackground="#38bdf8",
            relief="flat",
            highlightthickness=1,
            highlightbackground="#334155"
        )
        self.text_box.pack(fill="both", expand=True, pady=(0, 8))
        self.text_box.insert("1.0", "Paste your text or notes here...")

        # Controls row
        self.controls_row = tk.Frame(self.content_frame, bg="#0f172a")
        self.controls_row.pack(fill="x", pady=(0, 6))

        # WPM Slider
        self.lbl_speed = tk.Label(self.controls_row, text="Speed: 60 WPM", font=("Segoe UI", 8, "bold"), fg="#e2e8f0", bg="#0f172a")
        self.lbl_speed.pack(side="left")

        self.slider_speed = tk.Scale(
            self.controls_row,
            from_=20,
            to=300,
            orient="horizontal",
            showvalue=False,
            command=self.update_speed,
            bg="#0f172a",
            fg="#38bdf8",
            highlightthickness=0,
            troughcolor="#334155"
        )
        self.slider_speed.set(60)
        self.slider_speed.pack(side="left", padx=8, fill="x", expand=True)

        # Opacity Slider
        self.lbl_alpha = tk.Label(self.controls_row, text="Opacity", font=("Segoe UI", 8), fg="#94a3b8", bg="#0f172a")
        self.lbl_alpha.pack(side="left", padx=(6, 2))

        self.slider_alpha = tk.Scale(
            self.controls_row,
            from_=20,
            to=100,
            orient="horizontal",
            showvalue=False,
            command=self.update_alpha,
            bg="#0f172a",
            highlightthickness=0,
            troughcolor="#334155"
        )
        self.slider_alpha.set(94)
        self.slider_alpha.pack(side="left", fill="x")

        # Action Buttons
        self.actions_row = tk.Frame(self.content_frame, bg="#0f172a")
        self.actions_row.pack(fill="x")

        self.btn_clip = tk.Button(
            self.actions_row,
            text="📋 Paste Clip",
            font=("Segoe UI", 8, "bold"),
            bg="#334155",
            fg="#f8fafc",
            activebackground="#475569",
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            padx=8,
            pady=3,
            command=self.paste_from_clipboard
        )
        self.btn_clip.pack(side="left", padx=(0, 4))

        self.btn_clear = tk.Button(
            self.actions_row,
            text="🗑️ Clear",
            font=("Segoe UI", 8),
            bg="#334155",
            fg="#f8fafc",
            activebackground="#475569",
            relief="flat",
            cursor="hand2",
            padx=6,
            pady=3,
            command=lambda: self.text_box.delete("1.0", tk.END)
        )
        self.btn_clear.pack(side="left")

        self.btn_type = tk.Button(
            self.actions_row,
            text="⚡ Start Typing (Alt+V)",
            font=("Segoe UI", 8, "bold"),
            bg="#0284c7",
            fg="#ffffff",
            activebackground="#0369a1",
            activeforeground="#ffffff",
            relief="flat",
            cursor="hand2",
            padx=12,
            pady=3,
            command=self.trigger_typing
        )
        self.btn_type.pack(side="right")

        # Set initial geometry
        self.root.geometry("380x250+100+100")

    def toggle_expand(self):
        if self.is_expanded:
            self.content_frame.pack_forget()
            self.root.geometry("260x32")
            self.is_expanded = False
            self.title_label.config(text="👻 Ghost Overlay (Dock)")
        else:
            self.content_frame.pack(fill="both", expand=True)
            self.root.geometry("380x250")
            self.is_expanded = True
            self.title_label.config(text="👻 Ghost Overlay (Capture-Proof)")

    def update_speed(self, val):
        wpm = int(val)
        delay = round(12000 / wpm)
        self.lbl_speed.config(text=f"Speed: {wpm} WPM (~{delay}ms)")

    def update_alpha(self, val):
        alpha = int(val) / 100.0
        self.root.attributes("-alpha", alpha)

    def paste_from_clipboard(self):
        try:
            clip = self.root.clipboard_get()
            if clip:
                self.text_box.delete("1.0", tk.END)
                self.text_box.insert("1.0", clip)
        except Exception:
            pass

    def setup_drag(self):
        """Allows dragging frameless window anywhere on screen."""
        self._drag_x = 0
        self._drag_y = 0

        def on_mouse_down(event):
            self._drag_x = event.x
            self._drag_y = event.y

        def on_mouse_move(event):
            dx = event.x - self._drag_x
            dy = event.y - self._drag_y
            x = self.root.winfo_x() + dx
            y = self.root.winfo_y() + dy
            self.root.geometry(f"+{x}+{y}")

        self.title_bar.bind("<Button-1>", on_mouse_down)
        self.title_bar.bind("<B1-Motion>", on_mouse_move)
        self.title_label.bind("<Button-1>", on_mouse_down)
        self.title_label.bind("<B1-Motion>", on_mouse_move)

    def trigger_typing(self):
        text = self.text_box.get("1.0", tk.END).strip()
        if not text:
            return

        wpm = self.slider_speed.get()
        base_delay = 12.0 / wpm

        self.btn_type.config(text="Typing... (Alt+V stops)", bg="#dc2626")

        def type_worker():
            self.is_typing = True
            self.stop_typing = False
            
            # Switch to previous active window if possible
            time.sleep(0.3)

            for char in text:
                if self.stop_typing:
                    break

                send_unicode_char(char)

                # Add natural jitter
                delay = base_delay + (random.random() * base_delay * 0.4 - base_delay * 0.2)
                if char == ' ':
                    delay += base_delay * 0.3
                elif char in ".,!?:;":
                    delay += base_delay * 0.6
                
                time.sleep(max(0.01, delay))

            self.is_typing = False
            self.root.after(0, lambda: self.btn_type.config(text="⚡ Start Typing (Alt+V)", bg="#0284c7"))

        t = threading.Thread(target=type_worker, daemon=True)
        t.start()

    def start_hotkey_listener(self):
        """Registers global Alt+V and Alt+H hotkeys via Windows API in background thread."""
        def hotkey_loop():
            HOTKEY_ALT_V = 101
            HOTKEY_ALT_H = 102

            VK_V = 0x56
            VK_H = 0x48

            user32.RegisterHotKey(None, HOTKEY_ALT_V, MOD_ALT | MOD_NOREPEAT, VK_V)
            user32.RegisterHotKey(None, HOTKEY_ALT_H, MOD_ALT | MOD_NOREPEAT, VK_H)

            msg = wintypes.MSG()
            while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
                if msg.message == 0x0312:  # WM_HOTKEY
                    if msg.wParam == HOTKEY_ALT_V:
                        if self.is_typing:
                            self.stop_typing = True
                        else:
                            self.root.after(0, self.trigger_typing)
                    elif msg.wParam == HOTKEY_ALT_H:
                        self.root.after(0, self.toggle_visibility)
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))

        t = threading.Thread(target=hotkey_loop, daemon=True)
        t.start()

    def toggle_visibility(self):
        if self.is_hidden:
            self.root.deiconify()
            self.is_hidden = False
        else:
            self.root.withdraw()
            self.is_hidden = True

def main():
    root = tk.Tk()
    app = GhostOverlayApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
