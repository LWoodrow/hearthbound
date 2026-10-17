// Polling returns fresh arrays even when the event IDs did not change.
export function createFeedFollower(){
 let latest=null,following=true,unseen=false;
 return {
  scroll({scrollTop,scrollHeight,clientHeight}){
   following=scrollHeight-clientHeight-scrollTop<=64;
   if(following)unseen=false;
   return unseen;
  },
  receive(id){
   if(id===latest)return {scroll:false,unseen};
   const initial=latest===null||id<latest;
   if(initial){following=true;unseen=false;}
   latest=id;
   const scroll=initial||following;
   if(!scroll)unseen=true;
   return {scroll,unseen};
  },
  jump(){following=true;unseen=false;},
 };
}
