import { generateUUID } from './utils'
import { Listener } from './web-postmsg'
import { WindowReference } from './window-reference'

namespace FrameWindowReference {
  export class Parent implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string = generateUUID()
    public receiveAllChannel: boolean = false

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

  export class Child implements WindowReference {
    public readonly listeners?: Map<string, Listener>
    public readonly receiver: Window
    public readonly channel: string
    public receiveAllChannel: boolean = false

    public constructor(options?: { listeners?: Map<string, Listener> }) {
      options && (this.listeners = options.listeners)
      this.receiver = window.parent
      this.channel = window.name
    }
  }
}

export default FrameWindowReference
