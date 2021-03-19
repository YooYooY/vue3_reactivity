import { isArray } from "../shared/index";

class ObjectRefImpl {
  public readonly __v_isRef = true
  constructor(public object, public key) {}
  get value() {
    return this.object[this.key]
  }
  set value(newValue) {
    this.object[this.key] = newValue
  }
}

export function toRefs(object){
    const result = isArray(object) ? new Array(object.length) : {};
    for(let key in object){
        result[key] = new ObjectRefImpl(object,key);
    }
    return result
}