var clickevt = new MouseEvent("click", { //can generate any mouse event instead of click
        view: window,
        cancelable: true,
      /* whatever properties you want to give it */
      });
var mouseoverevt = new MouseEvent("mouseover", { //can generate any mouse event instead of click
        view: window,
        cancelable: true,
      /* whatever properties you want to give it */
      });

console.log(radio_home.childNodes.length);

// for (i=0;i<radio_home.childNodes.length; i++) {
//   document.getElementById(""+ i).on('click',executeclick);
//   document.getElementById(""+ i).on('mouseover',executemouseover);
// }

// function executeclick() {
//   console.log("clickevt");
// }

// function executemouseover() {
//   console.log("mouseoverevt");
// }

controller.on('frame',clustergestures);
controller.connect();

function clustergestures(frame) {
  if(frame.valid) {
    if (frame.gestures.length > 0) {
      frame.gestures.forEach(function(gesture){
        if (gesture.type == "swipe") {
            document.location.href = 'index1.html';
            controller.removeListener('frame',clustergestures);
            console.log("Swipe Gesture");
          }
        });
      } else if(frame.hands.length==1 && getExtendedFingers(frame.hands[0])>0) {
        var id = getExtendedFingers(frame.hands[0]);
        if(document.getElementById(id)!= null) {
          document.getElementById(id).click();
        }
        

      // console.log("entered2");
      // var pointable = frame.pointables[0];
      // var interactionBox = frame.interactionBox;
      // var normalizedPosition = interactionBox.normalizePoint(pointable.stabilizedTipPosition, true);

      // // Convert the normalized coordinates to span the canvas
      // var lx = radio_home.clientWidth * normalizedPosition[0];
      // var ly = radio_home.clientHeight * (1 - normalizedPosition[1]);
      // //console.log(lx,ly);

      // if (document.elementFromPoint(lx, ly)!= null) {
      //   //dispatch mouse event to element under pointer x, y co-ordinates
      //   console.log(document.elementFromPoint(lx, ly));
      //   if (isScreenTapGesture(frame.gestures)) {
      //     document.elementFromPoint(lx, ly).click();
      //   } else {
      //     document.elementFromPoint(lx, ly).mouseover();
      //   }
      // }
    }     
  }
}
