/**
 * Turns the generated component list into layers for drawing.
 *
 * A component sits one layer below its deepest dependency, which is exactly
 * the order Nuon deploys in. Edges naming a component that is not in the list
 * are dropped rather than drawn into nothing, and a cycle is broken rather
 * than allowed to hang the render. Neither should occur in a valid config,
 * but a half-edited TOML must not blank the page.
 */
import type { ComponentNode } from './config-data.gen'

export interface GraphNode {
  name: string
  type: string
  layer: number
}

export interface GraphEdge {
  from: string
  to: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  layers: string[][]
}

export function buildGraph(components: ComponentNode[]): Graph {
  const known = new Set(components.map((c) => c.name))
  const deps = new Map(
    components.map((c) => [
      c.name,
      Array.from(new Set(c.dependencies.filter((d) => known.has(d)))),
    ]),
  )

  const edges: GraphEdge[] = []
  for (const c of components) {
    for (const d of deps.get(c.name) ?? []) edges.push({ from: d, to: c.name })
  }

  // Place a component one layer below the deepest thing it names. Kahn's
  // algorithm: repeatedly take everything whose dependencies are all placed.
  // Anything still unplaced is in a cycle: place it at layer 0 rather than
  // invent a depth for it. Cycles should not occur in a valid config, but a
  // half-edited TOML must not blank the page or shift every other node.
  const layer = new Map<string, number>()
  let remaining = components.map((c) => c.name)
  while (remaining.length > 0) {
    const ready = remaining.filter((n) =>
      (deps.get(n) ?? []).every((d) => layer.has(d)),
    )
    if (ready.length === 0) {
      for (const n of remaining) layer.set(n, 0)
      break
    }
    for (const n of ready) {
      const parents = deps.get(n) ?? []
      layer.set(
        n,
        parents.length === 0 ? 0 : Math.max(...parents.map((p) => layer.get(p)!)) + 1,
      )
    }
    remaining = remaining.filter((n) => !ready.includes(n))
  }

  const nodes: GraphNode[] = components.map((c) => ({
    name: c.name,
    type: c.type,
    layer: layer.get(c.name) ?? 0,
  }))

  const depth = nodes.reduce((m, n) => Math.max(m, n.layer), -1)
  const layers: string[][] = Array.from({ length: depth + 1 }, () => [])
  for (const n of nodes) layers[n.layer].push(n.name)

  return { nodes, edges, layers }
}
