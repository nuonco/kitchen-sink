// src/lib/cluster-diff.test.ts
import { describe, expect, it } from 'vitest'
import type { NamespaceResponse } from './api'
import {
  fingerprint,
  imageTagChanged,
  podsRestarted,
  workloadAppeared,
} from './cluster-diff'

function ns(
  pods: Array<{ name: string; created: string; image?: string; restarts?: number }>,
): NamespaceResponse {
  return {
    pods: pods.map((p) => ({
      metadata: { name: p.name, creationTimestamp: p.created },
      spec: { containers: [{ name: 'app', image: p.image }] },
      status: {
        phase: 'Running',
        containerStatuses: [
          { name: 'app', ready: true, restartCount: p.restarts ?? 0, image: p.image },
        ],
      },
    })),
  } as unknown as NamespaceResponse
}

const A = ns([{ name: 'api-1', created: '2026-09-10T10:00:00Z', image: 'r/api:sha-aaa' }])

describe('fingerprint', () => {
  it('is empty for an absent payload', () => {
    expect(fingerprint(undefined)).toEqual([])
  })
  it('reads name, creation, restarts and tag', () => {
    expect(fingerprint(A)).toEqual([
      { name: 'api-1', created: '2026-09-10T10:00:00Z', restarts: 0, tag: 'sha-aaa' },
    ])
  })
})

describe('podsRestarted', () => {
  it('is false for an unchanged payload', () => {
    expect(podsRestarted(fingerprint(A), fingerprint(A))).toBe(false)
  })
  it('is true when a pod is replaced by a newer one', () => {
    const B = ns([{ name: 'api-2', created: '2026-09-10T10:05:00Z', image: 'r/api:sha-aaa' }])
    expect(podsRestarted(fingerprint(A), fingerprint(B))).toBe(true)
  })
  it('is true when restartCount rises on the same pod', () => {
    const B = ns([{ name: 'api-1', created: '2026-09-10T10:00:00Z', image: 'r/api:sha-aaa', restarts: 1 }])
    expect(podsRestarted(fingerprint(A), fingerprint(B))).toBe(true)
  })
  it('is false when a pod merely disappears', () => {
    expect(podsRestarted(fingerprint(A), fingerprint(ns([])))).toBe(false)
  })
  it('is false on the first poll, before a baseline exists', () => {
    expect(podsRestarted([], fingerprint(A))).toBe(false)
  })
})

describe('imageTagChanged', () => {
  it('is true when a tag moves', () => {
    const B = ns([{ name: 'api-1', created: '2026-09-10T10:00:00Z', image: 'r/api:sha-bbb' }])
    expect(imageTagChanged(fingerprint(A), fingerprint(B))).toBe(true)
  })
  it('ignores the em-dash sentinel in either direction', () => {
    const unknown = ns([{ name: 'api-1', created: '2026-09-10T10:00:00Z' }])
    expect(imageTagChanged(fingerprint(A), fingerprint(unknown))).toBe(false)
    expect(imageTagChanged(fingerprint(unknown), fingerprint(A))).toBe(false)
  })
  it('is false for a new pod carrying the same tag', () => {
    const B = ns([{ name: 'api-2', created: '2026-09-10T10:05:00Z', image: 'r/api:sha-aaa' }])
    expect(imageTagChanged(fingerprint(A), fingerprint(B))).toBe(false)
  })
})

describe('workloadAppeared', () => {
  it('is true only on the transition from absent to present', () => {
    const withExporter = ns([
      { name: 'api-1', created: '2026-09-10T10:00:00Z', image: 'r/api:sha-aaa' },
      { name: 'kitchen-sink-audit-log-exporter-x', created: '2026-09-10T10:06:00Z' },
    ])
    expect(workloadAppeared(fingerprint(A), fingerprint(withExporter), 'kitchen-sink-audit-log-exporter')).toBe(true)
    expect(workloadAppeared(fingerprint(withExporter), fingerprint(withExporter), 'kitchen-sink-audit-log-exporter')).toBe(false)
    expect(workloadAppeared(fingerprint(withExporter), fingerprint(A), 'kitchen-sink-audit-log-exporter')).toBe(false)
  })
  it('is false on the first poll, even if the workload is already running', () => {
    const withExporter = ns([
      { name: 'kitchen-sink-audit-log-exporter-x', created: '2026-09-10T10:06:00Z' },
    ])
    expect(workloadAppeared([], fingerprint(withExporter), 'kitchen-sink-audit-log-exporter')).toBe(false)
  })
})
