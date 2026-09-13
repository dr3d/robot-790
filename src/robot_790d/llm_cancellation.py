"""Interruptible provider I/O; conversation mutations stay on the pipeline thread."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from queue import Empty, Full, Queue
from socket import SHUT_RDWR
from threading import BoundedSemaphore, Event, Lock, Thread
from typing import Any

# Cancelled socket cleanup must not permit unbounded outstanding requests.
_PROVIDER_WORKERS = BoundedSemaphore(4)


class CancellableProviderEvents:
    def __init__(
        self,
        request: Callable[[], Any],
        iterate: Callable[[Any], Iterator[Any]],
        cancelled: Callable[[], bool],
    ) -> None:
        self.cancelled = cancelled
        self.stop = Event()
        self.finished = Event()
        self.queue: Queue[tuple[str, Any]] = Queue(maxsize=32)
        self.lock = Lock()
        self.response: Any = None
        self.close_started = False
        if not _PROVIDER_WORKERS.acquire(blocking=False):
            raise RuntimeError("Previous cancelled LLM requests are still closing; please retry shortly.")
        self.worker = Thread(target=self._run, args=(request, iterate), daemon=True, name="eric-provider-read")
        try:
            self.worker.start()
        except BaseException:
            _PROVIDER_WORKERS.release()
            raise

    def _put(self, kind: str, value: Any = None) -> None:
        while not self.stop.is_set():
            try:
                self.queue.put((kind, value), timeout=0.05)
                return
            except Full:
                continue

    def _close_response(self, abort: bool = False) -> None:
        with self.lock:
            response = self.response
            if response is None or self.close_started:
                return
            self.close_started = True
        try:
            raw = getattr(response, "response", response)
            if abort and getattr(raw, "http_version", None) == "HTTP/1.1":
                # httpx exposes this request's HTTP/1 socket. Shutdown wakes a
                # blocked read; never shutdown a multiplexed HTTP/2 connection.
                stream = getattr(raw, "extensions", {}).get("network_stream")
                sock = stream.get_extra_info("socket") if stream is not None else None
                if sock is not None:
                    try:
                        sock.shutdown(SHUT_RDWR)
                    except OSError:
                        pass
            close = getattr(response, "close", None)
            if callable(close):
                close()
        except Exception:
            pass

    def _run(self, request: Callable[[], Any], iterate: Callable[[Any], Iterator[Any]]) -> None:
        events = None
        try:
            if self.stop.is_set() or self.cancelled():
                return
            response = request()
            with self.lock:
                self.response = response
            if self.stop.is_set():
                return
            events = iterate(response)
            for event in events:
                if self.stop.is_set():
                    break
                self._put("event", event)
        except Exception as exc:
            self._put("error", exc)
        finally:
            try:
                if events is not None:
                    close = getattr(events, "close", None)
                    if callable(close):
                        close()
            finally:
                self._close_response()
                self.finished.set()
                _PROVIDER_WORKERS.release()

    def __iter__(self) -> Iterator[Any]:
        while not self.stop.is_set():
            if self.cancelled():
                self.close()
                return
            try:
                kind, value = self.queue.get(timeout=0.05)
            except Empty:
                if self.finished.is_set():
                    return
                continue
            if self.cancelled():
                self.close()
                return
            if kind == "error":
                raise value
            yield value

    def close(self) -> None:
        if self.stop.is_set():
            return
        self.stop.set()
        # Closing a synchronous HTTP stream can itself wait for its reader.
        # Never make the next conversational turn wait for that cleanup.
        if not self.finished.is_set():
            Thread(target=self._close_response, args=(True,), daemon=True, name="eric-provider-close").start()
