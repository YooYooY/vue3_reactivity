import { hasChanged, isObject } from "../shared/index";
import { track, trigger, TriggerType } from "./effect";
import { reactive } from "./reactive";

const convert = (val) => isObject(val) ? reactive(val) : val;

class RefImpl {
    public readonly __v_isRef = true;
    private _value;
    constructor(private _rawValue){
        this._value = convert(_rawValue)
    }
    get value(){
        track(this,"value")
        return this._value
    }
    set value(newValue){
        if (hasChanged(newValue, this._rawValue)) {
            this._rawValue = newValue;
            this._value = convert(newValue);
            trigger(this, TriggerType.set, "value");
        }
    }
}

export function ref(rawValue) {
  return new RefImpl(rawValue)
}
