import { random } from '@kazura/web-util'

export interface MessageData<T = any> {
  tag: typeof WebPostMsg.MESSAGE_TAG
  type: string
  resources: T
  channel: string
  uuid: string
}

export interface IPostMsgAPI {}

export type Listener = (resources: any, event: MessageEvent<MessageData>) => any

export type executor = { resolve: (value: any) => void; reject: (reason?: any) => void }

export interface PostMsgAPIOptions {
  listeners?: Map<string, Listener>
  receiver: Window
  channel: string
}

export class WebPostMsg implements IPostMsgAPI {
  /**
   * 消息标签
   */
  public static readonly MESSAGE_TAG = 'application/x-web-postmsg-v2'

  /**
   * 频道
   */
  public readonly channel: string

  /**
   * 发送者(自身)
   */
  public readonly self: Window = window

  /**
   * 接收者
   */
  public readonly receiver: Window

  /**
   * 监听函数集合
   */
  private listeners: Map<string, Listener> = new Map()

  /**
   * 执行者事件池
   */
  private executorPool: Map<string, executor> = new Map()

  public constructor(options: PostMsgAPIOptions) {
    this.receiver = options.receiver
    this.channel = options.channel

    if (options.listeners) this.listeners = options.listeners
    this.self.addEventListener('message', this.eventHandler)
  }

  /**
   * 生成一个随机的id
   * @returns
   */
  public static generateUUID() {
    return '' + random(10000, 99999) + new Date().getTime()
  }

  /**
   * 生成一条消息
   * @param type
   * @param resources
   * @param replyMessageId
   * @returns
   */
  public generateMessage(type: string, resources: any, replyMessageId?: string): MessageData {
    return {
      tag: WebPostMsg.MESSAGE_TAG,
      type,
      resources,
      channel: this.channel,
      uuid: replyMessageId ?? WebPostMsg.generateUUID(),
    }
  }

  /**
   * 事件处理
   * @param event
   * @returns
   */
  private eventHandler = (event: MessageEvent<MessageData>) => {
    const { data } = event
    if (typeof data === 'object' && 'tag' in data && data.tag === WebPostMsg.MESSAGE_TAG) {
      if (this.channel === data.channel) {
        /**
         * 收到一条事件回应，根据uuid将回应数据交给对应的事件发起者。
         */
        if (data.type === 'SYS__REPLY__MSG') {
          const p = this.executorPool.get(data.uuid)
          this.executorPool.delete(data.uuid)
          if (p) p.resolve(data.resources)
          return
        }

        const listener = this.listeners.get(data.type)
        if (listener) {
          const reply = (resources: any) => this.replyMessage(resources, data.uuid)
          const result = listener(data.resources, event)
          if (typeof result === 'object' && 'then' in result && typeof result.then === 'function') {
            result.then((resources: any) => reply(resources))
          } else {
            reply(result)
          }
        }
      }
    }
  }

  /**
   * 回复一条消息
   * @param resources
   * @param replyMessageId
   */
  public replyMessage(resources: any, replyMessageId: string) {
    const message = this.generateMessage('REPLY__MSG', resources, replyMessageId)
    this.postMessage(message)
  }

  /**
   * 发送一条消息
   * @param message
   * @param targetOrigin
   */
  public postMessage(message: MessageData, targetOrigin: string = '*') {
    this.receiver.postMessage(message, targetOrigin)
  }

  /**
   * 事件派发
   * @param resolve
   * @param reject
   * @param event
   * @param resources
   */
  public eventDispatcher(
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
    event: string,
    resources: any
  ) {
    // 生成消息
    const msg = this.generateMessage('CALL__' + event, resources)
    this.executorPool.set(msg.uuid, { resolve, reject })
    // 派发消息给子窗口
    this.postMessage(msg, '*')
    // 超时处理
    this.self.setTimeout(() => {
      if (this.executorPool.has(msg.uuid)) {
        this.executorPool.delete(msg.uuid)
        reject(new Error(`message type ${msg.type} timeout`))
      }
    }, 5000)
  }

  /**
   * 注册一个监听函数
   * @param type
   * @param listener
   */
  public on(type: string, listener: Listener) {
    this.listeners.set('CALL__' + type, listener)
  }

  /**
   * 移除一个监听函数
   * @param type
   */
  public off(type: string) {
    this.listeners.delete('CALL__' + type)
  }

  /**
   * 派发一个监听函数
   * @param type
   * @param resources
   * @returns
   */
  public emit(type: string, resources: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.eventDispatcher(resolve, reject, type, resources)
    })
  }

  /**
   * 析构方法，移除所有副作用。
   */
  public destroy() {
    this.self.removeEventListener('message', this.eventHandler)
  }

  public static create() {}
}

export interface WindowReference extends PostMsgAPIOptions {}

export class FrameWindowReference {
  public static readonly Parent = class implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string = WebPostMsg.generateUUID()

    public readonly frame: HTMLIFrameElement

    public constructor(options: {
      listeners?: Map<string, Listener>
      container?: HTMLElement
      className?: string
      url?: string
      frame?: HTMLIFrameElement
    }) {
      this.listeners = options.listeners

      // 如果传递了frame
      if (options.frame) {
        this.frame = options.frame
        if (this.frame.name) {
          this.channel = this.frame.name
        } else {
          this.frame.name = this.channel
        }
      } else {
        // 创建frame元素
        this.frame = document.createElement('iframe')
        this.frame.name = this.channel
        if (options.className) this.frame.className = options.className
        if (!options.container) throw new Error('container is undefined')
        options.container.appendChild(this.frame)
      }

      this.receiver = this.frame.contentWindow!

      if (options.url) this.loadURL(options.url)
    }

    /**
     * 加载一个URL
     * @param url
     */
    public loadURL(url: string) {
      this.frame.src = url
    }

    /**
     * 销毁页面中的frame元素
     */
    public destroy() {
      this.frame.parentNode!.removeChild(this.frame)
    }
  }

  public static readonly Child = class implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string

    public constructor(options?: { listeners?: Map<string, Listener> }) {
      options && (this.listeners = options.listeners)
      this.receiver = window.parent
      this.channel = window.name
    }
  }
}

export class OpenWindowReference {
  public static readonly Parent = class implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string = WebPostMsg.generateUUID()

    public constructor(options: {
      listeners?: Map<string, Listener>
      url: string
      features?: string
    }) {
      this.listeners = options.listeners
      this.receiver = window.open(options.url, this.channel, options.features)!
    }

    public destroy() {
      this.receiver.close()
    }
  }

  public static readonly Child = class implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string

    public constructor(options?: { listeners?: Map<string, Listener> }) {
      options && (this.listeners = options.listeners)
      this.receiver = window.opener
      this.channel = window.name
    }
  }
}

export { WebPostMsg as default }
