import { generateUUID } from './utils'
import { Listener } from './web-postmsg'
import { WindowReference } from './window-reference'

namespace OpenWindowReference {
  export class Parent implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public receiver: Window = window
    public readonly channel: string = generateUUID()
    public receiveAllChannel: boolean = false

    public constructor(options: {
      listeners?: Map<string, Listener>
      url?: string
      features?: string
      receiver?: Window
    }) {
      this.listeners = options.listeners
      if (options.url) {
        this.receiver = window.open(options.url, this.channel, options.features)!
      }
      if (options.receiver) {
        this.receiver = options.receiver
      }
    }

    public open(url: string, features?: string) {
      this.receiver = window.open(url, this.channel, features)!
    }

    public destroy() {
      this.receiver.close()
    }
  }

  export class Child implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string
    public receiveAllChannel: boolean = false

    public constructor(options?: { listeners?: Map<string, Listener> }) {
      options && (this.listeners = options.listeners)
      this.receiver = window.opener
      this.channel = window.name
    }
  }
}

export default OpenWindowReference
