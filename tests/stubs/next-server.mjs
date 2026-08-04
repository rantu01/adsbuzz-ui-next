// Minimal NextResponse stand-in so route handlers can be imported and exercised
// directly under `node --test` without a running Next server.
export class NextResponse {
  constructor(payload, init = {}) {
    this._payload = payload;
    this.status = init?.status ?? 200;
    this.headers = new Headers(init?.headers || {});
  }
  static json(payload, init) {
    return new NextResponse(payload, init);
  }
  async json() {
    return this._payload;
  }
  static redirect(url, init) {
    return new NextResponse(null, { ...init, headers: { Location: url } });
  }
  static next(init) {
    return new NextResponse(null, init);
  }
}

export const NextRequest = globalThis.Request;