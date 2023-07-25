import WebPostMsg, { Listener, PostMsgAPIOptions } from '@kazura/web-postmsg'

export interface ParentIFrameReceiverOptions {
  container: HTMLElement
  className?: string
  url?: string
}

export interface ParentOpenerReceiverOptions {
  url: string
  features?: string
}

export default class PostmsgBuilder {
  public iframe?: HTMLIFrameElement

  public options: Required<PostMsgAPIOptions> = {
    listeners: new Map<string, Listener>(),
    receiver: window,
    channel: WebPostMsg.generateUUID(),
    receiveAllChannel: false,
  }

  public constructor(options?: Partial<PostMsgAPIOptions>) {
    if (options) this.options = { ...this.options, ...options }
  }

  private setChannel(channel: string) {
    this.options.channel = channel

    return this
  }

  public setReceiver(receiver: Window) {
    // 如果记录中的iframe的contentWindow不是receiver，那么就清空iframe
    if (this.iframe && this.iframe.contentWindow !== receiver) {
      this.iframe = undefined
    }

    this.options.receiver = receiver

    return this
  }

  public setIFrameReceiver(iframe: HTMLIFrameElement) {
    this.iframe = iframe
    this.setReceiver(iframe.contentWindow!)
    return this
  }

  public setListeners(listeners: Map<string, Listener>) {
    this.options.listeners = listeners
    return this
  }

  public setListener(type: string, listener: Listener) {
    this.options.listeners.set(type, listener)
    return this
  }

  public deleteListener(type: string) {
    this.options.listeners.delete(type)
    return this
  }

  public setReceiveAllChannel(receiveAllChannel: boolean) {
    this.options.receiveAllChannel = receiveAllChannel
    return this
  }

  public build() {
    return new WebPostMsg(this.options)
  }

  public createChildIFrameReceiver(iframe: HTMLIFrameElement): PostmsgBuilder
  public createChildIFrameReceiver(options: ParentIFrameReceiverOptions): PostmsgBuilder
  public createChildIFrameReceiver(
    $1: HTMLIFrameElement | ParentIFrameReceiverOptions
  ): PostmsgBuilder {
    if ($1 instanceof HTMLIFrameElement) {
      const iframe = $1

      if (iframe.name) {
        this.setChannel(iframe.name)
      } else {
        iframe.name = this.options.channel
      }

      this.setIFrameReceiver(iframe)
      return this
    }

    if ($1.container) {
      const options = $1
      const iframe = document.createElement('iframe')

      iframe.name = this.options.channel
      if (options.className) iframe.className = options.className
      options.container.appendChild(iframe)

      this.setIFrameReceiver(iframe)
      if (options.url) this.loadURL(options.url)

      return this
    }

    throw new Error('createChildIFrameReceiver: invalid arguments')
  }

  public loadURL(url: string) {
    if (this.iframe) this.iframe.src = url
    return this
  }

  public createParentIFrameReceiver() {
    this.setReceiver(window.parent)
    this.setChannel(window.name)
    return this
  }

  public createChildOpenerReceiver(receiver: Window): PostmsgBuilder
  public createChildOpenerReceiver(options: ParentOpenerReceiverOptions): PostmsgBuilder
  public createChildOpenerReceiver($1: Window | ParentOpenerReceiverOptions): PostmsgBuilder {
    if ($1 instanceof Window) {
      this.setReceiver($1)
      return this
    }

    if ($1.url) {
      const options = $1
      this.open(options.url, options.features)
      return this
    }

    throw new Error('createChildOpenerReceiver: invalid arguments')
  }

  public open(url: string, features?: string) {
    this.setReceiver(window.open(url, this.options.channel, features)!)
    return this
  }

  public createParentOpenerReceiver() {
    this.setReceiver(window.opener)
    this.setChannel(window.name)
    return this
  }

  public destroy() {
    if (this.iframe) {
      this.iframe.parentNode!.removeChild(this.iframe)
    } else {
      this.options.receiver.close()
    }
    return this
  }
}
