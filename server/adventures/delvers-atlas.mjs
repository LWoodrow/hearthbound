// Fixed public entrances on the user-approved source-based district plate.
// Coordinates are percentages of the image, not image recognition at runtime.
export const delversLayout = {
  image:'/art/maps/eldervale-delvers-district-v5.png',
  anchors:{junction:[58,86],last:[50,57],rope:[31,28],maps:[34,53],board:[65,51],memorial:[13,61],gear:[37,76],hostel:[28,97],guild:[89,41]},
  labelSides:{maps:'left',gear:'left',board:'right'},
  edgeDestinations:['hostel'],
  // Intermediate bends follow lanes around the rotunda and house blocks.
  // The eastern crossing uses the illustrated bridge, not a line through water.
  streets:[
    ['junction','last',[[62,79],[64,68],[60,61]]],
    ['last','rope',[[42,53],[35,44],[31,36]]],
    ['rope','board',[[39,23],[47,22],[58,23],[66,28],[69,40]]],
    ['maps','last',[[41,55]]],
    ['junction','maps',[[48,84],[43,77],[40,65],[36,59]]],
    ['maps','memorial',[[27,51],[21,56]]],
    ['memorial','gear',[[19,68],[28,74]]],
    ['gear','junction',[[43,86],[51,88]]],
    ['gear','hostel',[[33,85],[30,94]]],
    ['hostel','junction',[[39,95],[46,94],[53,90]]],
    ['junction','board',[[68,77],[74,63],[73,54]]],
    ['board','guild',[[70,39],[73,26],[73,18],[77,16],[81,16],[84,27]]],
  ],
  // Eligible underground markers attach to the tavern entrance, not a fake
  // surface route drawn to an arbitrary point at the top of the map.
  boundaryAnchors:{'city-under-landing':[62,59]},
  // These are existing canonical junction exits, not new travel shortcuts.
  gateways:[
    {id:'city-crown',x:52,y:4,labelSide:'left',points:[[58,86],[68,77],[74,63],[73,54],[70,39],[66,28],[58,23],[52,16],[52,4]]},
    {id:'city-temples',x:2,y:45,points:[[58,86],[48,84],[43,77],[40,65],[34,53],[27,51],[21,56],[13,61],[6,55],[2,45]]},
    {id:'city-old',x:97,y:20,labelSide:'left',points:[[58,86],[68,77],[74,63],[73,54],[70,39],[73,26],[73,18],[77,16],[81,16],[90,20],[97,20]]},
    {id:'city-lantern',x:12,y:94,points:[[58,86],[51,88],[43,86],[37,76],[28,74],[21,82],[12,94]]},
    {id:'city',x:3,y:79,points:[[58,86],[51,88],[43,86],[37,76],[28,74],[19,68],[13,61],[6,66],[3,79]]},
  ],
};
