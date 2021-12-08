import { random } from '@kazura/web-util'

export interface MessageData<T = any> {
  tag: typeof BaseAPI.MESSAGE_TAG
  type: string
  resources: T
  mid: string
  rid: string
  wid: string
}

export type Callback = (resources: any, event: MessageEvent<MessageData>) => any

interface BaseAPIOptions {
  events?: Array<[string, Callback]>
}

abstract class BaseAPI {
  /**
   * 消息标签 用于分辨其他msg和webpostmsg事件
   */
  public static readonly MESSAGE_TAG = 'application/x-web-postmsg-v1'

  public abstract readonly wid: string

  /**
   * 当前窗口的句柄
   */
  protected readonly self: Window = window

  /**
   * 事件列表
   */
  protected events: Map<string, Callback> = new Map()

  /**
   * 等待响应的事件队列
   */
  protected waitQueue: Map<
    string,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map()

  public constructor(options?: BaseAPIOptions) {
    if (options && options.events) {
      options.events.forEach(([event, callback]) => this.on(event, callback))
    }
    this.self.addEventListener('message', this.eventHandler)
  }

  public abstract postMessage(message: MessageData, targetOrigin?: string): void

  /**
   * 生成一个随机的id
   * @returns
   */
  public generateID() {
    return '' + random(10000, 99999) + new Date().getTime()
  }

  /**
   * 生成一条消息
   * @param type
   * @param resources
   * @param rid
   * @returns
   */
  public generateMsg(type: string, resources: any, rid: string = ''): MessageData {
    return {
      tag: BaseAPI.MESSAGE_TAG,
      type,
      resources,
      mid: this.generateID(),
      rid,
      wid: this.wid,
    }
  }

  /**
   * 事件处理
   * @param event
   * @returns
   */
  protected eventHandler = (event: MessageEvent<MessageData>) => {
    const { data } = event
    if (
      typeof data === 'object' &&
      'tag' in data &&
      data.tag === BaseAPI.MESSAGE_TAG &&
      data.wid === this.wid
    ) {
      /**
       * 收到一条事件回应，根据rid将回应数据交给对应的事件发起者。
       */
      if (data.type === 'REPLY__MSG') {
        const p = this.waitQueue.get(data.rid)
        this.waitQueue.delete(data.rid)
        if (p) p.resolve(data.resources)
        return
      }

      const callback = this.events.get(data.type)
      if (callback) {
        const reply = (resources: any) => this.replyMessage(resources, data.mid)
        const res = callback(data.resources, event)
        if (typeof res === 'object' && 'then' in res && typeof res.then === 'function') {
          res.then((resources: any) => reply(resources))
        } else {
          reply(res)
        }
      }
    }
  }

  /**
   * 发送一条回应
   * @param resources
   * @param mid
   */
  protected replyMessage(resources: any, mid: string) {
    this.postMessage(this.generateMsg('REPLY__MSG', resources, mid))
  }

  /**
   * 事件派发
   * @param resolve
   * @param reject
   * @param event
   * @param resources
   */
  protected eventDispatcher(
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
    event: string,
    resources: any
  ) {
    // 生成消息
    const msg = this.generateMsg('CALL__' + event, resources)
    this.waitQueue.set(msg.mid, { resolve, reject })
    // 派发消息给子窗口
    this.postMessage(msg, '*')
    // 超时处理
    this.self.setTimeout(() => {
      if (this.waitQueue.has(msg.mid)) {
        this.waitQueue.delete(msg.mid)
        reject(new Error('timeout'))
      }
    }, 5000)
  }

  /**
   * 注册一个事件
   * @param event
   * @param callback
   */
  public on(event: string, callback: Callback) {
    this.events.set('CALL__' + event, callback)
  }

  /**
   * 移除一个事件
   * @param event
   */
  public off(event: string) {
    this.events.delete('CALL__' + event)
  }

  /**
   * 派发一个事件
   * @param event
   * @param resources
   * @returns
   */
  public emit(event: string, resources: any) {
    return new Promise<any>((resolve, reject) => {
      this.eventDispatcher(resolve, reject, event, resources)
    })
  }

  /**
   * 析构方法，移除所有副作用。
   */
  public destroy() {
    this.self.removeEventListener('message', this.eventHandler)
  }
}

export interface ParentAPIOptions extends BaseAPIOptions {
  container: HTMLElement
  className?: string
  url?: string
}

class ParentAPI extends BaseAPI {
  /**
   * 子窗口的句柄
   */
  private readonly child: Window

  /**
   * 子窗口ui句柄
   */
  private readonly frame: HTMLIFrameElement

  /**
   * 父窗口指定给子窗口的唯一键值
   */
  public readonly wid: string = this.generateID()

  public constructor(options: ParentAPIOptions) {
    super(options)

    // 创建frame元素
    this.frame = document.createElement('iframe')
    this.frame.name = this.wid
    if (options.className) this.frame.className = options.className
    options.container.appendChild(this.frame)
    this.child = this.frame.contentWindow!

    if (options.url) this.loadURL(options.url)
  }

  public postMessage(message: MessageData, targetOrigin: string = '*'): void {
    this.child.postMessage(message, targetOrigin)
  }

  /**
   * 加载一个URL
   * @param url
   */
  public loadURL(url: string) {
    this.frame.src = url
  }

  /**
   * 重写父类方法，销毁页面中的frame元素
   */
  public override destroy() {
    super.destroy()
    this.frame.parentNode!.removeChild(this.frame)
  }
}

interface ChildAPIOptions extends BaseAPIOptions {}

class ChildAPI extends BaseAPI {
  /**
   * 父窗口的句柄
   */
  private readonly parent: Window = window.parent

  /**
   * 父窗口指定给子窗口的唯一键值
   */
  public readonly wid: string = this.self.name

  public constructor(options: ChildAPIOptions) {
    super(options)
    this.reply()
  }

  public postMessage(message: MessageData, targetOrigin: string = '*'): void {
    this.parent.postMessage(message, targetOrigin)
  }

  /**
   * 当子窗口初始化完毕，通知父页面。
   */
  public reply() {
    this.postMessage(this.generateMsg('REPLY__MSG', null))
  }
}

export default class WebPostmsg {
  public static readonly Parent = ParentAPI
  public static readonly Child = ChildAPI
}
