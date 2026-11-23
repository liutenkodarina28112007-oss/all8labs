export class Vector2 {
  constructor(public readonly x:number, public readonly y:number) {}
  add(v:Vector2){return new Vector2(this.x+v.x,this.y+v.y)}
  sub(v:Vector2){return new Vector2(this.x-v.x,this.y-v.y)}
  scale(n:number){return new Vector2(this.x*n,this.y*n)}
  get length(){return Math.hypot(this.x,this.y)}
  normalize(){const l=this.length||1;return new Vector2(this.x/l,this.y/l)}
  rotate(a:number){const c=Math.cos(a),s=Math.sin(a);return new Vector2(this.x*c-this.y*s,this.x*s+this.y*c)}
  dot(v:Vector2){return this.x*v.x+this.y*v.y}
  static fromAngle(a:number,m=1){return new Vector2(Math.cos(a)*m,Math.sin(a)*m)}
}
