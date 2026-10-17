export function createFeedFollower(): {
 scroll(metrics:{scrollTop:number;scrollHeight:number;clientHeight:number}):boolean;
 receive(id:number):{scroll:boolean;unseen:boolean};
 jump():void;
};
