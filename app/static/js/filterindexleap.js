
function activatecursor() {
  console.log("activatecursor");
  var leapCursor = new LeapCursor();
  controller.removeListener('frame',filtergestures);  
}