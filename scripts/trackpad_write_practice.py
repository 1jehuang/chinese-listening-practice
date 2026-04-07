#!/usr/bin/env python3
"""Trackpad-based Chinese writing practice app for Linux.

Reads raw multitouch events from a Linux touchpad via evdev and maps a single
finger to a square writing canvas. Intended for quickly testing whether a
laptop trackpad can work as a character-writing practice surface.
"""

from __future__ import annotations

import argparse
import math
import queue
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from evdev import InputDevice, ecodes, list_devices

Point = Tuple[float, float]
BUTTON_HEIGHT = 44
SIDE_WIDTH = 280
PADDING = 24


@dataclass
class TouchSlot:
    tracking_id: Optional[int] = None
    x: Optional[int] = None
    y: Optional[int] = None


@dataclass
class TouchFrame:
    points: List[Tuple[int, int, int, int]]
    # slot, tracking_id, x, y


@dataclass
class TouchpadSpec:
    path: str
    name: str
    x_min: int
    x_max: int
    y_min: int
    y_max: int


class TouchpadReader(threading.Thread):
    def __init__(self, spec: TouchpadSpec, out_queue: "queue.Queue[object]") -> None:
        super().__init__(daemon=True)
        self.spec = spec
        self.out_queue = out_queue
        self.stop_event = threading.Event()
        self.current_slot = 0
        self.slots: Dict[int, TouchSlot] = {}

    def stop(self) -> None:
        self.stop_event.set()

    def run(self) -> None:
        try:
            device = InputDevice(self.spec.path)
            self.out_queue.put(("status", f"Reading {self.spec.name} ({self.spec.path})"))
            for event in device.read_loop():
                if self.stop_event.is_set():
                    break
                if event.type == ecodes.EV_ABS:
                    self._handle_abs(event.code, event.value)
                elif event.type == ecodes.EV_SYN:
                    if event.code == ecodes.SYN_DROPPED:
                        self.out_queue.put(("status", "Input sync dropped, resyncing"))
                    elif event.code == ecodes.SYN_REPORT:
                        self.out_queue.put(("frame", self._snapshot()))
        except PermissionError:
            self.out_queue.put(("error", f"Permission denied opening {self.spec.path}"))
        except OSError as exc:
            self.out_queue.put(("error", f"Touchpad read failed: {exc}"))

    def _handle_abs(self, code: int, value: int) -> None:
        if code == ecodes.ABS_MT_SLOT:
            self.current_slot = value
            self.slots.setdefault(self.current_slot, TouchSlot())
            return

        slot = self.slots.setdefault(self.current_slot, TouchSlot())
        if code == ecodes.ABS_MT_TRACKING_ID:
            if value < 0:
                self.slots[self.current_slot] = TouchSlot()
            else:
                slot.tracking_id = value
        elif code == ecodes.ABS_MT_POSITION_X:
            slot.x = value
        elif code == ecodes.ABS_MT_POSITION_Y:
            slot.y = value

    def _snapshot(self) -> TouchFrame:
        points: List[Tuple[int, int, int, int]] = []
        for slot_index, slot in sorted(self.slots.items()):
            if slot.tracking_id is None or slot.x is None or slot.y is None:
                continue
            points.append((slot_index, slot.tracking_id, slot.x, slot.y))
        return TouchFrame(points=points)


def find_touchpads() -> List[TouchpadSpec]:
    found: List[TouchpadSpec] = []
    for path in list_devices():
        try:
            device = InputDevice(path)
            caps = device.capabilities(absinfo=True)
            abs_caps = {code: info for code, info in caps.get(ecodes.EV_ABS, [])}
            if ecodes.ABS_MT_POSITION_X not in abs_caps or ecodes.ABS_MT_POSITION_Y not in abs_caps:
                continue
            name = device.name or Path(path).name
            if "touchpad" not in name.lower() and ecodes.BTN_TOOL_FINGER not in device.capabilities().get(ecodes.EV_KEY, []):
                continue
            x_info = abs_caps[ecodes.ABS_MT_POSITION_X]
            y_info = abs_caps[ecodes.ABS_MT_POSITION_Y]
            found.append(
                TouchpadSpec(
                    path=path,
                    name=name,
                    x_min=x_info.min,
                    x_max=x_info.max,
                    y_min=y_info.min,
                    y_max=y_info.max,
                )
            )
        except OSError:
            continue
    return found


class PracticeApp:
    def __init__(self, spec: Optional[TouchpadSpec], use_mouse: bool, initial_character: str) -> None:
        import pygame

        self.pg = pygame
        pygame.init()
        pygame.display.set_caption("Trackpad Chinese Writing Practice")
        self.screen = pygame.display.set_mode((980, 760), pygame.RESIZABLE)
        self.clock = pygame.time.Clock()

        self.spec = spec
        self.use_mouse = use_mouse
        self.character = initial_character or "永"
        self.queue: "queue.Queue[object]" = queue.Queue()
        self.reader: Optional[TouchpadReader] = None
        self.current_tracking_id: Optional[int] = None
        self.current_stroke: List[Point] = []
        self.strokes: List[List[Point]] = []
        self.indicator: Optional[Point] = None
        self.status_text = "Ready"
        self.raw_pos_text = "-"
        self.show_grid = True
        self.show_overlay = True
        self.input_active = False
        self.mouse_drawing = False
        self.running = True

        self.font_body = self._make_font(["Noto Sans", "DejaVu Sans", "Arial"], 22)
        self.font_small = self._make_font(["Noto Sans", "DejaVu Sans", "Arial"], 18)
        self.font_title = self._make_font(["Noto Sans", "DejaVu Sans", "Arial"], 30, bold=True)
        self.font_overlay = self._make_font(
            [
                "Noto Sans CJK SC",
                "Noto Sans SC",
                "Source Han Sans SC",
                "WenQuanYi Zen Hei",
                "Noto Sans",
                "DejaVu Sans",
            ],
            220,
            bold=False,
        )

        if spec is not None and not use_mouse:
            self.reader = TouchpadReader(spec, self.queue)
            self.reader.start()
            self.status_text = f"Using {spec.name} on {spec.path}"
        elif use_mouse:
            self.status_text = "Mouse mode enabled. Drag inside the square to test."
        else:
            self.status_text = "No compatible touchpad found. Use --mouse to test the UI."

    def _make_font(self, names: List[str], size: int, bold: bool = False):
        for name in names:
            font = self.pg.font.SysFont(name, size, bold=bold)
            if font is not None:
                return font
        return self.pg.font.SysFont(None, size, bold=bold)

    def run(self) -> None:
        while self.running:
            for event in self.pg.event.get():
                self._handle_event(event)
            self._process_queue()
            self._draw()
            self.clock.tick(120)
        self._shutdown()

    def _shutdown(self) -> None:
        if self.reader is not None:
            self.reader.stop()
        self.pg.quit()

    def _handle_event(self, event) -> None:
        if event.type == self.pg.QUIT:
            self.running = False
            return

        if event.type == self.pg.VIDEORESIZE:
            self.screen = self.pg.display.set_mode((event.w, event.h), self.pg.RESIZABLE)
            return

        if event.type == self.pg.KEYDOWN:
            if event.key == self.pg.K_ESCAPE:
                self.running = False
            elif event.key == self.pg.K_c:
                self.clear()
            elif event.key == self.pg.K_u:
                self.undo()
            elif event.key == self.pg.K_g:
                self.show_grid = not self.show_grid
            elif event.key == self.pg.K_o:
                self.show_overlay = not self.show_overlay
            elif event.key == self.pg.K_TAB:
                self.input_active = not self.input_active
            elif self.input_active and event.key == self.pg.K_BACKSPACE:
                self.character = self.character[:-1]
            return

        if event.type == self.pg.TEXTINPUT and self.input_active:
            if len(self.character) < 8:
                self.character += event.text
            return

        if event.type == self.pg.MOUSEBUTTONDOWN and event.button == 1:
            pos = event.pos
            buttons = self._button_rects()
            if buttons["clear"].collidepoint(pos):
                self.clear()
                return
            if buttons["undo"].collidepoint(pos):
                self.undo()
                return
            if buttons["input"].collidepoint(pos):
                self.input_active = True
                return
            self.input_active = False
            if self.use_mouse and self._square_rect().inflate(-8, -8).collidepoint(pos):
                self.mouse_drawing = True
                self.current_tracking_id = 1
                self.current_stroke = [pos]
                self.indicator = pos
                self.status_text = "Drawing with mouse"
            return

        if event.type == self.pg.MOUSEMOTION and self.mouse_drawing:
            pos = event.pos
            if self._square_rect().inflate(-8, -8).collidepoint(pos):
                if not self.current_stroke or self._distance(self.current_stroke[-1], pos) >= 1.2:
                    self.current_stroke.append(pos)
                    self.indicator = pos
            return

        if event.type == self.pg.MOUSEBUTTONUP and event.button == 1 and self.mouse_drawing:
            self.mouse_drawing = False
            self._finish_stroke()
            self.indicator = None
            return

    def _process_queue(self) -> None:
        try:
            while True:
                kind, payload = self.queue.get_nowait()
                if kind == "frame":
                    self._handle_frame(payload)
                elif kind == "status":
                    self.status_text = str(payload)
                elif kind == "error":
                    self.status_text = str(payload)
        except queue.Empty:
            pass

    def _handle_frame(self, frame: TouchFrame) -> None:
        if not isinstance(frame, TouchFrame):
            return
        active = frame.points
        if len(active) != 1:
            self.raw_pos_text = "-" if not active else f"{len(active)} touches"
            if len(active) > 1:
                self.status_text = "Ignoring multi-touch, use one finger only"
            self._finish_stroke()
            self.indicator = None
            return

        slot, tracking_id, raw_x, raw_y = active[0]
        self.raw_pos_text = f"slot {slot}: {raw_x}, {raw_y}"
        point = self._map_raw_point(raw_x, raw_y)
        self.indicator = point
        if point is None:
            return

        if self.current_tracking_id != tracking_id:
            self._finish_stroke()
            self.current_tracking_id = tracking_id
            self.current_stroke = [point]
        else:
            if not self.current_stroke or self._distance(self.current_stroke[-1], point) >= 1.2:
                self.current_stroke.append(point)

        self.status_text = "Drawing"

    def _map_raw_point(self, raw_x: int, raw_y: int) -> Optional[Point]:
        if self.spec is None:
            return None
        square = self._square_rect()
        x_span = max(1, self.spec.x_max - self.spec.x_min)
        y_span = max(1, self.spec.y_max - self.spec.y_min)
        nx = min(max((raw_x - self.spec.x_min) / x_span, 0.0), 1.0)
        ny = min(max((raw_y - self.spec.y_min) / y_span, 0.0), 1.0)
        return (square.left + nx * square.width, square.top + ny * square.height)

    def _square_rect(self):
        width, height = self.screen.get_size()
        left_area_width = max(320, width - SIDE_WIDTH - PADDING * 3)
        left = PADDING
        top = 108
        available_height = max(260, height - top - PADDING)
        size = int(min(left_area_width, available_height) - 24)
        size = max(220, size)
        x = left + (left_area_width - size) // 2
        y = top + (available_height - size) // 2
        return self.pg.Rect(x, y, size, size)

    def _panel_rect(self):
        width, height = self.screen.get_size()
        return self.pg.Rect(width - SIDE_WIDTH - PADDING, 108, SIDE_WIDTH, height - 108 - PADDING)

    def _button_rects(self):
        panel = self._panel_rect()
        clear = self.pg.Rect(panel.left, panel.top + 120, panel.width, BUTTON_HEIGHT)
        undo = self.pg.Rect(panel.left, clear.bottom + 12, panel.width, BUTTON_HEIGHT)
        input_rect = self.pg.Rect(panel.left, panel.top + 40, panel.width, BUTTON_HEIGHT)
        return {"input": input_rect, "clear": clear, "undo": undo}

    def _finish_stroke(self) -> None:
        if len(self.current_stroke) >= 2:
            self.strokes.append(self.current_stroke[:])
        elif len(self.current_stroke) == 1:
            p = self.current_stroke[0]
            self.strokes.append([(p[0] - 0.1, p[1]), (p[0] + 0.1, p[1])])
        self.current_stroke = []
        self.current_tracking_id = None

    def _distance(self, a: Point, b: Point) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])

    def clear(self) -> None:
        self.strokes.clear()
        self.current_stroke.clear()
        self.current_tracking_id = None
        self.status_text = "Cleared"

    def undo(self) -> None:
        if self.current_stroke:
            self.current_stroke.clear()
            self.current_tracking_id = None
        elif self.strokes:
            self.strokes.pop()
        self.status_text = "Undid last stroke"

    def _draw(self) -> None:
        pg = self.pg
        self.screen.fill((245, 247, 251))

        title = self.font_title.render("Trackpad Chinese Writing Practice", True, (17, 24, 39))
        subtitle = self.font_small.render(
            "One finger = one stroke. Lift between strokes. C clear, U undo, G grid, O overlay, Tab edit char.",
            True,
            (71, 85, 105),
        )
        self.screen.blit(title, (PADDING, 24))
        self.screen.blit(subtitle, (PADDING, 62))

        square = self._square_rect()
        self._draw_square(square)
        self._draw_strokes(square)
        self._draw_panel()

        pg.display.flip()

    def _draw_square(self, square) -> None:
        pg = self.pg
        pg.draw.rect(self.screen, (252, 252, 253), square, border_radius=12)
        pg.draw.rect(self.screen, (75, 85, 99), square, width=2, border_radius=12)

        if self.show_grid:
            dash_color = (163, 174, 190)
            self._draw_dashed_line((square.left, square.centery), (square.right, square.centery), dash_color)
            self._draw_dashed_line((square.centerx, square.top), (square.centerx, square.bottom), dash_color)
            self._draw_dashed_line((square.left, square.top), (square.right, square.bottom), (210, 216, 224))
            self._draw_dashed_line((square.right, square.top), (square.left, square.bottom), (210, 216, 224))

        if self.show_overlay and self.character:
            overlay_text = self.font_overlay.render(self.character, True, (208, 215, 226))
            overlay_rect = overlay_text.get_rect(center=square.center)
            self.screen.blit(overlay_text, overlay_rect)

    def _draw_strokes(self, square) -> None:
        for stroke in self.strokes:
            self._draw_polyline(stroke, (17, 24, 39), 4)
        if self.current_stroke:
            self._draw_polyline(self.current_stroke, (37, 99, 235), 4)
        if self.indicator is not None and square.collidepoint(self.indicator):
            self.pg.draw.circle(self.screen, (37, 99, 235), (int(self.indicator[0]), int(self.indicator[1])), 7, width=2)

    def _draw_polyline(self, points: List[Point], color: Tuple[int, int, int], width: int) -> None:
        if len(points) == 1:
            self.pg.draw.circle(self.screen, color, (int(points[0][0]), int(points[0][1])), width // 2 + 1)
            return
        int_points = [(int(x), int(y)) for x, y in points]
        self.pg.draw.lines(self.screen, color, False, int_points, width)

    def _draw_panel(self) -> None:
        pg = self.pg
        panel = self._panel_rect()
        buttons = self._button_rects()
        pg.draw.rect(self.screen, (255, 255, 255), panel, border_radius=12)
        pg.draw.rect(self.screen, (211, 219, 229), panel, width=1, border_radius=12)

        def text(msg: str, x: int, y: int, font=None, color=(17, 24, 39)):
            font = font or self.font_body
            surface = font.render(msg, True, color)
            self.screen.blit(surface, (x, y))

        text("Target character", panel.left, panel.top, self.font_small, (71, 85, 105))
        input_rect = buttons["input"]
        pg.draw.rect(self.screen, (248, 250, 252), input_rect, border_radius=10)
        pg.draw.rect(
            self.screen,
            (37, 99, 235) if self.input_active else (203, 213, 225),
            input_rect,
            width=2,
            border_radius=10,
        )
        display_char = self.character if self.character else "Click here or press Tab"
        text(display_char, input_rect.left + 12, input_rect.top + 10, self.font_body)

        self._draw_button(buttons["clear"], "Clear strokes")
        self._draw_button(buttons["undo"], "Undo last stroke")

        info_y = buttons["undo"].bottom + 24
        text("Input mode", panel.left, info_y, self.font_small, (71, 85, 105))
        mode = "mouse" if self.use_mouse else (self.spec.name if self.spec else "none")
        text(mode, panel.left, info_y + 26)

        text("Raw touch position", panel.left, info_y + 72, self.font_small, (71, 85, 105))
        text(self.raw_pos_text, panel.left, info_y + 98)

        text("Status", panel.left, info_y + 144, self.font_small, (71, 85, 105))
        self._blit_wrapped(self.status_text, panel.left, info_y + 170, panel.width, self.font_small, (17, 24, 39))

        tips_y = info_y + 250
        text("Tips", panel.left, tips_y, self.font_small, (71, 85, 105))
        tips = [
            "Use one finger only",
            "Lift between strokes",
            "Tab focuses the character field",
            "Chinese IME text input may work here",
            "You can also start with --character 永",
        ]
        y = tips_y + 28
        for line in tips:
            bullet = self.font_small.render(f"• {line}", True, (17, 24, 39))
            self.screen.blit(bullet, (panel.left, y))
            y += 28

    def _draw_button(self, rect, label: str) -> None:
        self.pg.draw.rect(self.screen, (239, 244, 255), rect, border_radius=10)
        self.pg.draw.rect(self.screen, (147, 197, 253), rect, width=1, border_radius=10)
        surf = self.font_body.render(label, True, (30, 64, 175))
        surf_rect = surf.get_rect(center=rect.center)
        self.screen.blit(surf, surf_rect)

    def _draw_dashed_line(self, start: Tuple[int, int], end: Tuple[int, int], color: Tuple[int, int, int], dash: int = 10) -> None:
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        distance = max(1.0, math.hypot(dx, dy))
        for i in range(0, int(distance), dash * 2):
            a = i / distance
            b = min(i + dash, distance) / distance
            x1 = start[0] + dx * a
            y1 = start[1] + dy * a
            x2 = start[0] + dx * b
            y2 = start[1] + dy * b
            self.pg.draw.line(self.screen, color, (x1, y1), (x2, y2), 1)

    def _blit_wrapped(self, text: str, x: int, y: int, max_width: int, font, color: Tuple[int, int, int]) -> None:
        words = text.split()
        if not words:
            return
        line = words[0]
        cursor_y = y
        for word in words[1:]:
            trial = f"{line} {word}"
            if font.size(trial)[0] <= max_width:
                line = trial
            else:
                surface = font.render(line, True, color)
                self.screen.blit(surface, (x, cursor_y))
                cursor_y += font.get_linesize() + 2
                line = word
        surface = font.render(line, True, color)
        self.screen.blit(surface, (x, cursor_y))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Practice writing Chinese characters using a Linux touchpad")
    parser.add_argument("--device", help="Specific evdev device path, e.g. /dev/input/event10")
    parser.add_argument("--mouse", action="store_true", help="Use mouse mode instead of raw touchpad input")
    parser.add_argument("--character", default="永", help="Initial overlay character")
    parser.add_argument("--list-devices", action="store_true", help="List compatible touchpad devices and exit")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    touchpads = find_touchpads()

    if args.list_devices:
        if not touchpads:
            print("No compatible touchpads found.")
            return
        for spec in touchpads:
            print(f"{spec.path}: {spec.name} x=[{spec.x_min},{spec.x_max}] y=[{spec.y_min},{spec.y_max}]")
        return

    spec: Optional[TouchpadSpec] = None
    if args.device:
        for candidate in touchpads:
            if candidate.path == args.device:
                spec = candidate
                break
        if spec is None:
            raise SystemExit(f"Requested device {args.device} not found among compatible touchpads")
    elif touchpads:
        spec = touchpads[0]

    app = PracticeApp(spec=spec, use_mouse=args.mouse, initial_character=args.character)
    app.run()


if __name__ == "__main__":
    main()
