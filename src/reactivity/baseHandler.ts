import {
  hasOwn,
  isArray,
  isInteger,
  isObject,
  hasChanged,
} from '../shared/index'
import { track, trigger, TriggerType } from './effect'
import { reactive } from './reactive'

function createGetter() {
  return function get(target, key, reaciver) {
    const res = Reflect.get(target, key, reaciver) // 相当于 target[key];

    if (typeof key === 'symbol') return res // 不对 symbol 类型做处理

    console.log(`4、进入 ${key} => getter 访问器`)
    track(target, key)

    if (res.__v_isRef){
      return res.value
    }

    return isObject(res) ? reactive(res) : res;
  }
}

function createSetter() {
  return function set(target, key, value, receiver) {
    const oldValue = target[key] // 获取旧值，看下有没有这个属性
    
    // 如果是数组，根据索引判断是修改还是新增
    const hasKey =
      isArray(target) && isInteger(key)
        ? Number(key) < target.length
        : hasOwn(target, key)

    const result = Reflect.set(target, key, value, receiver);
    
    if(!hasKey){
        console.log("新增属性");
        trigger(target, TriggerType.add, key, value)
    }else if (hasChanged(value, oldValue)) {
        console.log(`6、${key} => 修改属性`)
        trigger(target, TriggerType.set, key, value, oldValue)
    }
    
    return result
  }
}

const get = createGetter()
const set = createSetter()

export const mutableHandlers = {
  get, // 获取对象会执行此方法
  set, // 设置属性值会执行此方法
}
