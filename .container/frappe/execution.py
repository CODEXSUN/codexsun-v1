"""Timestamped, redacted operator output and bounded subprocess execution."""

from datetime import datetime, timezone
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time


class Transcript:
    def __init__(self, root, secret_values=()):
        self.secrets = secret_values
        folder = Path(root, "logs")
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = folder / ("install-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".log")
        self.stream = self.path.open("x", encoding="utf-8")
        os.chmod(self.path, 0o600)

    def redact(self, value):
        for secret in self.secrets:
            value = value.replace(secret, "[redacted]")
        return value

    def write(self, value):
        value = self.redact(str(value)).rstrip()
        print(value, flush=True)
        self.stream.write(datetime.now(timezone.utc).isoformat() + " " + value + "\n")
        self.stream.flush()

    def close(self):
        self.stream.close()


class Runner:
    def __init__(self, root, environment, transcript=None):
        self.root, self.environment, self.transcript = root, environment, transcript

    def run(self, args, capture=False, input=None, timeout=7200):
        if capture:
            # Captured Docker inspection/configuration can contain secrets. Never log it.
            return subprocess.run(args, cwd=self.root, env=self.environment, check=True,
                                  text=True, capture_output=True, input=input, timeout=timeout)
        emit = self.transcript.write if self.transcript else lambda line: print(line, flush=True)
        emit("Running: " + " ".join(args))
        messages = queue.Queue()
        with subprocess.Popen(args, cwd=self.root, env=self.environment, text=True,
                              encoding="utf-8", errors="replace", stdin=subprocess.PIPE,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT) as process:
            if input is not None:
                process.stdin.write(input)
            process.stdin.close()
            def collect():
                for line in process.stdout:
                    messages.put(line)
                messages.put(None)
            reader = threading.Thread(target=collect, daemon=True)
            reader.start()
            start = time.monotonic()
            while True:
                if time.monotonic() - start > timeout:
                    process.terminate()
                    raise RuntimeError("Command timed out. Inspect --status and logs before retrying; Docker work may remain active.")
                try:
                    line = messages.get(timeout=1)
                except queue.Empty:
                    continue
                if line is None:
                    break
                emit(line)
            reader.join(timeout=5)
            code = process.wait(timeout=30)
            if code:
                raise subprocess.CalledProcessError(code, args)
        return subprocess.CompletedProcess(args, 0)
