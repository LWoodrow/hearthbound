// Model-written conversational notes, never biography, evidence or game state.
const moves=['respond','deliver','clarify','revise','close','repeat'];
export const dialogueThreadSchema={type:'object',properties:{
 request:{type:'string',maxLength:240},
 choices:{type:'array',maxItems:4,items:{type:'string',maxLength:100}},
 move:{type:'string',enum:moves},
},required:['request','choices','move'],additionalProperties:false};
export function validDialogueThread(value){
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3
  &&typeof value.request==='string'&&value.request.length<=240
  &&Array.isArray(value.choices)&&value.choices.length<=4&&value.choices.every(item=>typeof item==='string'&&item.length<=100)
  &&moves.includes(value.move);
}
export function dialogueThread(value){return validDialogueThread(value)?{request:value.request,choices:[...value.choices],move:value.move}:null;}
