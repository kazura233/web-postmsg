import { random } from '@kazura/web-util'

export const generateUUID = () => '' + random(10000, 99999) + new Date().getTime()
