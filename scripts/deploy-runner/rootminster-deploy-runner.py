#!/usr/bin/env python3
"""Rootminster deploy runner.

A small host-side service that runs the server's update script when
Rootminster asks it to. It uses only the Python standard library, so it runs
on a stock Ubuntu or Debian VPS without installing anything.

Rootminster can never choose what runs: the script path comes from this
service's own configuration, and requests carry no command or arguments.
Every request except /health must be signed with the shared secret.
Only one run can be active at a time.

Configuration (environment variables, normally from
/etc/rootminster-deploy-runner.env):

  DEPLOY_RUNNER_SECRET     Shared secret, at least 32 characters. Required.
  DEPLOY_RUNNER_SCRIPT     Absolute path of the update script. Required.
  DEPLOY_RUNNER_WORKDIR    Working directory for the script. Default: the
                           script's directory.
  DEPLOY_RUNNER_BIND       Address to listen on. Default 172.17.0.1 (the
                           Docker bridge), which containers can reach and
                           the internet cannot.
  DEPLOY_RUNNER_PORT       Port. Default 9787.
  DEPLOY_RUNNER_STATE_DIR  Where run records and logs are kept. Default
                           /var/lib/rootminster-deploy-runner.
  DEPLOY_RUNNER_TIMEOUT    Seconds before a run is stopped. Default 1800.
  DEPLOY_RUNNER_SHARE_LOG  "1" to return the last lines of a failed run's
                           output to Rootminster. Default "0", because
                           script output can include secrets.
"""

import fcntl
import hashlib
import hmac
import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RUN_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MAX_BODY = 4096
MAX_SKEW = 60
KEEP_RUNS = 50
TAIL_LINES = 15
TAIL_CHARS = 1500
ACTIVE = ("running",)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_settings(environ=os.environ):
    secret = environ.get("DEPLOY_RUNNER_SECRET", "")
    script = environ.get("DEPLOY_RUNNER_SCRIPT", "")
    if len(secret) < 32:
        raise SystemExit("DEPLOY_RUNNER_SECRET must be at least 32 characters")
    if not script or not os.path.isabs(script):
        raise SystemExit("DEPLOY_RUNNER_SCRIPT must be an absolute path")
    if not os.access(script, os.X_OK):
        raise SystemExit(f"DEPLOY_RUNNER_SCRIPT is not executable: {script}")
    return {
        "secret": secret.encode(),
        "script": script,
        "workdir": environ.get("DEPLOY_RUNNER_WORKDIR") or os.path.dirname(script),
        "bind": environ.get("DEPLOY_RUNNER_BIND", "172.17.0.1"),
        "port": int(environ.get("DEPLOY_RUNNER_PORT", "9787")),
        "state_dir": environ.get("DEPLOY_RUNNER_STATE_DIR", "/var/lib/rootminster-deploy-runner"),
        "timeout": int(environ.get("DEPLOY_RUNNER_TIMEOUT", "1800")),
        "share_log": environ.get("DEPLOY_RUNNER_SHARE_LOG", "0") == "1",
    }


def signature(secret, timestamp, nonce, method, path, body):
    message = b".".join([str(timestamp).encode(), nonce.encode(), method.encode(), path.encode(), body])
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


class Runner:
    def __init__(self, settings):
        self.settings = settings
        self.lock = threading.Lock()
        self.seen = {}
        self.runs_dir = os.path.join(settings["state_dir"], "runs")
        self.logs_dir = os.path.join(settings["state_dir"], "logs")
        os.makedirs(self.runs_dir, mode=0o700, exist_ok=True)
        os.makedirs(self.logs_dir, mode=0o700, exist_ok=True)
        # Refuses to start if another runner already holds the state directory.
        self.lock_file = open(os.path.join(settings["state_dir"], "runner.lock"), "w")
        fcntl.flock(self.lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.recover()

    # Run records ----------------------------------------------------------

    def path(self, run_id):
        return os.path.join(self.runs_dir, f"{run_id}.json")

    def read(self, run_id):
        try:
            with open(self.path(run_id)) as handle:
                return json.load(handle)
        except FileNotFoundError:
            return None

    def write(self, run):
        temporary = self.path(run["id"]) + ".tmp"
        with open(temporary, "w") as handle:
            json.dump(run, handle)
        os.replace(temporary, self.path(run["id"]))

    def all_runs(self):
        runs = []
        for name in os.listdir(self.runs_dir):
            if name.endswith(".json"):
                run = self.read(name[:-5])
                if run:
                    runs.append(run)
        return sorted(runs, key=lambda run: run.get("started_at") or "")

    def active(self):
        return next((run for run in self.all_runs() if run.get("status") in ACTIVE), None)

    def recover(self):
        # A run left "running" by a previous runner process lost its watcher.
        for run in self.all_runs():
            if run.get("status") in ACTIVE:
                run.update(status="failed", finished_at=now_iso(), error="The deploy runner restarted during this run.")
                self.write(run)

    def prune(self):
        runs = self.all_runs()
        for run in runs[:-KEEP_RUNS]:
            if run.get("status") in ACTIVE:
                continue
            for target in (self.path(run["id"]), os.path.join(self.logs_dir, f"{run['id']}.log")):
                try:
                    os.remove(target)
                except FileNotFoundError:
                    pass

    def public(self, run):
        view = {key: run.get(key) for key in ("id", "status", "requested_by", "started_at", "finished_at", "exit_code", "error")}
        if self.settings["share_log"] and run.get("status") == "failed":
            view["log_tail"] = self.tail(run["id"])
        return view

    def tail(self, run_id):
        try:
            with open(os.path.join(self.logs_dir, f"{run_id}.log"), "rb") as handle:
                handle.seek(0, os.SEEK_END)
                handle.seek(max(0, handle.tell() - 16384))
                lines = handle.read().decode("utf-8", "replace").splitlines()[-TAIL_LINES:]
        except FileNotFoundError:
            return ""
        return "\n".join(lines)[-TAIL_CHARS:]

    # Requests ---------------------------------------------------------------

    def verify(self, headers, method, path, body):
        timestamp = headers.get("X-Rootminster-Timestamp", "")
        nonce = headers.get("X-Rootminster-Nonce", "")
        provided = headers.get("X-Rootminster-Signature", "")
        if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > MAX_SKEW:
            return False
        if not re.fullmatch(r"[0-9a-f]{32}", nonce):
            return False
        expected = signature(self.settings["secret"], timestamp, nonce, method, path, body)
        if not hmac.compare_digest(expected, provided):
            return False
        with self.lock:
            cutoff = time.time() - 2 * MAX_SKEW
            self.seen = {key: seen_at for key, seen_at in self.seen.items() if seen_at > cutoff}
            if nonce in self.seen:
                return False
            self.seen[nonce] = time.time()
        return True

    def start(self, run_id, requested_by):
        with self.lock:
            existing = self.read(run_id)
            if existing:
                return 200, self.public(existing)
            current = self.active()
            if current:
                return 409, {"error": "A deploy is already running.", "run": self.public(current)}
            log = open(os.path.join(self.logs_dir, f"{run_id}.log"), "wb")
            run = {"id": run_id, "status": "running", "requested_by": requested_by, "started_at": now_iso(), "finished_at": None, "exit_code": None, "error": None}
            environment = {**os.environ, "ROOTMINSTER_DEPLOY_ID": run_id, "ROOTMINSTER_DEPLOY_REQUESTED_BY": requested_by}
            environment.pop("DEPLOY_RUNNER_SECRET", None)
            try:
                process = subprocess.Popen(
                    [self.settings["script"]], cwd=self.settings["workdir"], env=environment,
                    stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
                )
            except OSError as error:
                log.close()
                run.update(status="failed", finished_at=now_iso(), error=f"The update script could not start: {error.strerror}")
                self.write(run)
                return 202, self.public(run)
            log.close()
            run["pid"] = process.pid
            self.write(run)
        print(f"{now_iso()} deploy {run_id} started by {requested_by}", flush=True)
        threading.Thread(target=self.watch, args=(run, process), daemon=True).start()
        with self.lock:
            self.prune()
        return 202, self.public(run)

    def watch(self, run, process):
        try:
            code = process.wait(timeout=self.settings["timeout"])
            run.update(status="succeeded" if code == 0 else "failed", exit_code=code,
                       error=None if code == 0 else f"The update script exited with code {code}.")
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=30)
            except (subprocess.TimeoutExpired, ProcessLookupError):
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            run.update(status="failed", error=f"The update script was stopped after {self.settings['timeout']} seconds.")
        run["finished_at"] = now_iso()
        run.pop("pid", None)
        with self.lock:
            self.write(run)
        print(f"{now_iso()} deploy {run['id']} {run['status']}", flush=True)


def make_handler(runner):
    class Handler(BaseHTTPRequestHandler):
        server_version = "rootminster-deploy-runner"
        sys_version = ""

        def log_message(self, format, *args):
            sys.stderr.write(f"{now_iso()} {self.address_string()} {format % args}\n")

        def send(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def body(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return None
            return self.rfile.read(length) if length else b""

        def authorised(self, body):
            if runner.verify(self.headers, self.command, self.path, body):
                return True
            self.send(401, {"error": "Invalid signature."})
            return False

        def do_GET(self):
            if self.path == "/health":
                return self.send(200, {"ok": True})
            match = re.fullmatch(r"/runs/([0-9a-f-]{36})", self.path)
            if not match:
                return self.send(404, {"error": "Not found."})
            if not self.authorised(b""):
                return None
            run = runner.read(match.group(1)) if RUN_ID.match(match.group(1)) else None
            return self.send(200, runner.public(run)) if run else self.send(404, {"error": "Run not found."})

        def do_POST(self):
            if self.path != "/runs":
                return self.send(404, {"error": "Not found."})
            body = self.body()
            if body is None:
                return self.send(413, {"error": "Request too large."})
            if not self.authorised(body):
                return None
            try:
                payload = json.loads(body or b"{}")
            except ValueError:
                return self.send(400, {"error": "Invalid JSON."})
            run_id = str(payload.get("id", ""))
            if not RUN_ID.match(run_id):
                return self.send(400, {"error": "Invalid run ID."})
            requested_by = re.sub(r"[^\w@.+() -]", "", str(payload.get("requested_by", "")))[:120] or "unknown"
            status, result = runner.start(run_id, requested_by)
            return self.send(status, result)

    return Handler


def main():
    settings = load_settings()
    runner = Runner(settings)
    server = ThreadingHTTPServer((settings["bind"], settings["port"]), make_handler(runner))
    print(f"{now_iso()} deploy runner listening on {settings['bind']}:{settings['port']}, script {settings['script']}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
