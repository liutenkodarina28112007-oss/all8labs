import {z} from 'zod';
export const InputSchema=z.object({type:z.literal('input'),v:z.literal(1),seq:z.number().int().nonnegative(),turn:z.number().min(-1).max(1),thrust:z.boolean(),fire:z.boolean()});
export const JoinSchema=z.object({type:z.literal('join'),v:z.literal(1),room:z.string().min(1).max(32),name:z.string().trim().min(1).max(18)});
export const PingSchema=z.object({type:z.literal('ping'),v:z.literal(1)});
export const ChatSchema=z.object({type:z.literal('chat'),v:z.literal(1),text:z.string().trim().min(1).max(240)});
export const ClientMessageSchema=z.discriminatedUnion('type',[InputSchema,JoinSchema,ChatSchema,PingSchema]);
export type ClientMessage=z.infer<typeof ClientMessageSchema>;
export function parseClientMessage(value:unknown){const r=ClientMessageSchema.safeParse(value);return r.success?{ok:true as const,data:r.data}:{ok:false as const,error:r.error};}
