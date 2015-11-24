controller.on('frame',scattergestures);
controller.connect();
gesture_output.innerText = "Show thumb for details on scatterplot";

function scattergestures(frame) {

  if(!frame.valid) return;

  if(frame.hands.length == 2) {     //IMPLEMENT ZOOM
    if(frame.hands[0].type=='left') {
      left = frame.hands[0];
      right = frame.hands[1];
    } else {
      left = frame.hands[1];
      right = frame.hands[0];
    }
    leftnormal = left.palmNormal;
    rightnormal = right.palmNormal;
    leftvelocity = left.palmVelocity;
    rightvelocity = right.palmVelocity;
    normdotprod = 0.0;
    velocitysum = 0.0;
    for (i=0; i<3;i++) {
      normdotprod += leftnormal[i]*rightnormal[i];
      velocitysum += Math.abs(leftvelocity[i]) + Math.abs(rightvelocity[i]);
    }
    if(normdotprod<0 && velocitysum > 500) {
      if(leftvelocity[0]>0 && rightvelocity[0]<0){
        console.log("Zoom in");
        zoom(1.1);
      } else if (leftvelocity[0]<0 && rightvelocity[0]>0) {
        console.log("Zoom out");
        zoom(0.9);
      }
    } else if (normdotprod > 0 && velocitysum > 300) {
      if(leftvelocity[0]>0 && rightvelocity[0]>0){
        console.log("Left");
        pan(5,0);
      } else if (leftvelocity[0]<0 && rightvelocity[0]<0) {
        console.log("Right");
        pan(-5,0);
      } else if (leftvelocity[1]>0 && rightvelocity[1]>0) {
        console.log("Top");
        pan(0,5);
      } else if (leftvelocity[1]<0 && rightvelocity[1]<0) {
        console.log("Down");
        pan(0,-5);
      }
    }
  } else if(frame.gestures.length > 0) {
    frame.gestures.forEach(function(gesture){
      if (gesture.type == "swipe") {
        if(frame.hands.length>0 && frame.hands[0].palmVelocity[0]>0) {
          show_criteria_screen();
          controller.removeListener('frame',scattergestures);
        } else {
          show_filter_screen();
          controller.removeListener('frame',scattergestures);
        }
        console.log("Screen Change");
      }
    });
  }
}

function isKeyTapGesture(gestures) {
if(gestures.length > 0) {
    gestures.forEach(function(gesture){
      if (gesture.type == "keyTap") {
        console.log("keyTap Gesture");
        return true;
      }
    });
  }
  return false;
}

$('#myModal').on('hidden', function () {
console.log("Modal hidden");
controller.on("frame",scattergestures);
})