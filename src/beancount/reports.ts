// Turn flat per-account balances into the trees the reports render. A node owns
// its direct postings' balance plus a `total` that sums the whole subtree, so a
// collapsed parent (Expenses) still shows the right figure.

import { Dec } from './decimal'
import type { Balances } from './engine'

export interface TreeNode {
  name: string // last path segment
  account: string // full account path
  children: TreeNode[]
  own: Map<string, Dec> // balances posted directly to this account
  total: Map<string, Dec> // own + all descendants
}

const ROOT_ORDER = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses']

function emptyNode(name: string, account: string): TreeNode {
  return { name, account, children: [], own: new Map(), total: new Map() }
}

function addInto(m: Map<string, Dec>, cur: string, v: Dec) {
  m.set(cur, (m.get(cur) ?? Dec.ZERO).add(v))
}

/** Build a forest of account trees (one root per top-level segment). */
export function buildTree(balances: Balances): TreeNode[] {
  const roots = new Map<string, TreeNode>()

  for (const [account, byCur] of balances) {
    const segments = account.split(':')
    const rootName = segments[0]!
    let node: TreeNode
    const existingRoot = roots.get(rootName)
    if (existingRoot) {
      node = existingRoot
    } else {
      node = emptyNode(rootName, rootName)
      roots.set(rootName, node)
    }
    // walk/create the path, accumulating `total` at each level
    for (const [cur, v] of byCur) addInto(node.total, cur, v)
    let path = rootName
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i]!
      path += ':' + seg
      let child: TreeNode | undefined = node.children.find((c) => c.name === seg)
      if (!child) {
        child = emptyNode(seg, path)
        node.children.push(child)
      }
      for (const [cur, v] of byCur) addInto(child.total, cur, v)
      node = child
    }
    for (const [cur, v] of byCur) addInto(node.own, cur, v)
  }

  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => a.name.localeCompare(b.name))
    n.children.forEach(sortRec)
  }
  const list = [...roots.values()]
  list.forEach(sortRec)
  list.sort((a, b) => {
    const ai = ROOT_ORDER.indexOf(a.name)
    const bi = ROOT_ORDER.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name)
  })
  return list
}

/** Sum the totals of the named roots into one currency→amount map. */
export function sumRoots(tree: TreeNode[], rootNames: string[]): Map<string, Dec> {
  const out = new Map<string, Dec>()
  for (const root of tree) {
    if (!rootNames.includes(root.name)) continue
    for (const [cur, v] of root.total) addInto(out, cur, v)
  }
  return out
}

export const REPORT_ROOTS = ROOT_ORDER
