import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { token, device } = await request.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  await prisma.fcmToken.upsert({
    where: { token },
    create: { token, userId: session.user.id, device: device ?? "web" },
    update: { userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  await prisma.fcmToken.deleteMany({
    where: { token, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
