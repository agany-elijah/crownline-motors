import "server-only"

import { headers } from "next/headers"

import { AdminLoginEventKind, AdminSessionEndReason } from "@/generated/prisma/enums"
import { describeDevice } from "@/lib/auth/device-label"
import { prisma } from "@/lib/prisma"

/**
 * The application's record of dashboard sessions and sign-in activity.
 *
 * Supabase issues and refreshes the tokens; this module decides whether a
 * given session is still one Crownline accepts. See the AdminSession model for
 * why that record has to be ours. Every function takes the administrator's id
 * as well as the session it acts on, so no call can end or read another
 * person's sessions by naming their id.
 */

/** `lastSeenAt` is refreshed at most this often, not on every request. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

/** The device making the current request, as a coarse label. */
export async function currentDeviceLabel(): Promise<string | null> {
  const headerList = await headers()
  return describeDevice(headerList.get("user-agent"))
}

/**
 * The `session_id` claim of an access token Supabase has just returned.
 *
 * Decoded without verifying the signature, which is safe only because of
 * where the token comes from: the response body of our own server-side call
 * to Supabase, not anything a client sent. Every later request reads the
 * claim through `getClaims()`, which does verify.
 */
export function sessionIdFromAccessToken(accessToken: string): string | null {
  const payload = accessToken.split(".")[1]
  if (!payload) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { session_id?: unknown }
    return typeof claims.session_id === "string" ? claims.session_id : null
  } catch (error) {
    // A malformed token from our own auth provider is an incident worth
    // seeing; the caller treats null as "no session to record" and the DAL
    // records the session on its first request instead.
    console.error("[sessions] could not read the session id from an access token", error)
    return null
  }
}

export interface ActiveAdminSession {
  id: string
  authSessionId: string
  createdAt: Date
  expiresAt: Date
}

export type AdminSessionVerdict =
  | { status: "ACTIVE"; session: ActiveAdminSession }
  | { status: "ENDED" }
  | { status: "EXPIRED" }

/**
 * Is this Supabase session one Crownline still accepts?
 *
 * Records the session if it has never been seen — one that predates this
 * table, or whose sign-in write failed — rather than refusing it, which would
 * sign everyone out on deploy. Marks it expired once it is older than the
 * configured timeout, and refuses one that has been ended from elsewhere.
 *
 * Throws on a database error. This is part of the authorisation boundary, and
 * a boundary that cannot check must deny — the caller lets it surface.
 */
export async function checkAdminSession(input: {
  adminId: string
  authSessionId: string
  timeoutHours: number
}): Promise<AdminSessionVerdict> {
  const select = { id: true, adminId: true, createdAt: true, lastSeenAt: true, endedAt: true } as const

  const session =
    (await prisma.adminSession.findUnique({ where: { authSessionId: input.authSessionId }, select })) ??
    (await prisma.adminSession.upsert({
      where: { authSessionId: input.authSessionId },
      update: {},
      create: {
        adminId: input.adminId,
        authSessionId: input.authSessionId,
        deviceLabel: await currentDeviceLabel(),
      },
      select,
    }))

  // A session id never changes owner. If it somehow names another
  // administrator's row, the answer is no.
  if (session.adminId !== input.adminId || session.endedAt) return { status: "ENDED" }

  const now = Date.now()
  const expiresAt = new Date(session.createdAt.getTime() + input.timeoutHours * 60 * 60 * 1000)

  if (expiresAt.getTime() <= now) {
    await prisma.adminSession.updateMany({
      where: { id: session.id, endedAt: null },
      data: { endedAt: new Date(now), endReason: AdminSessionEndReason.EXPIRED },
    })
    return { status: "EXPIRED" }
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    try {
      // Conditional, so a burst of parallel requests writes once.
      await prisma.adminSession.updateMany({
        where: { id: session.id, lastSeenAt: { lt: new Date(now - TOUCH_INTERVAL_MS) } },
        data: { lastSeenAt: new Date(now) },
      })
    } catch (error) {
      // "Last active" being a few minutes stale is not worth refusing a
      // request over; the session itself was verified above.
      console.error("[sessions] failed to update last activity", error)
    }
  }

  return {
    status: "ACTIVE",
    session: { id: session.id, authSessionId: input.authSessionId, createdAt: session.createdAt, expiresAt },
  }
}

/** Records a session at sign-in. A repeat for the same session changes nothing. */
export async function registerAdminSession(input: {
  adminId: string
  authSessionId: string
  deviceLabel: string | null
}): Promise<void> {
  try {
    await prisma.adminSession.upsert({
      where: { authSessionId: input.authSessionId },
      update: {},
      create: input,
    })
  } catch (error) {
    // Not fatal: the DAL records the session on its first request.
    console.error("[sessions] failed to record a new session at sign-in", error)
  }
}

export async function endAdminSession(input: {
  adminId: string
  authSessionId: string
  reason: AdminSessionEndReason
}): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { adminId: input.adminId, authSessionId: input.authSessionId, endedAt: null },
    data: { endedAt: new Date(), endReason: input.reason },
  })
}

/** Ends one of this administrator's sessions by its row id. Returns whether one was ended. */
export async function endAdminSessionById(input: {
  adminId: string
  sessionId: string
  reason: AdminSessionEndReason
}): Promise<boolean> {
  const result = await prisma.adminSession.updateMany({
    where: { id: input.sessionId, adminId: input.adminId, endedAt: null },
    data: { endedAt: new Date(), endReason: input.reason },
  })
  return result.count > 0
}

export async function endOtherAdminSessions(input: {
  adminId: string
  keepAuthSessionId: string
  reason: AdminSessionEndReason
}): Promise<number> {
  const result = await prisma.adminSession.updateMany({
    where: { adminId: input.adminId, endedAt: null, authSessionId: { not: input.keepAuthSessionId } },
    data: { endedAt: new Date(), endReason: input.reason },
  })
  return result.count
}

export async function endAllAdminSessions(input: {
  adminId: string
  reason: AdminSessionEndReason
}): Promise<number> {
  const result = await prisma.adminSession.updateMany({
    where: { adminId: input.adminId, endedAt: null },
    data: { endedAt: new Date(), endReason: input.reason },
  })
  return result.count
}

/**
 * Records a sign-in, a failed attempt or a sign-out against an administrator.
 *
 * Best-effort, like the sign-in audit entry: Supabase Auth logs every
 * authentication event on its side, so a failure here costs the convenience
 * of the activity list, not the record.
 */
export async function recordAdminLoginEvent(input: {
  adminId: string
  kind: AdminLoginEventKind
  deviceLabel?: string | null
}): Promise<void> {
  try {
    await prisma.adminLoginEvent.create({
      data: {
        adminId: input.adminId,
        kind: input.kind,
        deviceLabel: input.deviceLabel === undefined ? await currentDeviceLabel() : input.deviceLabel,
      },
    })
  } catch (error) {
    console.error(`[sessions] failed to record ${input.kind}`, error)
  }
}

export interface AdminSessionListItem {
  id: string
  deviceLabel: string | null
  createdAt: Date
  lastSeenAt: Date
}

/** This administrator's open sessions, most recently active first. */
export async function listActiveAdminSessions(adminId: string): Promise<AdminSessionListItem[]> {
  return prisma.adminSession.findMany({
    where: { adminId, endedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true },
    take: 50,
  })
}

export interface AdminLoginEventListItem {
  id: string
  kind: AdminLoginEventKind
  deviceLabel: string | null
  createdAt: Date
}

export async function listAdminLoginEvents(adminId: string, take = 20): Promise<AdminLoginEventListItem[]> {
  return prisma.adminLoginEvent.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, deviceLabel: true, createdAt: true },
    take,
  })
}

/** The most recent successful sign-in, or null. */
export async function getLastAdminSignIn(adminId: string): Promise<Date | null> {
  const event = await prisma.adminLoginEvent.findFirst({
    where: { adminId, kind: AdminLoginEventKind.SIGN_IN_SUCCEEDED },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  return event?.createdAt ?? null
}
