import { isFunction } from '../shared/index'
import { effect, track, trigger, TriggerType } from './effect'

class ComputedRefImpl {
  public effect
  public __v_isReadonly = true
  public __v_isRef = true // 判断是否直接返回 value 值
  public _dirty = true // 缓存数据
  private _value
  constructor(getter, public setter) {
    this.effect = effect(getter, {
      lazy: true, // lazy=true 默认不会执行
      scheduler: () => {
        this._dirty = true
        trigger(this, TriggerType.set, 'value')
      },
    })
  }
  get value() {
    if (this._dirty) {
      
      console.log("computed effect执行");
      this._value = this.effect()
      
      console.log("收集computed依赖");
      track(this, 'value')
      this._dirty = false
    }
    return this._value
  }
  set value(newValue) {
    this.setter(newValue)
  }
}

export function computed(getterOrOptions) {
  let getter
  let setter

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = () => console.log('computed not set value')
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  return new ComputedRefImpl(getter, setter)
}
