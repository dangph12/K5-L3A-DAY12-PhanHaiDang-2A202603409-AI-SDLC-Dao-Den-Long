import type {Game} from './game.js'
export function createView(host:HTMLElement):{
  canvas:HTMLCanvasElement
  draw(game:Game,yaw:number):void
  pulse(game:Game):void
  arrow(game:Game):number|null
  reset():void
}
