controller.on('frame',filtergestures);
controller.connect();

function filtergestures(frame) {
  if(frame.valid) {
    if(frame.hands.length==1 && getExtendedFingers(frame.hands[0])==1) {
      
    } else if (frame.gestures.length > 0) {
      frame.gestures.forEach(function(gesture){
        if (gesture.type == "swipe") {
          document.location.href = 'index1.html';
          controller.removeListener('frame',filtergestures);
          console.log("Swipe Gesture");
        }
      });    
    }
  }
}