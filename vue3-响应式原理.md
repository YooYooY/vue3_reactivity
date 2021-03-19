# rollup 搭建ts环境

## 安装 rollup 插件
```
npm install rollup rollup-plugin-typescript2 @rollup/plugin-node-resolve @rollup/plugin-replace rollup-plugin-serve typescript -D
```
| 包名                        | 功能             |
| --------------------------- | ---------------- |
| rollup                      | 打包工具         |
| rollup-plugin-typescript2   | 解析ts插件       |
| @rollup/plugin-node-resolve | 解析第三方模块   |
| @rollup/plugin-replace      | 替换插件         |
| rollup-plugin-serve         | 启动本地服务插件 |

## 配置打包环境

生成 `tsconfig.json` 文件：

```sh
npx tsx --init
```

修改 `tsconfig.json` 配置属性 `module` 为 `ESNext`（默认在浏览器运行）

> 可以设置 `strict` 属性为false，让 ts 支持 any 类型，`scouceMap` 需要设置成 true，方便调试代码

根目录新建 `rollup.config.js` 配置文件，并输入下面内容：
```js
import path from "path";
import ts from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import serve from "rollup-plugin-serve";

export default {
  input: 'src/index.ts',
  output: {
    name: 'VueReactivity',
    format: 'umd',
    file: path.resolve('dist/VueReactivity.js'),
    sourcemap: true,
  },
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts'],
    }),
    ts({
      tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    }),
    replace({
        "process.env.NODE_ENV": JSON.stringify("development"),
    }),
    serve({
        open: true,
        openPage: "/public/index.html",
        port: 3000,
        contentBase: ""
    })
  ],
}
```

新建入口文件`srx/index.ts`和模板文件`public/index.html`。

> 模板文件 index.html 需要手动引入打包后的 /dist/vue.js

`package.json` 添加打包命令：
```
"scripts": {
  "dev": "rollup -c -w"
}
```

# reactivity模块

先看看Vue的`reactivity`模块实现效果，先安装 `reactivity`:

```sh
npm install @vue/reactivity
```

测试 `public/index.html` 内容：

```html
<div id="app"></div>
<script src="/node_modules/@vue/reactivity/dist/reactivity.global.js"></script>
<script>
    const {reactive, effect} = VueReactivity;
    const state = reactive({name:"chenwl",age:12,address:"guangzhou1"});
    effect(()=>{
        app.innerHTML = `${state.name} 今年 ${state.age} 岁`
    });
    
    // 当 effect 函数中依赖的数据发生变化 effect 会重新执行
    setTimeout(() => {
        state.name = "change"
    }, 1000);
</script>
```

**核心：当读取文件时，做依赖收集，当数据变化时重新执行effect**

## 初始化目录结构

```
-src
 - reactivity
 	- effect.ts
 	- reactive.ts
 	- index.ts
 - shared
 	- index.ts //通用方法
 - index.ts
```

reactivity/index.ts
```
export { reactive } from './reactive'
export { effect } from './effect'
```
src/index.ts
```
export * from "./reactivity/index"
```

## 创建响应式对象

reactive/reactive.ts

```ts
import { isObject } from "../shared/index"

const mutableHandlers = {
    get(){},
    set(){}
}

export function reactive(target){
    // 将目标对象变成响应式对象，Proxy
    return createReactiveObject(target, mutableHandlers)
}

// 核心：当读取文件时，做依赖收集，当数据变化时重新执行effect
function createReactiveObject(target, baseHandlers) {
   // 如果是不是对象，直接返回
  if(!isObject(target)) return target;
    
  return new Proxy(target, baseHandlers)
}
```

简单的实现下 `isObject` 方法：
```ts
export const isObject = (val) => typeof val === 'object' && val !== null
```

#### Proxy优势:

- `Proxy` 直接监听对象而非属性，只是对外层对象做代理，默认不会递归，不会重写对象中的属性
- `Proxy` 可以直接监听数组的变化
- `Proxy` 返回的是一个新对象,我们可以只操作新的对象达到目的,而 Object.defineProperty 只能遍历对象属性直接修改


## 创建映射表

为防止对象被重复代理，这里使用`WeakMap`创建代理元素的映射表，如果对象被代理过，则直接返回：
```ts
// 映射表
const proxyMap = new WeakMap()

function createReactiveObject(target, baseHandlers) {
  if (!isObject(target)) return target
  
  // 从映射表中取出，判断是否被代理过
  const existingProxy = proxyMap.get(target)
  if (existingProxy) return existingProxy

  const proxy = new Proxy(target, baseHandlers)
  // 放入代理对象
  proxyMap.set(target, proxy)

  return proxy
}
```

> WeakMap 相对于 Map 也是键值对集合，但是 WeakMap 的key 只能是非空对象(non-null object)，WeakMap 对它的 key 仅保持弱引用，也就是说它不阻止垃圾回收器回收它所引用的 key，WeakMap 最大的好处是可以避免内存泄漏。一个仅被 WeakMap 作为 key 而引用的对象，会被垃圾回收器回收掉。

## 代理工厂函数

为了方便管理代理逻辑，这里拆分 `mutableHandlers` 对象到新文件`/reactivity/haseHandler.ts` 中。

reactivity/haseHandler.ts
```ts
function createGetter() {
  return function get(target, key, reaciver) {}
}

function createSetter() {
  return function set(target, key, value, receiver) {}
}

const get = createGetter();
const set = createSetter()

export const mutableHandlers = {
  get,  // 获取对象会执行此方法
  set, // 设置属性值会执行此方法
}
```
> set 和 get 方法通过工厂函数创建，工厂函数的可以方便参数的传参和预置

在 `reactive.ts` 文件中引入：

```ts
import { mutableHandlers } from './baseHandler'

export function reactive(target) {
  // 将目标对象变成响应式对象，Proxy
  return createReactiveObject(target, mutableHandlers)
}
```


### getter 方法

当代理对象的属性被获取时：
```ts
function createGetter() {
  return function get(target, key, reaciver) {
    const res = Reflect.get(target, key, reaciver) // 相当于 target[key];
	
    // 不对 symbol 类型做处理
    if (typeof key === 'symbol') return res;

    console.log('此时代理对象的属性被获取')
	
    // 如果是对象，进行递归代理
    if (isObject(res)) return reactive(res);

    return res
  }
}
```

### setter 方法

在对属性进行设置之前，需要判断是`修改值`还是`新增值`，并且需要注意，如果是数组，需要判断修改的方式是否通过索引添加：
```
let arr = [1];
arr[10] = 10; // 通过索引新增值的数组
```

所以判断之前，还需要对`target`进行判断，如果是数组，需要增加索引判读。

> 数组索引比原数组长度小 ? 修改 : 新增
 

通过`target[key]`先获取旧值，然后再跟新值比对判断。

代码逻辑：
```ts
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
    }else if (hasChanged(value, oldValue)) {
      console.log('修改属性')
    }
    
    return result
  }
}
```

通用方法：
```ts
export const isArray = Array.isArray

export const isInteger = (key) => '' + parseInt(key, 10) === key

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (val, key) => hasOwnProperty.call(val,key);

export const hasChanged = (value, oldValue) => value !== oldValue
```

修改模板 `public/index.html` 下的引用，可以看到控制台输出对应的属性设置操作。

```html
<script src="../dist/VueReactivity.js"></script>
<script>
  const { reactive, effect } = VueReactivity
  const state = reactive({ name: 'chenwl', age: 12, address: 'guangzhou1' })

  state.name = 'change' // 修改属性
  state.newProp = 'newProp' // 新增属性

  const stateArr = reactive(['a', 'b', 'c'])
  stateArr[0] = 'array change' // 数组修改
  stateArr[3] = 'add array' // 数组新增
</script>
```

## effect 函数

回到开始写的 `public/index.html` 内容：

```html
<div id="app"></div>
<script src="../dist/VueReactivity.js"></script>
<script>
    const { reactive, effect } = VueReactivity
    const state = reactive({ name: 'chenwl', age: 12 })
    effect(()=>{
        app.innerHTML = `${state.name} 今年 ${state.age} 岁`
    });

    setTimeout(() => {
    	state.name = 'change' // 修改属性
    }, 1000)
</script>
```

页面初始化后，`app` 标签的内容为 `chenwl 今年 12 岁`，一秒后修改为：`change 今年 12 岁`。

> 当代理对象的值发生改变时，`effect`函数参数里面用户自定义的方法也会执行

### 初始化 effect 函数

上面的逻辑可以得到，`effect` 方法第一个参数为用户自定义的方法，里面存放用户自己的逻辑，这个方法在下面的情况下会执行：

- options.lazy 为 false，初始化时执行
- 出现在自定义函数里面的代理对象发生改变

修改 `effect.ts` 如下：
```ts
export function effect(fn, options: any = {}) {
  const effect = createReactiveEffect(fn, options)

  if (!options.lazy) {
    effect()
  }

  return effect
}

function createReactiveEffect(fn, options) {
  const effect = function () {
    return fn() // 用户自己写的逻辑，内部会对数据进行取值操作
  }

  return effect
}
```

### 收集依赖

声明变量 `activeEffect` 存储当前执行的 `effect` 函数：

```ts
let activeEffect; // 用来存储当前的effect函数
function createReactiveEffect(fn, options) {
  const effect = function () {
    activeEffect = effect
    return fn()
  }
  return effect
}
```

> fn 函数执行时，函数上下文的响应式变量会做取值(`getter`)操作，此时可以通过`activeEffect`获取当前响应式变量关联的`effect`

```js
// fn函数执行，触发响应式变量`state`的取值操作
effect(() => {
  app.innerHTML = `${state.name} 今年 ${state.age} 岁`
})

...

// baseHandler.ts
function createGetter(){
    return function get(target, key, reaciver) {
        // 触发取值操作
    }
}
```

#### track依赖收集

为了将响应式属性和effect进行关联，这里声明 `track` 函数进行依赖收集：

```ts
// effect.ts
export function track(target,key){
	if(activeEffect === undefined) return;
}
```

当调用`fn()`时,会执行用户传入的函数,此时会进行取值操作，我们在这里实现依赖收集功能：
```ts
// baseHandler.ts 
function createGetter() {
  return function get(target, key, reaciver) {
    console.log('此时代理对象的属性被获取')
    track(target, key)
  }
}
```

建立映射表，存储 `effect` 更新函数 和 `响应式属性` 的关系：

```js
// 映射表
const targetMap = new WeakMap(); 
// targetMap = {target:{key:[effect,effect]}}
// 属性和effect关联
export function track(target, key) {
  if (!activeEffect) return

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
}
```

```diff
 let activeEffect; // 用来存储当前的effect函数
+let uid = 0;
function createReactiveEffect(fn, options) {
  const effect = function () {
      activeEffect = effect
      return fn()
  }
+  effect.id = uid++ // effect标识
+  effect.deps = [] // 用来表示 effect 中依赖了哪些属性
+  effect.options = options // effect中参数

  return effect
}
```

#### 清空 activeEffect

当依赖收集完成，需要清空当前的 `activeEffect` 方法：

```diff
function createReactiveEffect(fn, options) {
  const effect = function () {
+    try {
      activeEffect = effect
      return fn()
+    } finally {
+      activeEffect = null
+    }
  }
  ...
  return effect
}

export function track(target, key) {
  if (!activeEffect) return; // 不存在或被清空不执行映射关系存储
}
```

但是如果出现下面的情况：

```js
effect(()=>{
    state.name;
    effect(()=>{
        state.age
    });
    state.address
})
```
内部的`effect`方法在收集完依赖后，就会清空`activeEffect`方法，导致最后的`state.address` 没有被收集。

栈结构清空，保证清空的是最后一个`effect`

```diff
 let activeEffect
 let uid = 0
+ const effectStack = []
function createReactiveEffect(fn, options) {
  const effect = function () {
    try {
      activeEffect = effect
+      effectStack.push(activeEffect)
      return fn()
    } finally {
+      effectStack.pop()
+      activeEffect = effectStack[effectStack.length - 1]
    }
  }
  effect.id = uid++
  effect.deps = []
  effect.options = options

  return effect
}
```

处理死循环：

```
effect(() => {
  state.age++
  app.innerHTML = `${state.name} 今年 ${state.age} 岁`
})
```

`state.age`一直在变化会导致effect不断的递归执行，为防止这种情况，如果`effectStack`存储了同样的`effect`略过：
```diff
const effectStack = []
function createReactiveEffect(fn, options) {
  const effect = function () {
+    if (effectStack.includes(effect)) return
    try {} finally {}
  }
  ...
}
```

### trigger触发更新

依赖收集后，接下来触发函数更新，这里实现`trigger`函数触发更新：

```ts
export enum TriggerType {
  add = 'add',
  set = 'set',
}

export function trigger(target, type:TriggerType, key, value?, oldValue?) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const run = (effects) => {
    if (effects) effects.forEach((effect) => effect())
  }

  if (key != void 0) {
    run(depsMap.get(key))
  }
}
```

设置响应式属性时，触发 `trigger`
```diff
function createSetter() {
  return function set(target, key, value, receiver) {
    const oldValue = target[key] 
    ...
    if (!hasKey) {
      // 新增属性
+      trigger(target, TriggerType.add, key, value)
    } else if (hasChanged(value, oldValue)) {
      // 修改属性
+      trigger(target, TriggerType.set, key, value, oldValue)
    }
    ...
  }
}
```

#### 数组触发的更新

情况一：收集和修改都是数组属性(length)

```
const state = reactive([1, 2, 3])
effect(() => {
  app.innerHTML = state.length
})
setTimeout(() => {
  state.length = 100
}, 1000)
```
结果：触发更新

情况二：修改数组长度，没有收集数组属性
```
const state = reactive([1, 2, 3])
effect(() => {
  app.innerHTML = state[2]
})
setTimeout(() => {
  state.length = 1
}, 1000)
```
结果：属性修改，没有触发更新

修改条件判断:
```js
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
}
```

情况三：通过索引增加数组选项，收集数组长度小于修改长度

```ts
const state = reactive([1, 2, 3])
effect(() => {
  app.innerHTML = state
})
setTimeout(() => {
  state[10] = 10
}, 1000)
```

结果：通过索引修改，没有触发更新

添加条件判断:
```
switch (type) {
  case 'add':
    if (isArray(target)) {
      // 数组通过索引增加选项
      if (isInteger(key)) {
        run(depsMap.get('length'))
      }
    }
}
```

完整的 `trigger` 函数：
```
export enum TriggerType {
  add = 'add',
  set = 'set',
}

export function trigger(target, type: TriggerType, key, value?, oldValue?) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const run = (effects) => {
    if (effects) effects.forEach((effect) => effect())
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
      case 'add':
        if (isArray(target)) {
          // 数组通过索引增加选项
          if (isInteger(key)) {
            run(depsMap.get('length'))
          }
        }
    }
  }
}
```

## 响应式过程

通过下面的例子来回顾下vue3响应式执行的过程

```js
const { reactive, effect } = VueReactivity

// reactive 方法将参数变成响应式对象
const state = reactive({ name: 'chenwl' })

// effect 内部如何操作
effect(() => {
  app.innerHTML = `姓名：${state.name}`
})

setTimeout(() => {
  state.name = 'change'
}, 1000)
```

首先 reactive 将参数变成响应式对象并返回，接着就是effect函数的执行过程

```
let activeEffect;
const effect = function (fn){
    console.log("1、effect 函数执行");
    try{
        console.log("2、保存当前effect函数到 activeEffect");
        activeEffect = effect;
        console.log("3、fn 函数执行");
        fn()
    }finally{
        // 清空 activeEffect
    }
}
```

`fn()` 函数执行，`state.name` 作为响应式属性会进入它的`getter`访问器：

```js
function createGetter() {
  return function get(target, key, reaciver) {
    const res = Reflect.get(target, key, reaciver) // 相当于 target[key];

    if (typeof key === 'symbol') return res // 不对 symbol 类型做处理

    console.log(`4、进入 ${key} => getter 访问器`)
    track(target, key)

    if (isObject(res)) return reactive(res) // 如果是对象，进行递归代理

    return res
  }
}
```

在 `getter` 访问器里面，`track` 会收集当前属性所依赖的effect函数：
```js
const targetMap = new WeakMap()
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
  // targetMap = { target: { key: [effect, effect] } }
  console.log(`5、${key} => 收集依赖：`, targetMap)
}
```

`state.name` 发生修改操作，进入到响应式属性的设置方法并触发`trigger`更新方法：

```js
function createSetter() {
  return function set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver)
    
    console.log(`6、${key} => 修改属性`)
    trigger(target, TriggerType.set, key, value, oldValue)
    
    return result
  }
}
```
`trigger`方法里面找到`targetMap`对应的`target.key`,获取当前响应式属性所在的effect函数并执行更新操作

```js
export function trigger(target, type: TriggerType, key, value?, oldValue?) {

  console.log(`8、${key} => 触发更新`)

  const run = (effects=[]) => {
    effects.forEach(effect=>{
        console.log(`9、获取${key} => targetMap的effect执行`)
        console.log('===== 进入key存储的effect =====')
        effect();
    })
  }

  if (key != void 0) {
    run(depsMap.get(key))
  }
 
}
```

控制台打印结果：
```
1、effect
2、保存当前effect函数到activeEffect
3、fn函数执行
4、进入 name => getter 访问器
5、name => 收集依赖： WeakMap {{…} => Map(1)}
6、name => 修改属性
7、name => 触发更新
8、获取name => targetMap的effect执行
===== 进入key存储的effect =====
1、effect
2、保存当前effect函数到activeEffect
3、fn函数执行
4、进入 name => getter 访问器
5、name => 收集依赖： WeakMap {{…} => Map(1)}
```


# 计算属性 Computed

## computed 使用

计算属性 `computed` 的使用:

```html
<div id="app"></div>
<script src="/node_modules/@vue/reactivity/dist/reactivity.global.js"></script>
<script>
  const { reactive, effect, computed } = VueReactivity

  const state = reactive({ name: 'chenwl', age: 12 })
  const birth_year = computed(() => {
    return new Date().getFullYear() - state.age
  })

  effect(() => {
    app.innerHTML = `${state.name} 出生于 ${birth_year.value} 年`
  })

  setTimeout(() => {
    state.age++
  }, 1000)
</script>
```

当 `state.age` 的值发生变化时，依赖于它的 `birth_year` 会重新执行计算属性。

## computed 返回值

通过打印 `birth_year` 可以在控制台看到它的值：

```
ComputedRefImpl = {
  __v_isReadonly: true,
  __v_isRef: true,
  _dirty: true,
  setter: ƒ,
  effect: ƒ,
  _value: 2008,
  value: 2008,
}
```

> 默认计算属性的值被包装到了value属性上

## 初始化 computed

新建 `reactivity/computed.ts` 并导出：

```
export function computed(getterOrOptions) {
  let getter
  let setter

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = () => console.warn('computed not set value')
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
}
```

`computed` 接收一个参数，这个参数可能是函数也可能是 `{getter,setter}` 对象，初始化函数并对参数进行判断。

## ComputedRefImpl 类

通过上面 `birth_year` 的打印结果，可以发现计算属性返回的是一个 `ComputedRefImpl` 实例，所以声明 `ComputedRefImpl` 类：

```ts
import { effect } from './effect.ts'

class ComputedRefImpl {
  public effect
  constructor(getter, setter) {
    // 默认 getter 执行时会依赖于 effect（计算属性默认是effect）
    this.effect = effect(getter, {
      lazy: true, // 默认初始化不执行
    })
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
```

声明 `ComputedRefImpl` 类的公共属性和`value`属性的访问器 `get` 和设置 `set`:
```ts
import { effect, track } from './effect.ts'

class ComputedRefImpl {
  public effect
  public __v_isReadonly = true
  public __v_isRef = true // 判断是否直接返回 value 值
  public _dirty = true // 缓存数据
  private _value
  constructor(getter, public setter) {
    // 默认 getter 执行时会依赖于 effect（计算属性默认是effect）
    this.effect = effect(getter, {
      lazy: true,
    })
  }
  get value() {
    // 当计算属性执行时，收集计算属性的 effect
    this._value = this.effect()
    return this._value
  }
  set value(newValue) {
    this.setter(newValue)
  }
}
```

## 计算属性的依赖收集和scheduler

分析

计算属性里面的响应式属性一旦被修改，需要通知计算属性所在的effect函数做出更新操作：

如下，计算属性 `birth_year` 里面包含响应式属性 `state.age`:
```js
const birth_year = computed(()=>{
    return new Date().getFullYear() - state.age
})
```

当`state.age`做出修改操作:
```js
setTimeout(() => {
    state.age++
}, 1000);
```

通知`birth_year`所在的`effect`函数做出更新操作：
```js
effect(() => {
  app.innerHTML = `出生于 ${birth_year.value} 年`
})
```

逻辑实现：

1、首先第一个 effect 方法开始执行，产生 `activeEffect` 并存储在 `stackEffects` 数组中:
```
const stackEffects = [activeEffect]
```

这里的 `activeEffect` 等于下面的方法：
```
effect1 = () => {
  app.innerHTML = `出生于 ${birth_year.value} 年`
}
```
也就是:
```
const stackEffects = [effect1]
```

2、接下来会进入计算属性 `birth_year` 的访问器 `value` 方法，需要返回计算属性的执行结果：
```js
get value(){
    return new Date().getFullYear() - state.age
}
```

为了记录当前计算属性所依赖的 `effect` 函数，修改`ComputedRefImpl`如下：
```js
private _value;
constructor(getter, public setter) {
    this.effect = effect(getter, {lazy: true})
}
get value() {
    this._value = this.effect()
    return this._value
}
```

`effect` 方法的执行存储了当前计算属性所在的 `activeEffect`，现在`stackEffects` 数组保存了两个 `activeEffect`:

```js
const stackEffects = [effect1,effect2]
```
`effect2`实际上是计算属性的方法：
```js
effect2 = ()=>{
 return new Date().getFullYear() - state.age
}
```

> 第一个 activeEffect 来自更新内容的 effect 函数，第二个 activeEffect 来自 computed


3、`this.effect()` 方法执行后，进入到`state.age`属性访问器进行依赖收集，这里通过`targetMap` 映射表会将`state.age` 和 `activeEffect` 进行关联：

```js
targetMap = {state: { age: effect2 } }
```

4、关联后的 `state.age` 的发生更新操作，触发 `effect2` 函数的重新执行，下面是 `effect1` 和 `effect2` 对应的函数：

```js
effect1 = () => app.innerHTML = `出生于 ${birth_year.value} 年`;
effect2 = ()=> new Date().getFullYear() - state.age;
```

5、计算属性期望的是 `state.age` 的更新能够触发 `effect1` 的重新执行，所以在获取计算属性时，需要进行依赖收集：

```diff
get value() {
    this._value = this.effect()
+    track(this, 'value')
    return this._value
}
```

`track` 的执行让 `targetMap` 里面映射表变成了下面这样：

```js
const targetMap = {
  state: { age: effect2 },
  ComputedRefImpl: { value: effect1 }
}
```

6、为了让 `state.age` 的更新能够触发 `effect1` 的重新执行，修改构effect的options选项，新增`scheduler` 方法：

```js
constructor(getter, public setter) {
    this.effect = effect(getter, {
        lazy: true, // lazy=true 默认不会执行
        scheduler: () => {
            trigger(this, TriggerType.set, 'value')
        },
    })
}
```

修改`effect.ts`里面的 `trigger` 方法：

```js
function trigger(){
...
  const run = (effects=[]) => {
    effects.forEach((effect) => {
        if(effect.options.scheduler){
            effect.options.scheduler(effect)
        }else{
            effect();
        }
    })
  }
 ...
}
```

当 `effect` 有 `scheduler` 属性方法时，执行 `scheduler` 方法，也就是 `state.age` 的修改会执行下面的逻辑：
```js
trigger(this, TriggerType.set, 'value')
```
这个触发更新等于触发了 `effect1` 方法的重新执行：
```js
effect1 = () => app.innerHTML = `出生于 ${birth_year.value} 年`;
```

### 执行过程

computed 的执行：

1、`state.age` 更新触发了 `birth_year` 的 computed effect 函数
2、`computed effect` 执行计算属性的 `scheduler` 方法
3、`scheduler` 触发了 `birth_year.value` 所在的 effect 函数更新

```
state.age => computed effect => scheduler => effect函数(birth_year.value)
```

完整的 `computed` 方法：

```diff
import { effect, track, trigger, TriggerType } from './effect.ts'

class ComputedRefImpl {
  public effect
  public __v_isReadonly = true
  public __v_isRef = true // 判断是否直接返回 value 值
  public _dirty = true // 缓存数据
  private _value
  constructor(getter, public setter) {
    // 默认 getter 执行时会依赖于 effect（计算属性默认是effect）
    this.effect = effect(getter, {
      lazy: true,
+      scheduler: () => {
+        trigger(this, TriggerType.set, 'value')
+      },
    })
  }
  get value() {
    // 当计算属性执行时，收集计算属性的 effect
    this._value = this.effect()
    // 收集计算属性里面的依赖
+    track(this, 'value')
    return this._value
  }
  set value(newValue) {
    this.setter(newValue)
  }
}
```

## 依赖缓存

当修改跟计算属性没有关联的`state.name`时，可以看到`birth_year`的`effect`也会被执行：

```diff
const { reactive, effect, computed } = VueReactivity

const state = reactive({ name: 'chenwl', age: 12 })
const birth_year = computed(() => {
+  console.log('computed execute')
  return new Date().getFullYear() - state.age
})

effect(() => {
  app.innerHTML = `${state.name} 出生于 ${birth_year.value} 年`
})

setTimeout(() => {
+  state.name = 'change'
}, 1000)
```
`state.name`发生改变，控制台打印出 'computed execute'

> 当 `state.name` 所在的 `effect` 函数执行时，`birth_year.value`的属性访问器也会被触发，收集依赖并执行计算属性的`effect`函数。

修改计算属性的value访问器，根据前面声明的公共属性`this._dirty`,判断当前`_dirty`（脏值）是否为 `true` 来决定是否收集依赖和重新获取新值：
```ts
get value() {
    if (this._dirty) {
        this._value = this.effect()
        track(this, 'value')
        this._dirty = false
    }
    return this._value
}
```

当`scheduler`函数被执行时，说明值被修改，需要重新设置`_dirty`:
```diff
constructor(getter, public setter) {
    this.effect = effect(getter, {
        lazy: true,
        scheduler: () => {
+            this._dirty = true
            trigger(this, TriggerType.set, 'value')
        },
    })
}
```

完整的 `computed.ts`:
```ts
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
      this._value = this.effect()
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
```

# Ref

ref的实现，判断传入值是不是对象，对象用`reactive`包裹处理，获取值时收集依赖，设置值时触发更新

```js
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

export function ref(rawValue){
    return new RefImpl(rawValue)
}
```