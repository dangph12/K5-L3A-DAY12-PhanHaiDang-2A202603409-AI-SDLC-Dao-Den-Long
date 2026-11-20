import type {Game} from './game.js'
export function createView(host:HTMLElement):{
  canvas:HTMLCanvasElement
  draw(game:Game,yaw:number,pitch?:number,colorblind?:boolean,benchElapsed?:number,reducedMotion?:boolean):void
  rendererInfo():string
  pulse(game:Game):void
  impact(game:Game,kind:'damage'|'stolen',amount:number,reducedMotion?:boolean):void
  arrow(game:Game):number|null
  shadeArrow(game:Game):number|null
  reset():void
}
