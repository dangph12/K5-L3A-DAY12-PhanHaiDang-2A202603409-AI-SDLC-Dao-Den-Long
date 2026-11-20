import type {Game} from './game.js'
export function createView(host:HTMLElement):{
  canvas:HTMLCanvasElement
  draw(game:Game,yaw:number,pitch?:number,colorblind?:boolean):void
  pulse(game:Game):void
  impact(game:Game,kind:'damage'|'stolen',amount:number):void
  arrow(game:Game):number|null
  reset():void
}
