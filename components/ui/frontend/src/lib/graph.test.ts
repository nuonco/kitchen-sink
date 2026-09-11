import { describe, expect, it } from 'vitest'
import { buildGraph } from './graph'

const c = (name: string, dependencies: string[] = []) => ({
  name,
  type: 'kubernetes_manifest',
  dependencies,
})

describe('buildGraph', () => {
  it('puts dependency-free components in layer 0', () => {
    const g = buildGraph([c('img_api'), c('img_ui')])
    expect(g.layers).toEqual([['img_api', 'img_ui']])
  })

  it('layers a dependant below what it depends on', () => {
    const g = buildGraph([c('img_api'), c('kitchen_sink', ['img_api'])])
    expect(g.layers).toEqual([['img_api'], ['kitchen_sink']])
  })

  it('takes the deepest path when a component has two dependencies', () => {
    const g = buildGraph([
      c('img_api'),
      c('kitchen_sink', ['img_api']),
      c('cert'),
      c('alb', ['cert', 'kitchen_sink']),
    ])
    expect(g.layers[2]).toEqual(['alb'])
  })

  it('drops edges to components that do not exist', () => {
    const g = buildGraph([c('alb', ['ghost'])])
    expect(g.edges).toEqual([])
    expect(g.layers).toEqual([['alb']])
  })

  it('terminates on a cycle instead of hanging', () => {
    const g = buildGraph([c('a', ['b']), c('b', ['a'])])
    expect(g.nodes).toHaveLength(2)
    expect(g.layers.flat().sort()).toEqual(['a', 'b'])
  })

  it('places every member of a cycle at layer 0 rather than inventing depths', () => {
    const g = buildGraph([c('a', ['b']), c('b', ['c']), c('c', ['a'])])
    expect(g.layers).toEqual([['a', 'b', 'c']])
    expect(g.nodes.every((n) => n.layer === 0)).toBe(true)
  })

  it('is empty for no components', () => {
    expect(buildGraph([])).toEqual({ nodes: [], edges: [], layers: [] })
  })
})
