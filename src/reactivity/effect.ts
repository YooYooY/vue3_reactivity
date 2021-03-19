import { isArray, isInteger } from '../shared/index'

export function effect(fn, options: any = {}) {
  const effect = createReactiveEffect(fn, options)

  if (!options.lazy) {
    effect()
  }

  return effect
}

let activeEffect // 用来存储当前的 effect 函数
let uid = 0

// effect(()=>{
//     state.name;
//     effect(()=>{
//         state.age
//     });
//     state.address
// })
const effectStack = []
function createReactiveEffect(fn, options) {
  const effect = function () {
      console.log("1、effect");
      
    if (effectStack.includes(effect)) return // 防止递归执行 target[key]++
    try {
        console.log("2、保存当前effect函数到activeEffect");
        
      activeEffect = effect
      effectStack.push(activeEffect)
      return fn()
    } finally {
      //   activeEffect = null;
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1]
    }
  }
  effect.id = uid++
  effect.deps = []
  effect.options = options

  return effect
}

const targetMap = new WeakMap()
// targetMap = {target:{key:[effect,effect]}}

// 属性和effect关联
export function track(target, key) {
  if (activeEffect == undefined) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
  console.log(`5、${key} => 收集依赖：`, targetMap)
}

export enum TriggerType {
  add = 'add',
  set = 'set',
}

export function trigger(target, type: TriggerType, key, value?, oldValue?) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return;
  
  if(!depsMap.get(key)){
      console.warn(`没有找到 ${key} 的effects`)
      return;
  }
  
  console.log(`7、${key} => 触发更新`)
  
  const run = (effects) => {
    if (effects) effects.forEach((effect) => {
        if(effect.options.scheduler){
            console.log('scheduler 执行')
            
            effect.options.scheduler(effect)
        }else{
            console.log(`8、获取${key} => targetMap的effect执行`)
            console.log("===== 进入key存储的effect =====");
            
            effect();
        }
    })
  }

  if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= value) {
        run(dep)
      }
    })
  } else {
    if (key != void 0) {
      run(depsMap.get(key))
    }
    switch (type) {
      case TriggerType.add:
        if (isArray(target)) {
          // 数组通过索引增加选项
          if (isInteger(key)) {
            run(depsMap.get('length'))
          }
        }
    }
  }
}
