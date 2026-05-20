export const dynamic = 'force-dynamic';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8000';

export async function GET() {
  const { cookies } = await import('next/headers');
  const token = (await cookies()).get('auth_token')?.value;
  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const res = await fetch(
    `${API_URL}/api/me/achievements`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
