#!/usr/bin/env python3
"""
API integration suites (one per sprint, plus the release suite).

    pnpm --filter api build            # suites run against apps/api/dist
    python3 apps/api/test/integration/run.py               # all suites
    python3 apps/api/test/integration/run.py sprint14_check.py sprint07_check.py

Needs the dev database migrated + seeded (apps/api/.env, `pnpm --filter api db:seed` or `prisma db seed`).
For each suite the harness starts its OWN API process on :4100 (fresh rate limits), runs the suite from the
repo root, then stops exactly that process — it never kills other processes, and refuses to start if :4100 is
already in use. Push goes to a local mock of the Expo push API so push outcomes are deterministic:
tokens containing "[fb" are rejected (request fails → FAILED), all others are accepted.
"""
import http.server, json, os, re, signal, socket, subprocess, sys, threading, time, urllib.request  # noqa: E401
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
API_DIR = REPO / 'apps' / 'api'
API_PORT, MOCK_PORT, CONTROL_PORT = int(os.environ.get('MESS_TEST_PORT', '4100')), 4199, 4198
LOG = HERE / 'api.log'
BASE_ENV = {
    'NODE_ENV': 'development',
    'PUSH_PROVIDER': 'expo',
    'EXPO_PUSH_URL': f'http://127.0.0.1:{MOCK_PORT}/push',
    'EXPO_ACCESS_TOKEN': '',
    'OTP_DEV_ECHO': 'true',
    # Suites reuse seeded student numbers; the OTP resend cooldown lives in the DB and would otherwise
    # carry over between back-to-back suites (test environment only).
    'OTP_RESEND_SECONDS': '1',
}


def load_dotenv():
    env = {}
    for line in (API_DIR / '.env').read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k] = v
    return env


def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(('127.0.0.1', port)) == 0


class Api:
    proc = None

    def start(self, extra=None):
        env = {**os.environ, **load_dotenv(), **BASE_ENV, 'PORT': str(API_PORT), **(extra or {})}
        self.proc = subprocess.Popen(['node', 'dist/main.js'], cwd=API_DIR, env=env, stdout=open(LOG, 'a'), stderr=subprocess.STDOUT)
        for _ in range(120):
            time.sleep(0.5)
            if self.proc.poll() is not None:
                raise RuntimeError(f'API exited during startup (see {LOG})')
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{API_PORT}/api/v1/health', timeout=2) as r:
                    if r.status == 200:
                        return
            except Exception:
                pass
        raise RuntimeError('API did not become healthy')

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.send_signal(signal.SIGTERM)
            try:
                self.proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
        self.proc = None
        for _ in range(40):
            if not port_open(API_PORT):
                return
            time.sleep(0.25)


API = Api()


class MockExpo(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        messages = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'[]')
        if any('[fb' in m.get('to', '') for m in messages):
            self._send(400, {'errors': [{'code': 'VALIDATION_ERROR', 'message': 'invalid push token (mock)'}]})
        else:
            self._send(200, {'data': [{'status': 'ok', 'id': f'mock-{i}'} for i, _ in enumerate(messages)]})

    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class Control(MockExpo):
    """POST /restart {"env": {...}} — lets a suite restart the harness-owned API with extra env."""

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        API.stop()
        API.start(body.get('env') or {})
        self._send(200, {'ok': True})


def serve(handler, port):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main():
    global API_PORT
    if port_open(API_PORT):
        # Never touch someone else's server (e.g. a running dev API): use the next free port instead.
        API_PORT = next(p for p in range(API_PORT + 10, API_PORT + 60) if not port_open(p))
        print(f'Port in use; running the test API on :{API_PORT}')
    if not (API_DIR / 'dist' / 'main.js').exists():
        sys.exit('apps/api/dist is missing. Run `pnpm --filter api build` first.')
    suites = sys.argv[1:] or sorted(p.name for p in HERE.glob('sprint*_check.py'))
    servers = [serve(MockExpo, MOCK_PORT), serve(Control, CONTROL_PORT)]
    summary = []
    try:
        for name in suites:
            print(f'\n=== {name}', flush=True)
            API.start()
            out = subprocess.run([sys.executable, str(HERE / name)], cwd=REPO, capture_output=True, text=True,
                                 env={**os.environ, 'MESS_TEST_CONTROL': f'http://127.0.0.1:{CONTROL_PORT}',
                                      'MESS_TEST_BASE': f'http://localhost:{API_PORT}/api/v1'})
            API.stop()
            text = out.stdout + out.stderr
            fails = [l for l in text.splitlines() if l.startswith('FAIL')]
            m = re.search(r'(\d+)/(\d+) checks passed', text)
            ok = out.returncode == 0 and m and m.group(1) == m.group(2) and not fails
            for l in fails:
                print('  ' + l[:300])
            if out.returncode != 0 or not m:
                print(text[-1500:])
            print(f'  {m.group(0) if m else "did not finish"}')
            summary.append((name, bool(ok), m.group(0) if m else 'crashed'))
    finally:
        API.stop()
        for s in servers:
            s.shutdown()
    print('\n' + '\n'.join(f'{"PASS" if ok else "FAIL"}  {n}: {r}' for n, ok, r in summary))
    sys.exit(0 if all(ok for _, ok, _ in summary) else 1)


if __name__ == '__main__':
    main()
