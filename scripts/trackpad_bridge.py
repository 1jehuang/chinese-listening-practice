#!/usr/bin/env python3
"""Native Linux touchpad to browser bridge.

Reads raw multitouch coordinates from a Linux touchpad and broadcasts normalized
absolute-position stroke events to browser clients over a localhost WebSocket.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import signal
import time
from dataclasses import dataclass, field
from typing import Optional, Set

import websockets
from websockets.server import WebSocketServerProtocol

from trackpad_write_practice import Calibration, TouchFrame, TouchpadReader, TouchpadSpec, find_touchpads


@dataclass
class BridgeConfig:
    host: str = "127.0.0.1"
    port: int = 8766
    smoothing_strength: float = 0.22
    lift_debounce_ms: int = 35
    calibration: Calibration = field(default_factory=Calibration)


class AsyncQueueSink:
    def __init__(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
        self.loop = loop
        self.queue = queue

    def put(self, item) -> None:
        self.loop.call_soon_threadsafe(self.queue.put_nowait, item)


class NativeBridge:
    def __init__(self, spec: TouchpadSpec, config: BridgeConfig):
        self.spec = spec
        self.config = config
        self.clients: Set[WebSocketServerProtocol] = set()
        self.current_tracking_id: Optional[int] = None
        self.current_point: Optional[tuple[float, float]] = None
        self.last_filtered_point: Optional[tuple[float, float]] = None
        self.last_raw_point: Optional[tuple[float, float]] = None
        self.last_sample_time: Optional[float] = None
        self.pending_finish_deadline: Optional[float] = None
        self.pending_resume_origin: Optional[tuple[float, float]] = None
        self.last_status_message = (
            f"Using {spec.name} on {spec.path} · smoothing {config.smoothing_strength:.2f} · debounce {config.lift_debounce_ms}ms"
        )

    async def add_client(self, websocket: WebSocketServerProtocol) -> None:
        self.clients.add(websocket)
        await websocket.send(json.dumps({
            "type": "bridge_status",
            "connected": True,
            "message": self.last_status_message,
            "device": self.spec.name,
            "path": self.spec.path,
        }))

    def remove_client(self, websocket: WebSocketServerProtocol) -> None:
        self.clients.discard(websocket)

    async def broadcast(self, payload: dict) -> None:
        if not self.clients:
            return
        message = json.dumps(payload)
        stale = []
        for client in list(self.clients):
            try:
                await client.send(message)
            except Exception:
                stale.append(client)
        for client in stale:
            self.clients.discard(client)

    async def update_status(self, message: str, error: bool = False) -> None:
        self.last_status_message = message
        await self.broadcast({
            "type": "bridge_status" if not error else "bridge_error",
            "message": message,
            "device": self.spec.name,
            "path": self.spec.path,
        })

    async def process_frame(self, frame: TouchFrame) -> None:
        active = frame.points
        if len(active) != 1:
            if len(active) > 1:
                await self.update_status("Ignoring multi-touch, use one finger only")
            self._schedule_finish_if_needed()
            return

        _slot, tracking_id, raw_x, raw_y = active[0]
        point = self._map_normalized(raw_x, raw_y)
        if point is None:
            return

        resume_pending = False
        if self.pending_finish_deadline is not None and self.current_point is not None and self.pending_resume_origin is not None:
            if self._distance(self.pending_resume_origin, point) <= 0.08:
                resume_pending = True
                self._cancel_pending_finish()

        if resume_pending:
            self.current_tracking_id = tracking_id
        elif self.current_tracking_id != tracking_id or self.current_point is None:
            await self._finish_now()
            self.current_tracking_id = tracking_id
            self._reset_filter()
            filtered = self._filter_point(point, frame.timestamp)
            self.current_point = filtered
            await self.broadcast({
                "type": "stroke_start",
                "x": filtered[0],
                "y": filtered[1],
                "t": frame.timestamp,
            })
            await self.update_status("Native bridge drawing")
            return

        filtered = self._filter_point(point, frame.timestamp)
        if self.current_point is None or self._distance(self.current_point, filtered) >= 0.001:
            self.current_point = filtered
            await self.broadcast({
                "type": "stroke_move",
                "x": filtered[0],
                "y": filtered[1],
                "t": frame.timestamp,
            })

    async def maybe_flush_finish(self) -> None:
        if self.pending_finish_deadline is None:
            return
        if time.monotonic() >= self.pending_finish_deadline:
            await self._finish_now()

    def _schedule_finish_if_needed(self) -> None:
        if self.current_point is None or self.pending_finish_deadline is not None:
            return
        self.pending_finish_deadline = time.monotonic() + (self.config.lift_debounce_ms / 1000.0)
        self.pending_resume_origin = self.current_point

    def _cancel_pending_finish(self) -> None:
        self.pending_finish_deadline = None
        self.pending_resume_origin = None

    async def _finish_now(self) -> None:
        if self.current_point is not None:
            await self.broadcast({
                "type": "stroke_end",
                "x": self.current_point[0],
                "y": self.current_point[1],
                "t": time.monotonic(),
            })
        self.current_tracking_id = None
        self.current_point = None
        self._cancel_pending_finish()
        self._reset_filter()

    def _reset_filter(self) -> None:
        self.last_filtered_point = None
        self.last_raw_point = None
        self.last_sample_time = None

    def _map_normalized(self, raw_x: int, raw_y: int) -> Optional[tuple[float, float]]:
        x_span = max(1, self.spec.x_max - self.spec.x_min)
        y_span = max(1, self.spec.y_max - self.spec.y_min)
        nx = min(max((raw_x - self.spec.x_min) / x_span, 0.0), 1.0)
        ny = min(max((raw_y - self.spec.y_min) / y_span, 0.0), 1.0)

        x_denom = max(0.05, 1.0 - self.config.calibration.left - self.config.calibration.right)
        y_denom = max(0.05, 1.0 - self.config.calibration.top - self.config.calibration.bottom)
        nx = (nx - self.config.calibration.left) / x_denom
        ny = (ny - self.config.calibration.top) / y_denom
        nx = min(max(nx, 0.0), 1.0)
        ny = min(max(ny, 0.0), 1.0)
        return (nx, ny)

    def _filter_point(self, point: tuple[float, float], sample_time: float) -> tuple[float, float]:
        if self.last_filtered_point is None or self.last_raw_point is None or self.last_sample_time is None:
            self.last_filtered_point = point
            self.last_raw_point = point
            self.last_sample_time = sample_time
            return point

        dt = max(1e-3, sample_time - self.last_sample_time)
        speed = self._distance(point, self.last_raw_point) / dt
        base_alpha = 0.62 - self.config.smoothing_strength * 0.42
        adaptive_gain = min(0.34, speed / 30.0)
        alpha = min(0.94, max(0.08, base_alpha + adaptive_gain))
        filtered = (
            self.last_filtered_point[0] + alpha * (point[0] - self.last_filtered_point[0]),
            self.last_filtered_point[1] + alpha * (point[1] - self.last_filtered_point[1]),
        )
        self.last_raw_point = point
        self.last_filtered_point = filtered
        self.last_sample_time = sample_time
        return filtered

    @staticmethod
    def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])


async def bridge_handler(websocket: WebSocketServerProtocol, bridge: NativeBridge):
    await bridge.add_client(websocket)
    try:
        await websocket.wait_closed()
    finally:
        bridge.remove_client(websocket)


async def run_bridge(spec: TouchpadSpec, config: BridgeConfig) -> None:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    bridge = NativeBridge(spec, config)
    sink = AsyncQueueSink(loop, queue)
    reader = TouchpadReader(spec, sink)
    reader.start()

    stop_event = asyncio.Event()

    def request_stop(*_args):
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, request_stop)
        except NotImplementedError:
            signal.signal(sig, lambda *_args: stop_event.set())

    async with websockets.serve(lambda ws: bridge_handler(ws, bridge), config.host, config.port):
        print(f"Bridge listening on ws://{config.host}:{config.port}")
        print(f"Touchpad: {spec.name} ({spec.path})")
        while not stop_event.is_set():
            try:
                kind, payload = await asyncio.wait_for(queue.get(), timeout=0.01)
                if kind == "frame":
                    await bridge.process_frame(payload)
                elif kind == "status":
                    await bridge.update_status(str(payload))
                elif kind == "error":
                    await bridge.update_status(str(payload), error=True)
            except asyncio.TimeoutError:
                pass
            await bridge.maybe_flush_finish()

    reader.stop()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bridge Linux touchpad input into the browser over WebSocket")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind the WebSocket server")
    parser.add_argument("--port", type=int, default=8876, help="Port to bind the WebSocket server")
    parser.add_argument("--device", help="Specific evdev device path, e.g. /dev/input/event10")
    parser.add_argument("--smoothing", type=float, default=0.22, help="Smoothing strength from 0.0 to 1.0. Lower tracks fast strokes more directly.")
    parser.add_argument("--debounce-ms", type=int, default=35, help="Lift debounce in milliseconds. Lower ends strokes faster.")
    parser.add_argument("--list-devices", action="store_true", help="List compatible touchpad devices and exit")
    return parser.parse_args()


def select_touchpad(device_path: Optional[str]) -> TouchpadSpec:
    touchpads = find_touchpads()
    if not touchpads:
        raise SystemExit("No compatible touchpads found")
    if device_path:
        for spec in touchpads:
            if spec.path == device_path:
                return spec
        raise SystemExit(f"Requested device {device_path} not found")
    return touchpads[0]


def main() -> None:
    args = parse_args()
    if args.list_devices:
        for spec in find_touchpads():
            print(f"{spec.path}: {spec.name} x=[{spec.x_min},{spec.x_max}] y=[{spec.y_min},{spec.y_max}]")
        return

    spec = select_touchpad(args.device)
    smoothing = max(0.0, min(1.0, float(args.smoothing)))
    debounce_ms = max(0, min(150, int(args.debounce_ms)))
    config = BridgeConfig(
        host=args.host,
        port=args.port,
        smoothing_strength=smoothing,
        lift_debounce_ms=debounce_ms,
    )
    asyncio.run(run_bridge(spec, config))


if __name__ == "__main__":
    main()
