function gone() {
  return new Response("Gone", {
    status: 410,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function GET() {
  return gone();
}
export function HEAD() {
  return new Response(null, { status: 410 });
}
export function POST() {
  return gone();
}
export function PUT() {
  return gone();
}
export function PATCH() {
  return gone();
}
export function DELETE() {
  return gone();
}
