import { isObject } from '../shared/index'
import { mutableHandlers } from './baseHandler'

export function reactive(target) {
  // 将目标对象变成响应式对象，Proxy
  return createReactiveObject(target, mutableHandlers)
}

const proxyMap = new WeakMap()

function createReactiveObject(target, baseHandlers) {
  if (!isObject(target)) return target

  const existingProxy = proxyMap.get(target)
  if (existingProxy) return existingProxy

  const proxy = new Proxy(target, baseHandlers)
  proxyMap.set(target, proxy)

  return proxy
}
