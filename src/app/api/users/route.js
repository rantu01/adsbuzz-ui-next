import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Users API ready', users: [] });
}

export async function POST() {
  return NextResponse.json({ message: 'User created' });
}
