controller.on('frame',scattergestures); //soumya
controller.connect();
var cursorflag = true;


function activatecursor() {
  if(cursorflag) {
    var leapCursor = new LeapCursor();
    controller.removeListener('frame',scattergestures);
    cursorflag = false;
  } else {
    controller.on('frame',scattergestures);
    cursorflag = true;
  }
}

function scattergestures(frame) {
  if(!frame.valid) return;
  hands = frame.hands;

  if(hands.length == 2) {     //IMPLEMENT ZOOM
    if(hands[0].type=='left') {
      left = hands[0];
      right = hands[1];
    } else {
      left = hands[1];
      right = hands[0];
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
    if(normdotprod<0 && velocitysum > 400) {
      if(leftvelocity[0]>0 && rightvelocity[0]<0){
        console.log("Zoom in");
        zoom(1.15);
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
        console.log("Down");
        pan(0,-5);
      } else if (leftvelocity[1]<0 && rightvelocity[1]<0) {
        console.log("Top");
        pan(0,5);
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