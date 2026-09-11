// src/lib/cluster-diff.ts
/**
 * Pure detectors over successive /api/introspect/namespace payloads.
 *
 * Three things to know before changing anything here:
 * - imageTag() yields '—' when no image is readable. That is "unknown", not a
 *   value, so a move to or from it is never a change.
 * - The poll keeps the previous payload on a failed refresh, so two identical
 *   snapshots are the normal case and must read as "nothing happened".
 * - Pod age is metadata.creationTimestamp; PodSummary has no startTime.
 */
import { imageTag, type NamespaceResponse, type PodSummary } from './api'

const UNKNOWN_TAG = '—'

export interface PodFingerprint {
  name: string
  created: string
  restarts: number
  tag: string
}

function tagOf(pod: PodSummary): string {
  const image =
    pod.status?.containerStatuses?.[0]?.image ?? pod.spec?.containers?.[0]?.image
  return imageTag(image)
}

export function fingerprint(ns: NamespaceResponse | undefined): PodFingerprint[] {
  const pods = ns?.pods ?? []
  return pods.map((pod) => ({
    name: pod.metadata?.name ?? '',
    created: pod.metadata?.creationTimestamp ?? '',
    restarts: (pod.status?.containerStatuses ?? []).reduce(
      (sum, c) => sum + (c.restartCount ?? 0),
      0,
    ),
    tag: tagOf(pod),
  }))
}

/**
 * A redeploy replaces pods with new names, or bumps restartCount in place.
 * A pod merely vanishing is a scale-down, not a restart, and does not count.
 */
export function podsRestarted(
  prev: PodFingerprint[],
  next: PodFingerprint[],
): boolean {
  if (prev.length === 0) return false
  const before = new Map(prev.map((p) => [p.name, p]))
  return next.some((p) => {
    const was = before.get(p.name)
    if (!was) return true
    return p.restarts > was.restarts
  })
}

export function imageTagChanged(
  prev: PodFingerprint[],
  next: PodFingerprint[],
): boolean {
  const known = (list: PodFingerprint[]) =>
    new Set(list.map((p) => p.tag).filter((t) => t !== UNKNOWN_TAG))
  const before = known(prev)
  const after = known(next)
  if (before.size === 0 || after.size === 0) return false
  return [...after].some((t) => !before.has(t))
}

export function workloadAppeared(
  prev: PodFingerprint[],
  next: PodFingerprint[],
  namePrefix: string,
): boolean {
  if (prev.length === 0) return false
  const has = (list: PodFingerprint[]) =>
    list.some((p) => p.name.startsWith(namePrefix))
  return !has(prev) && has(next)
}
