import {Transform} from 'node:stream';
export class MatchLogTransform extends Transform {constructor(){super({writableObjectMode:true})}_transform(event:unknown,_enc:BufferEncoding,cb:(error?:Error|null,data?:string)=>void){try{cb(null,JSON.stringify(event)+'\n')}catch(e){cb(e as Error)}}}
